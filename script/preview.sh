#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

bun run --cwd "$REPO_ROOT" build

ROOT=$(mktemp -d)
trap 'rm -rf "$ROOT"' EXIT
mkdir -p "$ROOT"/{config/opencode,data,cache,state,home,project}
printf '{"plugin":["file://%s/dist/index.js"]}\n' "$REPO_ROOT" \
  > "$ROOT/config/opencode/opencode.json"

HOME="$ROOT/home" \
XDG_CONFIG_HOME="$ROOT/config" \
XDG_DATA_HOME="$ROOT/data" \
XDG_CACHE_HOME="$ROOT/cache" \
XDG_STATE_HOME="$ROOT/state" \
OPENCODE_DISABLE_AUTOUPDATE=1 \
OPENCODE_DISABLE_MODELS_FETCH=1 \
opencode "$ROOT/project"
