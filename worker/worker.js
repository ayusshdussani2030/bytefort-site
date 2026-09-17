/**
 * Health Check Worker
 * Pings services and returns live status.
 * A single KV record is used for the scheduled status snapshot.
 */

const TARGETS = [
  { name: 'Authentik', url: 'https://auth.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Home Assistant', url: 'https://homeassistant.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Jellyfin', url: 'https://jellyfin.bytefort.xyz/health', timeout: 5000, type: 'http' },
  { name: 'Netbird', url: 'https://netbird.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Nginx Proxy Manager', url: 'https://npm.bytefort.xyz/api/', timeout: 5000, type: 'http' },
  { name: 'Ripper', url: 'https://ripper.bytefort.xyz/favicon.ico', timeout: 5000, type: 'http' },
  { name: 'Jellyseerr', url: 'https://seerr.bytefort.xyz/api/v1/status', timeout: 5000, type: 'http' },
  { name: 'Speed Test', url: 'https://speedtest.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Vaultwarden', url: 'https://vault.bytefort.xyz', timeout: 5000, type: 'http' },
];

const AUTH_GATE = 'outpost.goauthentik.io';
const STATUS_KEY = 'status';

async function pingHost(host, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(host, {
      signal: controller.signal,
      redirect: 'manual',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Cache-Buster': Date.now().toString(),
      },
      cf: { cacheEverything: false, cacheTtl: 0 },
    });

    const location = response.headers.get('location') || '';
    if (location.includes(AUTH_GATE)) return false;
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function checkTarget(target) {
  const start = Date.now();
  const healthy = await pingHost(target.url, target.timeout);
  return {
    ...target,
    healthy,
    latency: Date.now() - start,
    status: healthy ? 'online' : 'offline',
    checkedAt: new Date().toISOString(),
  };
}

async function checkAllHealth() {
  const results = await Promise.all(TARGETS.map(checkTarget));
  const onlineCount = results.filter((result) => result.healthy).length;

  return {
    status: onlineCount === results.length ? 'healthy' : 'degraded',
    services: results,
    timestamp: new Date().toISOString(),
    overallUptime: Math.round((onlineCount / results.length) * 100),
  };
}

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function timestampMs(value) {
  return typeof value === 'string' ? Date.parse(value) : NaN;
}

function validSnapshot(snapshot, now) {
  if (snapshot?.version !== 2) return false;
  const checkpoint = timestampMs(snapshot.checkedAt);
  if (!Number.isFinite(checkpoint) || checkpoint > now) return false;
  return TARGETS.every(({ name }) => {
    const status = snapshot.services?.[name];
    const accounting = snapshot.accounting?.[name];
    const start = timestampMs(accounting?.trackingStart);
    const since = timestampMs(accounting?.statusSince);
    return (status === 'online' || status === 'offline')
      && Number.isFinite(start) && start <= checkpoint
      && Number.isFinite(since) && since >= start && since <= checkpoint
      && Number.isFinite(accounting?.totalUptimeMs)
      && accounting.totalUptimeMs >= 0 && accounting.totalUptimeMs <= checkpoint - start;
  });
}

function statusSnapshot(healthData, previous) {
  const services = {};
  const accounting = {};
  const now = timestampMs(healthData.timestamp);
  const elapsed = previous ? now - timestampMs(previous.checkedAt) : 0;
  for (const service of healthData.services) {
    services[service.name] = service.status;
    const prior = previous?.accounting[service.name];
    const priorStatus = previous?.services[service.name];
    accounting[service.name] = {
      trackingStart: prior?.trackingStart || healthData.timestamp,
      statusSince: prior && priorStatus === service.status ? prior.statusSince : healthData.timestamp,
      totalUptimeMs: (prior?.totalUptimeMs || 0) + (priorStatus === 'online' ? elapsed : 0),
    };
  }
  return {
    version: 2,
    checkedAt: healthData.timestamp,
    services,
    accounting,
  };
}

