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

// Maps a service subdomain (e.g. "jellyfin" from jellyfin.bytefort.xyz) to its
// canonical key in state.affectedServices. The root domain has no subdomain.
const SUBDOMAIN_SERVICE_MAP = {
  auth: 'auth',
  jellyfin: 'jellyfin',
  seerr: 'seerr',
  netbird: 'netbird',
  npm: 'npm',
  ripper: 'ripper',
  speedtest: 'speedtest',
  vault: 'vault',
  homeassistant: 'homeassistant'
};

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
        const res = await fetch(new Request(new URL('/admin/index.html', req.url), {
          headers: { 'Accept': 'text/html' }
        }));
        if (res.ok) {
          const modified = new Response(res.body, res);
          modified.headers.set('Cache-Control', 'no-store');
          modified.headers.set('X-BF-Protected', 'true');
          return modified;
        }
      } catch (e) {}
    }
  }

  // ── Maintenance gate ────────────────────────────────
  const state = await getState(kv);
  if (state.enabled && !req.headers.get('X-BF-Static')) {
    // For partial maintenance, let specific services through. Services live on
    // their own subdomains (jellyfin.bytefort.xyz), not on paths of the root
    // domain, so match against the hostname's subdomain.
    if (state.targetServices === 'partial' && state.affectedServices.length > 0) {
      const svcKey = SUBDOMAIN_SERVICE_MAP[subdomainOf(url.hostname)];
      if (svcKey && !state.affectedServices.includes(svcKey)) {
        // Forward with flag to prevent recursive loop through the worker
        const forwarded = new Request(req, {
          headers: { ...Object.fromEntries(req.headers.entries()), 'X-BF-Static': '1' }
        });
        return fetch(forwarded);
      }
    }

    // Serve maintenance page
    try {
      const res = await fetch(new Request(new URL('/maintenance/index.html', req.url), {
        headers: { 'Accept': 'text/html' }
      }), { cf: { cacheEverything: true } });
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

  // ── Proxy everything else ───────────────────────────
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
