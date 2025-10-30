#!/usr/bin/env bash
set -euo pipefail

: "${BACKEND_URL:=http://localhost:8000}"

echo "[entrypoint] Using BACKEND_URL=$BACKEND_URL"

# Render nginx config from template
envsubst '$BACKEND_URL' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/conf.d/default.conf

nginx -g 'daemon off;'

