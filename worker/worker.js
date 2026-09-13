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

async function pingHost(host, timeout) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    // Unique URL per check. Without this the edge serves a cached 200 and a
    // dead service keeps reporting online.
    const target = new URL(host);
    target.searchParams.set('_cb', Date.now().toString());

    const response = await fetch(target.toString(), {
      signal: controller.signal,
      redirect: 'manual',
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' },
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

export default {
  async fetch(request) {
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

    return new Response('Not Found', { status: 404 });
  },
};
