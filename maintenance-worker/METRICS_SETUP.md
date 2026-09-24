# Homelab metrics — setup

Pushes basic system stats (CPU%, memory%, disk%, load average, uptime) from
your home server to the public dashboard, without exposing Grafana or
Prometheus to the internet. Grafana/Prometheus stay exactly as private as
they are now — this doesn't touch them.

## 1. Set the push secret (one-time, from your own machine)

Generate a random secret and store it as a Worker secret — separate from
your admin panel password, so this script only ever has permission to push
metrics, not to touch maintenance mode or anything else:

```bash
openssl rand -base64 24 | tr -dc 'A-Za-z0-9' | head -c 28
# copy the output, then:
npx wrangler secret put METRICS_SECRET --config maintenance-worker/wrangler.toml
# paste the value when prompted
```

## 2. Copy the script to your server

Copy `push-metrics.sh` to whatever machine you want metrics from (a VM,
your ESXi host if it has bash, wherever). Make it executable:

```bash
chmod +x push-metrics.sh
```

## 3. Set the secret on that machine and test it once

```bash
export METRICS_SECRET="the value you generated in step 1"
./push-metrics.sh
```

If it runs with no output and no error, it worked. Check
`https://bytefort.xyz/api/bf/metrics` in a browser — you should see your
numbers back.

## 4. Run it on a schedule

Add a cron entry (`crontab -e`) to run it every couple of minutes. Since
cron doesn't inherit your shell's environment variables, set
`METRICS_SECRET` inline or in a small env file:

```cron
*/2 * * * * METRICS_SECRET="the value from step 1" /path/to/push-metrics.sh >> /var/log/push-metrics.log 2>&1
```

Or, cleaner — keep the secret out of your crontab by sourcing an env file
first:

```bash
# /path/to/metrics.env  (chmod 600 this file)
export METRICS_SECRET="the value from step 1"
```

```cron
*/2 * * * * source /path/to/metrics.env && /path/to/push-metrics.sh >> /var/log/push-metrics.log 2>&1
```

## Later: pulling from Prometheus instead of raw OS stats

This first version reads straight from `/proc`, `free`, and `df` — it
doesn't depend on Prometheus or Grafana being up at all, which was the
point given you weren't sure they still work. Once you've confirmed
Prometheus is actually running and know what it's scraping, the collection
section in `push-metrics.sh` can be swapped for a `curl` against its local
query API (e.g. `curl http://localhost:9090/api/v1/query?query=...`) —
the push-to-Worker half doesn't need to change.
