import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(new URL('./worker.js', import.meta.url), 'utf8');
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const start = Date.parse('2026-09-17T00:00:00Z');
const hour = 60 * 60 * 1000;

function harness(t, initial = null) {
  t.mock.timers.enable({ apis: ['Date'], now: start });
  const offline = new Set();
  t.mock.method(globalThis, 'fetch', async (url) => new Response('', { status: offline.has(url) ? 503 : 200 }));
  let record = initial;
  let reads = 0;
  let writes = 0;
  const env = {
    BYTEFORT_UPTIME: {
      async get(key) { assert.equal(key, 'status'); reads++; return record; },
      async put(key, value, ...options) {
        assert.equal(key, 'status');
        assert.deepEqual(options, []);
        writes++;
        record = value;
      },
    },
  };
  return {
    offline,
    env,
    get reads() { return reads; },
    get writes() { return writes; },
    get record() { return record; },
    at(hours) { t.mock.timers.setTime(start + hours * hour); },
    async run() {
      let pending;
      await worker.scheduled({}, env, { waitUntil(promise) { pending = promise; } });
      await pending;
    },
    async uptime() {
      const response = await worker.fetch(new Request('https://example.test/uptime'), env);
      assert.equal(response.status, 200);
      return response.json();
    },
  };
}

test('writes only initialization and flips; retains downtime and independent service history', async (t) => {
  const h = harness(t);
  await h.run();
  assert.equal(h.writes, 1);
  assert.equal(h.reads, 1);
  const initial = h.record;
  const first = await h.uptime();
  assert.equal(first.services[0].uptimePct, null); // No elapsed observation yet.

  h.at(24);
  await h.run();
  assert.equal(h.writes, 1); // No heartbeat, even after a day.
  assert.equal(h.record, initial);
  assert.equal((await h.uptime()).services[0].uptimePct, 100);

  h.offline.add('https://jellyfin.bytefort.xyz/health');
  await h.run();
  assert.equal(h.writes, 2);
  h.at(30);
  await h.run();
  assert.equal(h.writes, 2); // Stable offline also does not write.
  let data = await h.uptime();
  let jellyfin = data.services.find((service) => service.name === 'Jellyfin');
  assert.equal(jellyfin.totalUptimeMs, 24 * hour);
  assert.equal(jellyfin.uptimePct, 24 / 30 * 100);
  assert.equal(jellyfin.downtimeStart, new Date(start + 24 * hour).toISOString());

  h.offline.add('https://speedtest.bytefort.xyz');
  await h.run();
  assert.equal(h.writes, 3);
  data = await h.uptime();
  jellyfin = data.services.find((service) => service.name === 'Jellyfin');
  assert.equal(jellyfin.downtimeStart, new Date(start + 24 * hour).toISOString());
  assert.equal(data.services.find((service) => service.name === 'Authentik').uptimePct, 100);

  h.at(36);
  h.offline.clear();
  await h.run();
  assert.equal(h.writes, 4); // Multiple recoveries in one check use one write.
  h.at(48);
  data = await h.uptime();
  jellyfin = data.services.find((service) => service.name === 'Jellyfin');
  assert.equal(jellyfin.uptimePct, 36 / 48 * 100);
  assert.equal(jellyfin.trackingStart, new Date(start).toISOString());
  assert.equal(jellyfin.downtimeStart, null);
  assert.equal(data.trackingDays, 2);
  assert.equal(data.estimation, 'last-recorded-state');

  for (const path of ['/', '/health', '/metrics', '/uptime']) {
    const response = await worker.fetch(new Request(`https://example.test${path}`), h.env);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
  }
  assert.equal(h.writes, 4); // Traffic cannot write.
});

test('initially offline services accrue no uptime until recovery', async (t) => {
  const h = harness(t);
  h.offline.add('https://jellyfin.bytefort.xyz/health');
  await h.run();
  h.at(2);
  assert.equal((await h.uptime()).services.find((s) => s.name === 'Jellyfin').totalUptimeMs, 0);
  h.offline.clear();
  await h.run();
  h.at(4);
  assert.equal((await h.uptime()).services.find((s) => s.name === 'Jellyfin').uptimePct, 50);
  assert.equal(h.writes, 2);
});

