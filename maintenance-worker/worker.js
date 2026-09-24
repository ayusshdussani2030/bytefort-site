// worker.js — bytefort.xyz maintenance gate + admin API
// Bind BYTEFORT_MAINT (KV namespace) in wrangler.toml
// Set the admin password as a secret, not in source: `wrangler secret put ADMIN_PASSWORD`

const MAX_API_ATTEMPTS = 10; // per minute

// ── Helpers ─────────────────────────────────────────────
function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

function getSecret(req) {
  return req.headers.get('X-BF-Secret') || '';
}

// The root domain has no real network origin — it's served entirely from
// Cloudflare's edge via the ASSETS binding (see [assets] in wrangler.toml).
function fetchAsset(env, req, pathname) {
  return env.ASSETS.fetch(new Request(new URL(pathname, req.url), {
    headers: { Accept: 'text/html' }
  }));
}

// Password-only auth (admin is served through Cloudflare — no IP filtering needed)
function checkAdminAuth(req, env) {
  if (!env.ADMIN_PASSWORD || getSecret(req) !== env.ADMIN_PASSWORD) return json({ error: 'invalid-password' }, 401);
  return null;
}

// Rate limit: max attempts per minute
const rateLimits = new Map();
function checkRateLimit(name) {
  const key = name || 'default';
  const now = Date.now();
  let entries = rateLimits.get(key) || [];
  entries = entries.filter(t => now - t < 60000);
  if (entries.length >= MAX_API_ATTEMPTS) return json({ error: 'rate-limited' }, 429);
  entries.push(now);
  rateLimits.set(key, entries);
  return null;
}

// ── KV access ───────────────────────────────────────────
async function getState(kv) {
  try {
    const raw = await kv.get('maintenance:state', 'json');
    if (raw) return raw;
  } catch (e) {}
  return {
    enabled: false,
    message: 'Hey — we\'re doing some maintenance on the homelab. Everything will be back up in a few hours.',
    estimatedRestore: null,
    targetServices: 'all',
    affectedServices: [],
    activatedAt: null,
    activatedBy: 'admin'
  };
}

async function putState(kv, state) {
  await kv.put('maintenance:state', JSON.stringify(state));
}

// ── Services (dashboard app list) ────────────────────────
// Editable from the admin panel's Applications section. Falls back to this
// built-in list until an admin saves their own (kept in sync with the
// original hardcoded SERVICES array in script.js).
const DEFAULT_SERVICES = [
  { name: 'Authentik', url: 'https://auth.bytefort.xyz', cat: 'infrastructure', desc: 'Identity and access management. Single sign-on for all your services.', icon: 'shield' },
  { name: 'Home Assistant', url: 'https://homeassistant.bytefort.xyz', cat: 'infrastructure', desc: 'Open-source home automation platform. Control and automate your smart home.', icon: 'home' },
  { name: 'Jellyfin', url: 'https://jellyfin.bytefort.xyz', cat: 'media', desc: 'Open-source media streaming server. Movies, TV, music — streamed privately.', icon: 'play' },
  { name: 'Netbird', url: 'https://netbird.bytefort.xyz', cat: 'infrastructure', desc: 'Self-hosted VPN and remote access. Secure mesh networking for all devices.', icon: 'globe' },
  { name: 'Nginx Proxy Manager', url: 'https://npm.bytefort.xyz', cat: 'network', desc: 'Reverse proxy and SSL management. Routes all bytefort subdomains with HTTPS.', icon: 'proxy' },
  { name: 'Ripper', url: 'https://ripper.bytefort.xyz', cat: 'media', desc: 'Media ripping and conversion. Transcode and organize your media library.', icon: 'disc' },
  { name: 'Jellyseerr', url: 'https://seerr.bytefort.xyz', cat: 'media', desc: 'Media request and discovery. Request, track, and auto-download content.', icon: 'chat' },
  { name: 'Speed Test', url: 'https://speedtest.bytefort.xyz', cat: 'network', desc: 'Self-hosted network speed test. Measure upload, download, and latency.', icon: 'gauge' },
  { name: 'Vaultwarden', url: 'https://vault.bytefort.xyz', cat: 'infrastructure', desc: 'Self-hosted password vault. Secure credential management for your family.', icon: 'lock' }
];

