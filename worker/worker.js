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
const HEARTBEAT_MS = 60 * 60 * 1000;

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

function statusSnapshot(healthData) {
  const services = {};
  for (const service of healthData.services) {
    services[service.name] = service.status;
  }
  return {
    checkedAt: healthData.timestamp,
    services,
  };
}

function statusesChanged(previous, current) {
  if (!previous || !previous.services || typeof previous.services !== 'object') return true;

  for (const target of TARGETS) {
    if (previous.services[target.name] !== current.services[target.name]) return true;
  }
  return false;
}

function heartbeatExpired(previous, now) {
  if (!previous || typeof previous.checkedAt !== 'string') return true;
  const checkedAt = new Date(previous.checkedAt).getTime();
  return !Number.isFinite(checkedAt) || now - checkedAt > HEARTBEAT_MS;
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
  const previous = await readStatusSnapshot(kv);
  const current = statusSnapshot(healthData);

  if (statusesChanged(previous, current) || heartbeatExpired(previous, Date.now())) {
    // At most one KV write per scheduled run. No expiration is applied.
    await kv.put(STATUS_KEY, JSON.stringify(current));
  }
}

function uptimeResponse(snapshot) {
  const checkedAt = snapshot?.checkedAt || null;
  const hasSnapshot = Boolean(checkedAt && snapshot?.services);
  const services = TARGETS.map((target) => {
    const status = snapshot?.services?.[target.name] || 'unknown';
    const online = status === 'online';
    return {
      name: target.name,
      uptimePct: online ? 100 : status === 'offline' ? 0 : null,
      totalUptimeMs: hasSnapshot ? 0 : null,
      trackingStart: hasSnapshot ? checkedAt : null,
      observationMs: hasSnapshot ? 0 : 0,
      trackingDays: hasSnapshot ? 0 : null,
      lastCheck: checkedAt,
      lastStatus: status,
      downtimeStart: online ? null : checkedAt,
      downtimeEvents: [],
    };
  });
  const observed = services.filter((service) => service.uptimePct !== null);
  const overallUptime = observed.length
    ? Math.round(observed.reduce((sum, service) => sum + service.uptimePct, 0) / observed.length)
    : null;

  return {
    services,
    timestamp: new Date().toISOString(),
    trackingStartedAt: hasSnapshot ? checkedAt : null,
    trackingDays: hasSnapshot ? 0 : null,
    trackedServices: hasSnapshot ? observed.length : 0,
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