test('legacy and invalid snapshots are unknown until one initialization write', async (t) => {
  const h = harness(t);
  await h.run();
  const valid = JSON.parse(h.record);
  const future = { ...valid, checkedAt: new Date(start + hour).toISOString() };
  const negative = structuredClone(valid);
  negative.accounting.Jellyfin.totalUptimeMs = -1;
  const legacy = { checkedAt: new Date(start - hour).toISOString(), services: valid.services };
  for (const record of [null, 'bad json', 'null', JSON.stringify(legacy), JSON.stringify(future), JSON.stringify(negative)]) {
    let stored = record;
    let writes = 0;
    const env = { BYTEFORT_UPTIME: {
      get: async () => stored,
      put: async (key, value) => { stored = value; writes++; },
    } };
    const response = await worker.fetch(new Request('https://example.test/uptime'), env);
    const data = await response.json();
    assert.equal(data.overallUptime, null);
    assert.equal(data.trackedServices, 0);
    assert.equal(writes, 0);
    let pending;
    await worker.scheduled({}, env, { waitUntil(promise) { pending = promise; } });
    await pending;
    assert.equal(writes, 1);
    assert.equal(JSON.parse(stored).accounting.Jellyfin.trackingStart, new Date(start).toISOString());
  }
});

test('dashboard ticks locally, accepts old transition timestamps, and stops on fetch failure', async () => {
  const script = await readFile(new URL('../script.js', import.meta.url), 'utf8');
  const uptimeCode = script.split('// ── Historical Uptime')[1].split('// ── Scroll Progress')[0];
  // Start at the IIFE rather than the decorative section heading.
  const code = uptimeCode.slice(uptimeCode.indexOf('(function ()'));
  let now = start + 24 * hour;
  let requests = 0;
  let fail = false;
  const sample = {
    estimation: 'last-recorded-state',
    timestamp: new Date(now).toISOString(),
    services: [{
      name: 'Jellyfin', lastStatus: 'online', totalUptimeMs: 12 * hour,
      observationMs: 24 * hour, trackingStart: new Date(start).toISOString(),
      lastCheck: new Date(start + 12 * hour).toISOString(),
    }],
  };
  const nodes = Object.fromEntries(['uptimePct', 'uptimeSuf', 'uptimeDays'].map((id) => [id, {}]));
  const props = new Map();
  const card = { dataset: { name: 'Jellyfin' }, style: {
    setProperty: (key, value) => props.set(key, value),
    removeProperty: (key) => props.delete(key),
  } };
  const intervals = new Map();
  class Clock extends Date { static now() { return now; } }
  vm.runInNewContext(code, {
    SERVICES: [{ name: 'Jellyfin' }], Date: Clock, AbortController,
    document: { getElementById: (id) => nodes[id], querySelectorAll: () => [card] },
    fetch: async () => { requests++; if (fail) throw new Error('offline'); return { ok: true, json: async () => sample }; },
    setTimeout, clearTimeout, setInterval: (callback, delay) => intervals.set(delay, callback),
    console: { warn() {} },
  });
  await new Promise(setImmediate);
  assert.equal(nodes.uptimePct.textContent, '50.00');
  assert.equal(nodes.uptimeDays.textContent, '1.0');
  now += 10 * 60 * 1000;
  intervals.get(1000)();
  assert.ok(Number(nodes.uptimePct.textContent) > 50);
  assert.equal(requests, 1);
  assert.ok(props.has('--uptime-pct'));

  fail = true;
  await intervals.get(120000)();
  assert.equal(nodes.uptimePct.textContent, '—');
  assert.equal(nodes.uptimeSuf.hidden, true);
  assert.equal(props.has('--uptime-pct'), false);
  intervals.get(1000)();
  assert.equal(nodes.uptimePct.textContent, '—');

  fail = false;
  sample.timestamp = new Date(now).toISOString();
  sample.services[0].lastCheck = sample.services[0].trackingStart;
  await intervals.get(120000)();
  assert.equal(nodes.uptimePct.textContent, '50.00'); // Initialization timestamp is valid.
  now += 16 * 60 * 1000;
  intervals.get(1000)();
  assert.equal(nodes.uptimePct.textContent, '—'); // Do not tick a cached sample forever.

  sample.timestamp = new Date(now - 14 * 60 * 1000).toISOString();
  await intervals.get(120000)();
  assert.notEqual(nodes.uptimePct.textContent, '—'); // Aged but still within the freshness limit.
  now += 2 * 60 * 1000;
  intervals.get(1000)();
  assert.equal(nodes.uptimePct.textContent, '—'); // Age at receipt counts toward expiry too.
  assert.equal(nodes.uptimeSuf.hidden, true);
  assert.equal(props.has('--uptime-pct'), false);
});
