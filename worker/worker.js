/**
 * Health Check Worker
 * Pings your services and returns live status.
 *
 * Services behind the Authentik outpost answer 302 to outpost.goauthentik.io
 * whether or not the app is up, so each one points at a path added to
 * Unauthenticated Paths on its proxy provider
 * (Applications > Providers > [provider] > Advanced protocol settings):
 *   Jellyfin    ^/health$
 *   Jellyseerr  ^/api/v1/status$
 *   NPM         ^/api/.*
 *   Ripper      ^/favicon\.ico$
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

// A redirect here means Authentik answered, not the service itself.
const AUTH_GATE = 'outpost.goauthentik.io';

const UPTIME_KEY_PREFIX = 'uptime:';
const TRACKING_EPOCH = new Date('2026-09-16T16:25:00Z').getTime();

async function pingHost(host, timeout) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(host, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'Cache-Buster': Date.now().toString() },
      cf: { cacheEverything: false, cacheTtl: 0 },
    });

    clearTimeout(timer);

    const location = response.headers.get('location') || '';
    if (location.includes(AUTH_GATE)) return false;

    return response.status >= 200 && response.status < 400;
  } catch (e) {
    return false;
  }
}

async function checkTarget(target) {
  const start = Date.now();
  const healthy = await pingHost(target.url, target.timeout);
  const latency = Date.now() - start;
  return {
    ...target,
    healthy,
    latency,
    status: healthy ? 'online' : 'offline',
    checkedAt: new Date().toISOString(),
  };
}

async function checkAllHealth() {
  const results = await Promise.all(TARGETS.map(checkTarget));
  const allHealthy = results.every((r) => r.healthy);

  return {
    status: allHealthy ? 'healthy' : 'degraded',
    services: results,
    timestamp: new Date().toISOString(),
    overallUptime: Math.round(
      (results.filter((r) => r.healthy).length / results.length) * 100
    ),
  };
}

async function getUptimeData(kv, serviceName) {
  try {
    const raw = await kv.get(UPTIME_KEY_PREFIX + serviceName);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function saveUptimeData(kv, serviceName, data) {
  await kv.put(
    UPTIME_KEY_PREFIX + serviceName,
    JSON.stringify(data),
    { expirationTtl: 60 * 60 * 24 * 90 } // 90-day TTL
  );
}

function calculateUptimePct(record, now) {
  if (!record) return 0;
  const trackingStart = new Date(record.trackingStart).getTime();
  const lastCheck = new Date(record.lastCheck).getTime();
  if (!Number.isFinite(lastCheck) || lastCheck <= trackingStart || lastCheck > now) return 0;
  const observedUntil = lastCheck;
  const totalMs = observedUntil - trackingStart;
  const storedUptimeMs = Number(record.totalUptimeMs);
  const uptimeMs = Number.isFinite(storedUptimeMs) && storedUptimeMs >= 0
    ? storedUptimeMs
    : 0;
  if (!Number.isFinite(trackingStart) || trackingStart < TRACKING_EPOCH || totalMs <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((uptimeMs / totalMs) * 100)));
}

async function recordUptime(kv, serviceName, healthy, checkedAt) {
  const now = new Date(checkedAt).getTime();
  if (!Number.isFinite(now) || now < TRACKING_EPOCH || now > Date.now()) return;
  const record = await getUptimeData(kv, serviceName);

  if (!record) {
    // The first check establishes the beginning of the observed window.
    await saveUptimeData(kv, serviceName, {
      totalUptimeMs: 0,
      trackingStart: checkedAt,
      lastCheck: checkedAt,
      lastStatus: healthy ? 'online' : 'offline',
      downtimeStart: healthy ? null : now,
      downtimeEvents: healthy ? [] : [{ start: checkedAt, end: null }],
    });
    return;
  }

  const trackingStart = new Date(record.trackingStart).getTime();
  if (!Number.isFinite(trackingStart) || trackingStart < TRACKING_EPOCH || trackingStart > now) {
    // Reset records from the previous schema instead of presenting invented history.
    record.trackingStart = checkedAt;
    record.totalUptimeMs = 0;
    record.lastCheck = checkedAt;
    record.lastStatus = healthy ? 'online' : 'offline';
    record.downtimeStart = healthy ? null : now;
    record.downtimeEvents = healthy ? [] : [{ start: checkedAt, end: null }];
    await saveUptimeData(kv, serviceName, record);
    return;
  }

  record.downtimeEvents = Array.isArray(record.downtimeEvents)
    ? record.downtimeEvents
    : [];
  const totalUptimeMs = Number(record.totalUptimeMs);
  record.totalUptimeMs = Number.isFinite(totalUptimeMs) && totalUptimeMs >= 0
    ? totalUptimeMs
    : 0;

  const lastCheck = record.lastCheck ? new Date(record.lastCheck).getTime() : now;
  if (!Number.isFinite(lastCheck) || lastCheck < trackingStart || lastCheck > now) {
    // Do not preserve accumulated values across an invalid observation window.
    record.totalUptimeMs = 0;
    record.lastCheck = checkedAt;
    record.lastStatus = healthy ? 'online' : 'offline';
    record.downtimeStart = healthy ? null : now;
    record.downtimeEvents = healthy ? [] : [{ start: checkedAt, end: null }];
    await saveUptimeData(kv, serviceName, record);
    return;
  }
  record.totalUptimeMs = Math.min(record.totalUptimeMs, lastCheck - trackingStart);
  const elapsed = now - lastCheck;

  if (record.downtimeStart !== null) {
    const downtimeStart = Number(record.downtimeStart);
    record.downtimeStart = Number.isFinite(downtimeStart)
      && downtimeStart >= trackingStart
      && downtimeStart <= now
      ? downtimeStart
      : record.lastStatus === 'offline' && Number.isFinite(lastCheck)
        ? Math.min(now, Math.max(trackingStart, lastCheck))
        : null;
  }

  if (Number.isFinite(lastCheck) && elapsed > 0 && record.lastStatus === 'online') {
    record.totalUptimeMs = (record.totalUptimeMs || 0) + elapsed;
  }

  if (record.lastStatus === 'online' && !healthy) {
    record.downtimeStart = now;
    record.downtimeEvents.push({ start: checkedAt, end: null });
    if (record.downtimeEvents.length > 20) record.downtimeEvents.shift();
  } else if (record.lastStatus === 'offline' && healthy && record.downtimeStart) {
    const downtimeMs = now - record.downtimeStart;
    const lastEvent = record.downtimeEvents[record.downtimeEvents.length - 1];
    if (lastEvent && !lastEvent.end) {
      lastEvent.end = checkedAt;
      lastEvent.duration = downtimeMs;
    }
    record.downtimeStart = null;
  }

  record.lastCheck = checkedAt;
  record.lastStatus = healthy ? 'online' : 'offline';

  await saveUptimeData(kv, serviceName, record);
}

function sanitizeDowntimeEvents(events, now, trackingStart) {
  if (!Array.isArray(events)) return [];

  return events.map((event) => {
    if (!event || typeof event.start !== 'string') return null;
    const start = new Date(event.start).getTime();
    if (!Number.isFinite(start) || start < trackingStart || start > now) return null;

    if (event.end !== null && event.end !== undefined
      && (typeof event.end !== 'string' || !event.end.trim())) return null;
    if (event.end && !Number.isFinite(new Date(event.end).getTime())) return null;
    const parsedEnd = event.end ? new Date(event.end).getTime() : NaN;
    if (event.end && (!Number.isFinite(parsedEnd) || parsedEnd <= start || parsedEnd > now)) return null;
    const end = Number.isFinite(parsedEnd) && parsedEnd > start && parsedEnd <= now
      ? parsedEnd
      : null;
    if (event.duration !== null && event.duration !== undefined
      && (typeof event.duration !== 'number' || !Number.isFinite(event.duration) || event.duration < 0)) return null;
    if (!end && event.duration !== null && event.duration !== undefined) return null;
    if (end && (event.duration === undefined || event.duration === null || event.duration !== end - start)) return null;

    return {
      start: new Date(start).toISOString(),
      end: end ? new Date(end).toISOString() : null,
      duration: end ? end - start : null,
    };
  }).filter(Boolean).slice(-20);
}

async function handleUptimeEndpoint(kv) {
  const now = Date.now();
  const results = [];
  for (const target of TARGETS) {
    const record = await getUptimeData(kv, target.name);
    const trackingStart = record ? new Date(record.trackingStart).getTime() : NaN;
    const lastCheck = record ? new Date(record.lastCheck).getTime() : NaN;
    const hasValidTracking = Number.isFinite(trackingStart)
      && trackingStart >= TRACKING_EPOCH
      && trackingStart <= now
      && Number.isFinite(lastCheck)
      && lastCheck > trackingStart
      && lastCheck <= now
      && now - lastCheck <= 900000;
    const uptimePct = hasValidTracking ? calculateUptimePct(record, now) : null;
    const storedUptimeMs = Number(record?.totalUptimeMs);
    const totalUptimeMs = hasValidTracking
      ? Math.min(
        Number.isFinite(storedUptimeMs) && storedUptimeMs >= 0 ? storedUptimeMs : 0,
        lastCheck - trackingStart
      )
      : null;
    const downtimeStart = Number(record?.downtimeStart);
    const validDowntimeStart = Number.isFinite(downtimeStart)
      && downtimeStart >= trackingStart
      && downtimeStart <= now
      ? downtimeStart
      : null;

    results.push({
      name: target.name,
      uptimePct,
      totalUptimeMs,
      trackingStart: hasValidTracking ? record.trackingStart : null,
      observationMs: hasValidTracking
        ? lastCheck - trackingStart
        : 0,
      trackingDays: hasValidTracking
        ? Math.max(0, (now - trackingStart) / 86400000)
        : null,
      lastCheck: hasValidTracking ? record.lastCheck : null,
      downtimeStart: hasValidTracking ? validDowntimeStart : null,
      downtimeEvents: hasValidTracking
        ? sanitizeDowntimeEvents(record?.downtimeEvents, now, trackingStart)
        : [],
      lastStatus: record?.lastStatus === 'online' || record?.lastStatus === 'offline'
        ? record.lastStatus
        : 'unknown',
    });
  }

  const observed = results.filter((r) => r.uptimePct !== null);
  const trackingStartedAt = observed.length
    ? observed.reduce((first, r) =>
      new Date(r.trackingStart).getTime() < new Date(first).getTime() ? r.trackingStart : first,
      observed[0].trackingStart
    )
    : null;
  const overallUptime = observed.length
    ? Math.round(observed.reduce((sum, r) => sum + r.uptimePct, 0) / observed.length)
    : null;

  return new Response(JSON.stringify({
    services: results,
    timestamp: new Date(now).toISOString(),
    trackingStartedAt,
    trackingDays: trackingStartedAt
      ? Math.max(0, (now - new Date(trackingStartedAt).getTime()) / 86400000)
      : null,
    trackedServices: observed.length,
    overallUptime,
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health' || url.pathname === '/metrics' || url.pathname === '/') {
      const healthData = await checkAllHealth();

      return new Response(JSON.stringify(healthData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (url.pathname === '/uptime') {
      if (!env.BYTEFORT_UPTIME) {
        return new Response(JSON.stringify({ error: 'Uptime KV binding is not configured' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
      return handleUptimeEndpoint(env.BYTEFORT_UPTIME);
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      try {
        const healthData = await checkAllHealth();
        if (!env.BYTEFORT_UPTIME) throw new Error('BYTEFORT_UPTIME binding is not configured');
        await Promise.all(healthData.services.map((service) =>
          recordUptime(env.BYTEFORT_UPTIME, service.name, service.healthy, service.checkedAt)
        ));
      } catch (err) {
        console.error('scheduled handler failed:', err);
      }
    })());
  },
};
