#!/bin/sh
set -eu

if [ -n "${TAILSCALE_AUTHKEY:-}" ]; then
  tailscaled \
    --state=mem: \
    --socket=/var/run/tailscale/tailscaled.sock \
    >/tmp/tailscaled.log 2>&1 &

  attempts=0
  until tailscale --socket=/var/run/tailscale/tailscaled.sock up \
    --auth-key="${TAILSCALE_AUTHKEY}" \
    --hostname=archon-fly-gateway \
    --accept-dns=false; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "Tailscale could not connect to the tailnet." >&2
      exit 1
    fi
    sleep 1
  done
fi

exec runuser -u archon -- /app/backend/archon-backend
