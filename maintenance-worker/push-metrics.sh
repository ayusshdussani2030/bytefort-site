#!/usr/bin/env bash
# push-metrics.sh — reads basic system stats and pushes them to the
# bytefort.xyz dashboard. Run this on whichever machine you want metrics
# for (a VM, the hypervisor host, wherever) — see METRICS_SETUP.md for how
# to wire it up with cron.
#
# Grafana/Prometheus stay completely private — this script talks directly
# to the local OS, not to either of them. If you later want it to pull from
# Prometheus instead, swap the collection section below for a curl against
# your local Prometheus query API; the push-to-Worker part stays the same.
#
# Requires: bash, curl, awk, and standard Linux /proc + free + df.

set -euo pipefail

WORKER_URL="${WORKER_URL:-https://bytefort.xyz}"
METRICS_SECRET="${METRICS_SECRET:?Set METRICS_SECRET in the environment — see METRICS_SETUP.md}"

# CPU usage % — sampled over ~1s (a single /proc/stat read can't give a rate).
read -r _ u1 n1 s1 i1 io1 irq1 sirq1 _ < /proc/stat
sleep 1
read -r _ u2 n2 s2 i2 io2 irq2 sirq2 _ < /proc/stat
prev_idle=$((i1 + io1)); idle=$((i2 + io2))
prev_total=$((u1 + n1 + s1 + i1 + io1 + irq1 + sirq1))
total=$((u2 + n2 + s2 + i2 + io2 + irq2 + sirq2))
diff_idle=$((idle - prev_idle))
diff_total=$((total - prev_total))
cpu_pct=0
if [ "$diff_total" -gt 0 ]; then
  cpu_pct=$(awk "BEGIN { printf \"%.1f\", (1 - $diff_idle / $diff_total) * 100 }")
fi

# Memory usage %
mem_pct=$(free | awk '/Mem:/ { printf "%.1f", ($2-$7)/$2 * 100 }')

# Disk usage % (root filesystem — change the path if you care about a
# different mount, e.g. your media array)
disk_pct=$(df -P / | awk 'NR==2 { gsub("%","",$5); print $5 }')

# Load average (1 / 5 / 15 min)
load_avg=$(awk '{ print $1","$2","$3 }' /proc/loadavg)

# Uptime in seconds
uptime_seconds=$(awk '{ print int($1) }' /proc/uptime)

payload=$(cat <<JSON
{
  "cpu": $cpu_pct,
  "mem": $mem_pct,
  "disk": $disk_pct,
  "loadAvg": [$load_avg],
  "uptimeSeconds": $uptime_seconds
}
JSON
)

curl -sf -X POST "$WORKER_URL/api/bf/metrics" \
  -H "Content-Type: application/json" \
  -H "X-BF-Secret: $METRICS_SECRET" \
  -d "$payload" > /dev/null
