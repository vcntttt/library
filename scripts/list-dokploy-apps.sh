#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd)"

if [[ -f "$ROOT_DIR/.env" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "$ROOT_DIR/.env"
	set +a
fi

if [[ -f "$ROOT_DIR/.env.local" ]]; then
	set -a
	# shellcheck disable=SC1091
	source "$ROOT_DIR/.env.local"
	set +a
fi

die() {
	echo "❌ $*" >&2
	exit 1
}

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || die "Falta el comando: $1"
}

require_cmd curl
require_cmd jq

DOKPLOY_BASE_URL="${DOKPLOY_BASE_URL:-}"
DOKPLOY_API_KEY="${DOKPLOY_API_KEY:-}"

[[ -n "$DOKPLOY_BASE_URL" ]] || die "Falta DOKPLOY_BASE_URL. Definila en .env o exportala."
[[ -n "$DOKPLOY_API_KEY" ]] || die "Falta DOKPLOY_API_KEY. Definila en .env o exportala."

RESP="$(
	curl -sS -X GET \
		"$DOKPLOY_BASE_URL/api/project.all" \
		-H 'accept: application/json' \
		-H "x-api-key: $DOKPLOY_API_KEY"
)"

if [[ -z "$RESP" ]]; then
	die "Dokploy no devolvió respuesta."
fi

echo "$RESP" | jq -r '
	[
		.[] as $project
		| ($project.name // "unknown") as $projectName
		| ($project.environments // [])[]
		| (.name // "unknown") as $environmentName
		| (.applications // [])[]
		| select(.applicationId != null and .applicationId != "")
		| {
			project: $projectName,
			environment: $environmentName,
			name: (.name // .appName // "unknown"),
			id: .applicationId
		}
	]
	| sort_by(.project, .environment, .name)
	| .[]
	| select(.id != "")
	| "\(.project)/\(.environment)/\(.name):\(.id)"
'
