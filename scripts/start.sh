#!/usr/bin/env sh
set -eu

echo "[start] Running database migrations"
bun ./scripts/migrate.mjs

echo "[start] Starting server"
exec bun .output/server/index.mjs
