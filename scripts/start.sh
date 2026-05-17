#!/usr/bin/env sh
set -eu

echo "[start] Starting server"
exec bun .output/server/index.mjs
