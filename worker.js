/**
 * Health Check Worker
 * 
 * Pings your services and returns live status.
 * Configure TARGETS below with the services you want to monitor.
 * 
 * Deployment:
 * 1. `npm install @cloudflare/wrangler` or use Cloudflare Dashboard
 * 2. `wrangler deploy` or paste into Cloudflare Worker editor
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

const CHECK_INTERVAL = 30; // seconds between checks

let lastHealthData = null;
let checkTimer = null;

async function pingHost(host, timeout) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(host, {
      signal: controller.signal,
      cf: {
        cacheEverything: true,
        cacheTtl: CHECK_INTERVAL,
      },
    });
    
    clearTimeout(timer);
    return response.ok;
  } catch (e) {
    return false;
  }
}

async function checkTarget(target) {
  const start = performance.now();
  
  if (target.type === 'http') {
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
  
  // For ping-style checks, we use a simple HTTP head to the host
  // Cloudflare Workers can't do raw ICMP, so we HTTP HEAD instead
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), target.timeout);
    
    const response = await fetch(`http://${target.url}`, {
      method: 'HEAD',
      signal: controller.signal,
    });
    
    clearTimeout(timer);
    const latency = Math.round(performance.now() - start);
    
    return {
      ...target,
      healthy: response.ok || response.status === 0, // status 0 = network success for head
      latency,
      status: response.ok || response.status === 0 ? 'online' : 'offline',
      checkedAt: new Date().toISOString(),
    };
  } catch (e) {
    const latency = Math.round(performance.now() - start);
    return {
      ...target,
      healthy: false,
      latency,
      status: 'offline',
      checkedAt: new Date().toISOString(),
    };
  }
}

async function checkAllHealth() {
  const results = await Promise.all(TARGETS.map(checkTarget));
  const allHealthy = results.every(r => r.healthy);
  
  lastHealthData = {
    status: allHealthy ? 'healthy' : 'degraded',
    services: results,
    timestamp: new Date().toISOString(),
    overallUptime: allHealthy ? 100 : Math.round(
      (results.filter(r => r.healthy).length / results.length) * 100
    ),
  };
  
  return lastHealthData;
}

// Check health on deployment and on each request
if (!checkTimer) {
  checkAllHealth();
}

export default {
  async fetch(request) {
    // Only GET /health endpoint
    const url = new URL(request.url);
    
    if (url.pathname === '/health' || url.pathname === '/metrics' || url.pathname === '/') {
      // Force a fresh check on each request
      const healthData = await checkAllHealth();
      
      return new Response(JSON.stringify(healthData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': `max-age=${CHECK_INTERVAL}`,
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
    
    return new Response('Not Found', { status: 404 });
  },
};
