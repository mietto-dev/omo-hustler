#!/usr/bin/env bash
# QA isolation helper. SOURCE this file (do not execute it) to export a
# throwaway OpenCode environment so QA never reads or writes your real
# host config:
#
#   source script/agent/qa-sandbox.sh
#
# It mirrors the opencode-qa isolated-XDG convention: every path lands under a
# fresh mktemp dir, so the running machine's ~/.config/opencode is untouched.
#
# Intentionally does NOT set -e: sourcing must not change the caller's shell.

OMO_QA_ROOT="$(mktemp -d -t omo-qa-sandbox.XXXXXX)"
export OMO_QA_ROOT

# OpenCode: isolated XDG dirs (never the host ~/.config or ~/.local/share).
export XDG_DATA_HOME="$OMO_QA_ROOT/data"
export XDG_CONFIG_HOME="$OMO_QA_ROOT/config"
export XDG_CACHE_HOME="$OMO_QA_ROOT/cache"
export XDG_STATE_HOME="$OMO_QA_ROOT/state"
mkdir -p "$XDG_DATA_HOME" "$XDG_CONFIG_HOME" "$XDG_CACHE_HOME" "$XDG_STATE_HOME"
export OPENCODE_DISABLE_AUTOUPDATE=1
export OPENCODE_DISABLE_MODELS_FETCH=1

# Credentials, set once: inject keys from the gitignored .env (see .env.example).
# ${BASH_SOURCE[0]:-$0} resolves this file under both bash and zsh (sourced $0).
_omo_self="${BASH_SOURCE[0]:-$0}"
_omo_repo_root="$(cd "$(dirname "$_omo_self")/../.." && pwd)"
if [ -f "$_omo_repo_root/.env" ]; then
  case "$-" in *a*) _omo_had_allexport=1 ;; *) _omo_had_allexport=0 ;; esac
  set -a
  # shellcheck disable=SC1091
  . "$_omo_repo_root/.env"
  [ "$_omo_had_allexport" = "1" ] || set +a
  unset _omo_had_allexport
fi
unset _omo_self _omo_repo_root

printf '[qa-sandbox] isolated env ready under %s\n' "$OMO_QA_ROOT"
printf '[qa-sandbox]   XDG_CONFIG_HOME=%s\n' "$XDG_CONFIG_HOME"
printf '[qa-sandbox] host ~/.config/opencode is untouched. Clean up: rm -rf "%s"\n' "$OMO_QA_ROOT"
