#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

USE_HOST_AUTH=0
if [[ "${1:-}" == "--live" ]]; then
  USE_HOST_AUTH=1
  shift
fi

bun run --cwd "$REPO_ROOT" build

ROOT=$(mktemp -d)
cleanup() {
  local status=$?
  trap - EXIT INT TERM
  for _ in {1..20}; do
    rm -rf "$ROOT" 2>/dev/null && break
    sleep 0.1
  done
  exit "$status"
}
trap cleanup EXIT INT TERM
mkdir -p "$ROOT"/{config/opencode,data,cache,state,home,project}
printf '{"plugin":["file://%s/dist/index.js"]}\n' "$REPO_ROOT" \
  > "$ROOT/config/opencode/opencode.json"

if (( USE_HOST_AUTH )); then
  AUTH_SOURCE="${XDG_DATA_HOME:-$HOME/.local/share}/opencode/auth.json"
  if [[ ! -f "$AUTH_SOURCE" ]]; then
    printf 'No OpenCode auth file found at %s\n' "$AUTH_SOURCE" >&2
    exit 1
  fi
  mkdir -p "$ROOT/data/opencode"
  install -m 600 "$AUTH_SOURCE" "$ROOT/data/opencode/auth.json"
fi

export HOME="$ROOT/home"
export XDG_CONFIG_HOME="$ROOT/config"
export XDG_DATA_HOME="$ROOT/data"
export XDG_CACHE_HOME="$ROOT/cache"
export XDG_STATE_HOME="$ROOT/state"
export OPENCODE_DISABLE_AUTOUPDATE=1
export OPENCODE_DISABLE_MODELS_FETCH=1

opencode_args=("$ROOT/project")
if (($# > 0)); then
  opencode_args+=("$@")
fi
opencode "${opencode_args[@]}"
