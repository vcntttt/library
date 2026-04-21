#!/usr/bin/env bash
set -euo pipefail

# Carga variables desde .env si existe (en la misma carpeta del repo)
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$ROOT_DIR/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "$ROOT_DIR/.env"
	set +a
fi

# =========================
# Config
# =========================
DOKPLOY_BASE_URL="${DOKPLOY_BASE_URL:-}"
DOKPLOY_API_KEY="${DOKPLOY_API_KEY:-}"
DOKPLOY_APP_ID="${DOKPLOY_APP_ID:-}"

# Git
GIT_REMOTE="${GIT_REMOTE:-origin}"
BRANCH="${BRANCH:-$(git rev-parse --abbrev-ref HEAD)}"

# =========================
# Helpers
# =========================
die() {
	echo "❌ $*" >&2
	exit 1
}
info() { echo "ℹ️  $*"; }
ok() { echo "✅ $*"; }

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || die "Falta el comando: $1"
}

# =========================
# Preconditions
# =========================
require_cmd git
require_cmd curl
require_cmd jq
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "No estás dentro de un repo git."

[[ -n "$DOKPLOY_BASE_URL" ]] || die "Falta DOKPLOY_BASE_URL. Definila en .env o exportala."
[[ -n "$DOKPLOY_API_KEY" ]] || die "Falta DOKPLOY_API_KEY. Definila en .env o exportala."
[[ -n "$DOKPLOY_APP_ID" ]] || die "Falta DOKPLOY_APP_ID. Definila en .env o exportala."

# Confirmación si hay cambios sin confirmar
if [[ -n "$(git status --porcelain)" ]]; then
	info "Hay cambios sin confirmar en el repositorio."
	git status -sb
	read -r -p "¿Querés continuar con el despliegue igual? [y/N]: " CONFIRM_DEPLOY
	case "${CONFIRM_DEPLOY,,}" in
	y | yes | s | si) ;;
	*) die "Despliegue cancelado para que puedas commitear primero." ;;
	esac
fi

# =========================
# 1) Git push
# =========================
# Si no hay upstream, lo seteamos al remoto/branch
UPSTREAM="$(git rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>/dev/null || true)"
if [[ -z "$UPSTREAM" ]]; then
	info "No hay upstream para $BRANCH. Seteando upstream a $GIT_REMOTE/$BRANCH"
	git push -u "$GIT_REMOTE" "$BRANCH"
else
	info "Push a $UPSTREAM"
	git push
fi

ok "Git push listo"

# =========================
# 2) Trigger Dokploy deploy
# =========================
info "Dokploy deploy: appId=$DOKPLOY_APP_ID"
RESP="$(
	curl -sS -X POST \
		"$DOKPLOY_BASE_URL/api/application.deploy" \
		-H 'accept: application/json' \
		-H 'Content-Type: application/json' \
		-H "x-api-key: $DOKPLOY_API_KEY" \
		-d "{\"applicationId\":\"$DOKPLOY_APP_ID\"}"
)"

echo "$RESP" | jq .
ok "Dokploy deploy triggereado"