async function getServices(kv) {
  try {
    const raw = await kv.get('services:list', 'json');
    if (Array.isArray(raw) && raw.length) return raw;
  } catch (e) {}
  return DEFAULT_SERVICES;
}

async function putServices(kv, services) {
  await kv.put('services:list', JSON.stringify(services));
}

const ROOT_HOSTS = new Set(['bytefort.xyz', 'www.bytefort.xyz']);

function subdomainOf(hostname) {
  const host = hostname.toLowerCase();
  if (ROOT_HOSTS.has(host)) return '';
  return host.endsWith('.bytefort.xyz') ? host.slice(0, -'.bytefort.xyz'.length) : host;
}

// ── Request handler ─────────────────────────────────────
async function handleRequest(req, env) {
  const url = new URL(req.url);
  const kv = env.BYTEFORT_MAINT;
  const isRootHost = ROOT_HOSTS.has(url.hostname.toLowerCase());

  // Admin panel and admin API only ever apply to the root domain — this worker
  // also fronts service subdomains (e.g. vault.bytefort.xyz), and some of those
  // services have their own native /admin route (Vaultwarden) that must not be
  // shadowed.
  if (isRootHost) {
    // ── Admin auth endpoint ─────────────────────────────
    if (url.pathname === '/api/bf/admin/login' && req.method === 'POST') {
      const rateErr = checkRateLimit('admin-login');
      if (rateErr) return rateErr;
      try {
        const body = await req.json();
        if (env.ADMIN_PASSWORD && body.password === env.ADMIN_PASSWORD) {
          return json({ success: true, token: env.ADMIN_PASSWORD });
        }
        return json({ error: 'invalid-password' }, 401);
      } catch (e) {
        return json({ error: 'bad-request' }, 400);
      }
    }

    // ── API routes (require auth) ───────────────────────
    const adminPaths = [
      '/api/bf/maintenance/toggle',
      '/api/bf/maintenance/message',
      '/api/bf/maintenance/services'
    ];

    const isAdminRoute = adminPaths.some(p => url.pathname.startsWith(p));

    if (isAdminRoute) {
      const authErr = checkAdminAuth(req, env);
      if (authErr) return authErr;
      const rateErr = checkRateLimit('admin-api');
      if (rateErr) return rateErr;

      const body = await req.json().catch(() => ({}));
      const state = await getState(kv);
      const now = new Date().toISOString();

      if (url.pathname === '/api/bf/maintenance/toggle') {
        if (body.enabled === undefined) return json({ error: 'enabled-required' }, 400);
        state.enabled = body.enabled;
        state.activatedAt = now;
        state.activatedBy = body.activatedBy || 'admin';
        if (!body.enabled) {
          state.estimatedRestore = null;
        } else if (!state.estimatedRestore || new Date(state.estimatedRestore) < new Date()) {
          const hours = body.durationHours || 2;
          state.estimatedRestore = new Date(Date.now() + hours * 3600000).toISOString();
        }
        if (body.message !== undefined) state.message = body.message;
        if (body.targetServices) {
          state.targetServices = body.targetServices;
          state.affectedServices = body.affectedServices || [];
        }
        await putState(kv, state);
        return json({ success: true, state });
      }

      if (url.pathname === '/api/bf/maintenance/message') {
        if (body.message !== undefined) state.message = body.message;
        if (body.durationHours && body.durationHours > 0) {
          state.estimatedRestore = new Date(Date.now() + body.durationHours * 3600000).toISOString();
        }
        await putState(kv, state);
        return json({ success: true });
      }

      if (url.pathname === '/api/bf/maintenance/services') {
        if (body.target) {
          state.targetServices = body.target;
          if (body.services) state.affectedServices = body.services;
        }
        await putState(kv, state);
        return json({ success: true });
      }
    }

    // ── Applications (dashboard app list) ────────────────
    // GET is public — the dashboard itself needs this to render cards.
    if (url.pathname === '/api/bf/apps' && req.method === 'GET') {
      return json({ services: await getServices(kv) });
    }

    if (url.pathname === '/api/bf/apps' && req.method === 'POST') {
      const authErr = checkAdminAuth(req, env);
      if (authErr) return authErr;
      const rateErr = checkRateLimit('admin-api');
      if (rateErr) return rateErr;

      const body = await req.json().catch(() => ({}));
      if (!Array.isArray(body.services)) return json({ error: 'services-required' }, 400);
      for (const s of body.services) {
        if (!s.name || !s.url || !s.cat) {
          return json({ error: 'invalid-service', detail: 'each service needs name, url, and cat' }, 400);
        }
        try { new URL(s.url); } catch (e) {
          return json({ error: 'invalid-url', detail: s.url }, 400);
        }
      }
      await putServices(kv, body.services);
      return json({ success: true, services: body.services });
    }

    // ── Public status endpoint (no auth needed) ─────────
    if (url.pathname === '/api/bf/maintenance/status') {
      const state = await getState(kv);
      return json({
        enabled: state.enabled,
        message: state.message,
        estimatedRestore: state.estimatedRestore,
        targetServices: state.targetServices,
        affectedServices: state.affectedServices,
        activatedAt: state.activatedAt,
        timeRemaining: state.estimatedRestore
          ? Math.max(0, new Date(state.estimatedRestore).getTime() - Date.now())
          : null
      });
    }

    // ── Serve admin panel ───────────────────────────────
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      try {
        const res = await fetchAsset(env, req, '/admin/index.html');
        if (res.ok) {
          const modified = new Response(res.body, res);
          modified.headers.set('Cache-Control', 'no-store');
          modified.headers.set('X-BF-Protected', 'true');
          return modified;
        }
      } catch (e) {}
    }

    // ── Full maintenance takes over the whole dashboard ──
    // Partial maintenance (specific services only) leaves the dashboard live —
    // index.html's own status poll shows a lighter in-page notice instead.
    const state = await getState(kv);
    if (state.enabled && state.targetServices !== 'partial') {
      try {
        const res = await fetchAsset(env, req, '/maintenance/index.html');
        if (res.ok) {
          const modified = new Response(res.body, res);
          modified.headers.set('Cache-Control', 'public, max-age=60');
          return modified;
        }
      } catch (e) {}

      // Fallback
      return new Response(
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>[bf].xyz — Maintenance</title>' +
        '<style>*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}body{font-family:system-ui,sans-serif;background:#05070b;color:#e2e8f0;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}' +
        '.container{text-align:center;max-width:500px}.badge{display:inline-block;font-family:monospace;font-size:.75rem;letter-spacing:.15em;color:#fcd34d;border:1px solid rgba(252,211,77,.3);padding:.3em .9em;border-radius:999px;margin-bottom:2rem}.title{font-size:2.5rem;font-weight:700;margin-bottom:1rem;line-height:1.2}.desc{color:#94a3b8;line-height:1.7;margin-bottom:2rem}.meta{font-family:monospace;font-size:.75rem;color:#64748b;border-top:1px solid rgba(100,116,139,.15);padding-top:1.5rem}</style></head>' +
        '<body><div class="container"><div class="badge">UNDER MAINTENANCE</div><h1 class="title">' +
        (state.message || 'Under Maintenance') + '</h1><div class="meta">Maintenance in progress</div></div></body></html>',
        { status: 200, headers: { 'Content-Type': 'text/html' } }
      );
    }

    // Normal dashboard — served entirely from Cloudflare's edge via the
    // ASSETS binding (the root domain has no network origin).
    return env.ASSETS.fetch(req);
  }

  // ── Service subdomains (jellyfin.bytefort.xyz, vault.bytefort.xyz, …) ──
  // These have a real network origin (the wildcard A record), so normally we
  // just proxy through. During maintenance that targets this service — or
  // maintenance targeting "all" — redirect to the dashboard instead of
  // letting visitors hit a dead/unreachable origin.
  const svcKey = subdomainOf(url.hostname);
  if (svcKey) {
    const state = await getState(kv);
    const gated = state.enabled &&
      (state.targetServices !== 'partial' || state.affectedServices.includes(svcKey));
    if (gated) {
      return Response.redirect(`https://bytefort.xyz/?service=${svcKey}`, 302);
    }
  }

  return fetch(req);
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, X-BF-Secret',
          'Access-Control-Max-Age': '86400'
        }
      });
    }
    try {
      return await handleRequest(req, env);
    } catch (err) {
      console.error('Worker error:', err);
      return json({ error: 'internal-error', message: err.message }, 500);
    }
  }
};
