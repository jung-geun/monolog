#!/bin/bash
set -euo pipefail

# Host cron owns scheduling; the registry lease also fences GitHub invocations.
LOCK_DIR="${XDG_CACHE_HOME:-$HOME/.cache}/monolog"
mkdir -p "$LOCK_DIR"
exec 9>"$LOCK_DIR/content-sync.lock"
/usr/bin/flock -n 9

# Trusted, shell-compatible host configuration. Do not export or log secrets.
. /app/monolog/.env
: "${REVALIDATE_SECRET:?REVALIDATE_SECRET is required}"

# Keep the bearer token off curl's command line and out of process listings.
printf 'Authorization: Bearer %s\n' "$REVALIDATE_SECRET" |
  /usr/bin/curl --fail-with-body --silent --show-error \
    --request POST \
    --connect-timeout 15 --max-time 900 \
    --header @- \
    http://127.0.0.1:3000/api/cron/content
printf '\n'