function statusesChanged(previous, current) {
  if (!previous || !previous.services || typeof previous.services !== 'object') return true;

  for (const target of TARGETS) {
    if (previous.services[target.name] !== current.services[target.name]) return true;
  }
  return false;
}

async function readStatusSnapshot(kv) {
  const raw = await kv.get(STATUS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

async function updateStatusSnapshot(env, healthData) {
  const kv = env.BYTEFORT_UPTIME;
  if (!kv) throw new Error('BYTEFORT_UPTIME binding is not configured');

  // Exactly one KV read per scheduled run.
  const stored = await readStatusSnapshot(kv);
  // Old status-only records have no history. Start an honest new window once.
  const previous = validSnapshot(stored, timestampMs(healthData.timestamp)) ? stored : null;
  const current = statusSnapshot(healthData, previous);

  if (statusesChanged(previous, current)) {
    // One initialization write, then only status flips. No heartbeat or expiration.
    await kv.put(STATUS_KEY, JSON.stringify(current));
  }
}

function uptimeResponse(snapshot) {
  const now = Date.now();
  const hasSnapshot = validSnapshot(snapshot, now);
  const checkedAt = hasSnapshot ? snapshot.checkedAt : null;
  const elapsed = hasSnapshot ? now - timestampMs(checkedAt) : 0;
  const services = TARGETS.map((target) => {
    const status = hasSnapshot ? snapshot.services[target.name] : 'unknown';
    const accounting = hasSnapshot ? snapshot.accounting[target.name] : null;
    const online = status === 'online';
    const observationMs = accounting ? now - timestampMs(accounting.trackingStart) : 0;
    // Assume the last recorded state continues; reads never persist elapsed time.
    const totalUptimeMs = accounting ? accounting.totalUptimeMs + (online ? elapsed : 0) : null;
    const uptimePct = observationMs > 0 ? (totalUptimeMs / observationMs) * 100 : null;
    return {
      name: target.name,
      uptimePct,
      totalUptimeMs,
      trackingStart: accounting?.trackingStart || null,
      observationMs,
      trackingDays: accounting ? observationMs / 86400000 : null,
      lastCheck: checkedAt,
      lastStatus: status,
      statusSince: accounting?.statusSince || null,
      downtimeStart: status === 'offline' ? accounting.statusSince : null,
      downtimeEvents: [],
    };
  });
  const observed = services.filter((service) => service.uptimePct !== null);
  const overallUptime = observed.length
    ? observed.reduce((sum, service) => sum + service.uptimePct, 0) / observed.length
    : null;
  const trackingStartedAt = hasSnapshot
    ? new Date(Math.min(...services.map((service) => timestampMs(service.trackingStart)))).toISOString()
    : null;

  return {
    services,
    timestamp: new Date(now).toISOString(),
    estimation: 'last-recorded-state',
    trackingStartedAt,
    trackingDays: hasSnapshot ? (now - timestampMs(trackingStartedAt)) / 86400000 : null,
    trackedServices: hasSnapshot ? services.length : 0,
    overallUptime,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health' || url.pathname === '/metrics' || url.pathname === '/') {
      return jsonResponse(await checkAllHealth());
    }

    if (url.pathname === '/uptime') {
      if (!env.BYTEFORT_UPTIME) {
        return jsonResponse({ error: 'Uptime KV binding is not configured' }, 503);
      }

      try {
        // Fetch is read-only and performs one KV read for this endpoint.
        const snapshot = await readStatusSnapshot(env.BYTEFORT_UPTIME);
        return jsonResponse(uptimeResponse(snapshot));
      } catch (error) {
        return jsonResponse({ error: 'Unable to read uptime status' }, 503);
      }
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const healthData = await checkAllHealth();
        await updateStatusSnapshot(env, healthData);
      } catch (error) {
        console.error('scheduled handler failed:', error);
      }
    })());
  },
};
