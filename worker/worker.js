/**
 * Health Check Worker
 * Pings your services and returns live status.
 *
 * Services behind the Authentik outpost (jellyfin, npm, ripper, seerr)
 * answer 302 to outpost.goauthentik.io whether or not the app is up.
 * To get a real signal, add an unauthenticated path in Authentik
 * (Applications > Providers > [provider] > Advanced protocol settings >
 * Unauthenticated Paths), then point the target url at that path:
 *   Jellyfin    ^/health$           -> https://jellyfin.bytefort.xyz/health
 *   Jellyseerr  ^/api/v1/status$    -> https://seerr.bytefort.xyz/api/v1/status
 */

const TARGETS = [
  { name: 'Authentik', url: 'https://auth.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Home Assistant', url: 'https://homeassistant.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Jellyfin', url: 'https://jellyfin.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Netbird', url: 'https://netbird.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Nginx Proxy Manager', url: 'https://npm.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Ripper', url: 'https://ripper.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Jellyseerr', url: 'https://seerr.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Speed Test', url: 'https://speedtest.bytefort.xyz', timeout: 5000, type: 'http' },
  { name: 'Vaultwarden', url: 'https://vault.bytefort.xyz', timeout: 5000, type: 'http' },
];

const AUTH_GATE = 'outpost.goauthentik.io';

let lastHealthData = null;

async function pingHost(host, timeout) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(host, {
      signal: controller.signal,
      redirect: 'manual',
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
  const start = performance.now();
  const healthy = await pingHost(target.url, target.timeout);
  const latency = Math.round(performance.now() - start);
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

  lastHealthData = {
    status: allHealthy ? 'healthy' : 'degraded',
    services: results,
    timestamp: new Date().toISOString(),
    overallUptime: Math.round(
      (results.filter((r) => r.healthy).length / results.length) * 100
    ),
  };

  return lastHealthData;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === '/health' || url.pathname === '/metrics' || url.pathname === '/') {
      const healthData = await checkAllHealth();
      return new Response(JSON.stringify(healthData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
