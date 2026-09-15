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

// Baseline start date — services have been running since before this.
const BASELINE_DATE = new Date('2024-03-01T00:00:00Z').getTime();

const UPTIME_INTERVAL_MS = 5 * 60 * 1000; // 5-minute cron cycles

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

async function getUptimeData(serviceName) {
  try {
    const raw = await BYTEFORT_UPTIME.get(UPTIME_KEY_PREFIX + serviceName);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

async function saveUptimeData(serviceName, data) {
  await BYTEFORT_UPTIME.put(
    UPTIME_KEY_PREFIX + serviceName,
    JSON.stringify(data),
    { expirationTtl: 60 * 60 * 24 * 90 } // 90-day TTL
  );
}

function calculateUptimePct(record) {
  if (!record) return 0;
  const now = Date.now();
  const totalMs = now - BASELINE_DATE;
  const uptimeMs = record.totalUptimeMs || 0;
  if (totalMs <= 0) return 0;
  return Math.round((uptimeMs / totalMs) * 100);
}

async function recordUptime(serviceName, healthy) {
  const record = await getUptimeData(serviceName);

  if (!record) {
    // First time seeing this service — initialize from baseline
    await saveUptimeData(serviceName, {
      totalUptimeMs: 0,
      lastCheck: new Date().toISOString(),
      lastStatus: healthy ? 'online' : 'offline',
      downtimeStart: healthy ? null : Date.now(),
      downtimeEvents: [],
    });
    return;
  }

  // Calculate time since last check
  const now = Date.now();
  const lastCheck = record.lastCheck ? new Date(record.lastCheck).getTime() : now;
  const elapsed = now - lastCheck;

  if (elapsed > 0) {
    if (healthy) {
      record.totalUptimeMs = (record.totalUptimeMs || 0) + elapsed;
    }
    // If not healthy, we accumulate downtime (don't add to uptime)
  }

  record.lastCheck = new Date().toISOString();
  record.lastStatus = healthy ? 'online' : 'offline';

  if (!healthy) {
    // Only push a new event when transitioning from up → down
    if (!record.downtimeStart) {
      record.downtimeStart = now;
      // Track downtime events (keep last 20 for dashboards)
      if (record.downtimeEvents.length < 20) {
        record.downtimeEvents.push({
          start: new Date(now).toISOString(),
          end: null,
        });
      }
    }
  } else if (record.downtimeStart) {
    // Service came back up — close the downtime event
    const downtimeMs = now - record.downtimeStart;
    if (record.downtimeEvents.length > 0) {
      const lastEvent = record.downtimeEvents[record.downtimeEvents.length - 1];
      lastEvent.end = new Date().toISOString();
      lastEvent.duration = downtimeMs;
    }
    record.downtimeStart = null;
  }

  await saveUptimeData(serviceName, record);
}

async function handleUptimeEndpoint() {
  const results = [];
  for (const target of TARGETS) {
    const record = await getUptimeData(target.name);
    const uptimePct = calculateUptimePct(record);

    results.push({
      name: target.name,
      uptimePct: uptimePct,
      totalUptimeMs: record?.totalUptimeMs || 0,
      lastCheck: record?.lastCheck || null,
      lastStatus: record?.lastStatus || 'unknown',
      downtimeStart: record?.downtimeStart || null,
      downtimeEvents: record?.downtimeEvents || [],
    });
  }

  return new Response(JSON.stringify({
    services: results,
    timestamp: new Date().toISOString(),
    overallUptime: Math.round(
      results.filter((r) => r.uptimePct >= 99).length / results.length * 100
    ),
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/health' || url.pathname === '/metrics' || url.pathname === '/') {
      const healthData = await checkAllHealth();

      // Record uptime for each service after checking
      for (const service of healthData.services) {
        recordUptime(service.name, service.healthy).catch(() => {});
      }

      return new Response(JSON.stringify(healthData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    if (url.pathname === '/uptime') {
      return await handleUptimeEndpoint();
    }

    return new Response('Not Found', { status: 404 });
  },

  async scheduled(event, env, ctx) {
    // Periodic accumulation cycle — check all services and record uptime
    ctx.waitUntil((async () => {
      try {
        const healthData = await checkAllHealth();
        for (const service of healthData.services) {
          await recordUptime(service.name, service.healthy);
        }
      } catch (err) {
        console.error('scheduled handler failed:', err);
      }
    })());
  },
};
