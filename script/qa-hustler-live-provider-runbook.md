# HUSTLER Real-Provider Supplemental Smoke Runbook

This is an optional operator check for the HUSTLER-native OpenCode workflow.
The deterministic fake-provider run remains the acceptance gate. A real-provider
run can add confidence about provider compatibility, but it never replaces the
fake-provider lifecycle driver or the isolated TUI driver.

## When to Run

Run this only after Tasks 10 and 11 are prepared and the built plugin is the
artifact under review. Run it once, for one short prompt, with a provider and
model approved for disposable smoke traffic. Do not use a production project,
production data, or a long-running agent task.

The run has a hard 10 minute wall-clock budget:

- 60 seconds to build and start the server.
- 30 seconds to confirm health, the roster, and the SSE connection.
- 90 seconds for one prompt and terminal workflow observation.
- 60 seconds for evidence writing and teardown.
- The remaining time is a safety margin. Abort when any individual wait reaches
  its limit. Do not extend a timed-out run by retrying against the provider.

## Prerequisites

- OpenCode and Bun are installed and the repository is clean enough to identify
  the artifact under review.
- A provider account and model are approved for this smoke run. The operator
  supplies authentication through the local secret manager or process
  environment. Never put a key, token, cookie, authorization header, or secret
  value in this runbook, a shell history, or evidence.
- `tmux`, `curl`, `jq`, `sqlite3`, and `timeout` are available.
- The evidence directory exists or can be created at:
  `.omo/evidence/20260923-hustler-live-opencode-e2e/`
- The operator has reviewed the fake-provider and TUI driver receipts first.

## Isolation Setup

Use a fresh temporary root. The server must bind to loopback only. Keep the
provider configuration in an untracked temporary file under that root. Inject
the provider secret at process start through the approved secret mechanism; do
not write the secret into the file shown below.

```bash
set -euo pipefail

REPO_ROOT="$(pwd)"
RUN_ROOT="$(mktemp -d /tmp/hustler-live-provider.XXXXXX)"
EVIDENCE_DIR="$REPO_ROOT/.omo/evidence/20260923-hustler-live-opencode-e2e"
PORT="${HUSTLER_QA_PORT:-43950}"
PROJECT_DIR="$RUN_ROOT/project"

mkdir -p "$RUN_ROOT"/{config/opencode,data,cache,state,home,project,tasks} \
  "$EVIDENCE_DIR"
trap 'status=$?; tmux kill-session -t hustler-live-provider 2>/dev/null || true; \
  if [ -n "${SERVER_PID:-}" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi; \
  rm -rf "$RUN_ROOT"; exit "$status"' EXIT INT TERM
```

Write a temporary OpenCode config containing only the local plugin artifact,
the approved real provider/model, and HUSTLER task storage under
`$RUN_ROOT/tasks`. Keep Team Mode disabled. The config must not reference the
operator's normal home, project, cache, state, or OpenCode database. Use the
repository build output, not a globally installed plugin copy.

Before starting the server, record a read-only baseline of the host OpenCode
session count in the evidence receipt. The baseline is a preservation check,
not a destination for this run. The real server must use only the temporary
XDG directories above.

## Bounded Command Sequence

Build the reviewed artifact:

```bash
timeout --signal=TERM --kill-after=5s 120s bun run build
```

Start the isolated, loopback-only server. Inject provider authentication through
the approved secret manager or an environment wrapper that is not recorded in
the shell transcript. The command below intentionally contains no provider
credential or local server credential.

```bash
timeout --signal=TERM --kill-after=5s 600s \
  env HOME="$RUN_ROOT/home" \
  XDG_CONFIG_HOME="$RUN_ROOT/config" \
  XDG_DATA_HOME="$RUN_ROOT/data" \
  XDG_CACHE_HOME="$RUN_ROOT/cache" \
  XDG_STATE_HOME="$RUN_ROOT/state" \
  OPENCODE_DISABLE_AUTOUPDATE=1 \
  OPENCODE_DISABLE_MODELS_FETCH=1 \
  opencode serve --hostname 127.0.0.1 --port "$PORT" \
  --directory "$PROJECT_DIR" \
  >"$RUN_ROOT/server.stdout" 2>"$RUN_ROOT/server.stderr" &
SERVER_PID=$!
```

The server is loopback-only and the temporary run must not put an auth header or
password into evidence. If the environment or provider setup requires
authenticated local HTTP, use the approved local harness without recording its
header. Never copy that header to the receipt.

Within the 60 second startup budget, confirm the following from a second shell:

```bash
timeout 5s curl --fail --silent "http://127.0.0.1:$PORT/global/health"
timeout 10s curl --fail --silent \
  "http://127.0.0.1:$PORT/agent?directory=$(printf '%s' "$PROJECT_DIR" | jq -sRr @uri)"
timeout 30s curl --fail --no-buffer --silent \
  "http://127.0.0.1:$PORT/event?directory=$(printf '%s' "$PROJECT_DIR" | jq -sRr @uri)" \
  >"$RUN_ROOT/sse.raw"
```

The SSE command is a bounded capture. Stop it after `server.connected` and the
prompt lifecycle have been observed, or when its 30 second limit expires. Do
not use pane text as the behavior oracle.

Launch the TUI in tmux with the same temporary environment and attach it to the
loopback server. The tmux session is only for boot and input smoke:

```bash
timeout --signal=TERM --kill-after=5s 90s tmux new-session -d -s hustler-live-provider \
  "env HOME='$RUN_ROOT/home' XDG_CONFIG_HOME='$RUN_ROOT/config' XDG_DATA_HOME='$RUN_ROOT/data' XDG_CACHE_HOME='$RUN_ROOT/cache' XDG_STATE_HOME='$RUN_ROOT/state' OPENCODE_DISABLE_AUTOUPDATE=1 OPENCODE_DISABLE_MODELS_FETCH=1 opencode --attach http://127.0.0.1:$PORT '$PROJECT_DIR'"
```

Use the TUI control API, not pane scraping, to append and submit one bounded
prompt. The prompt should request a small, reversible README inspection or
equivalent no-risk task. Do not ask the provider to modify host files or run
commands outside `$PROJECT_DIR`.

```bash
timeout 10s curl --fail --silent --request POST \
  --header 'content-type: application/json' \
  --header "x-opencode-directory: $PROJECT_DIR" \
  --data '{"text":"<short disposable HUSTLER smoke prompt>"}' \
  http://127.0.0.1:$PORT/tui/append-prompt
timeout 10s curl --fail --silent --request POST \
  --header "x-opencode-directory: $PROJECT_DIR" \
  --data '{}' \
  http://127.0.0.1:$PORT/tui/submit-prompt
```

Allow at most 90 seconds for the prompt. If the provider does not reach a
terminal observation in that window, abort the session, capture `BLOCKED`, and
tear down. Do not retry because a retry can incur additional provider cost and
can hide a timeout or rate-limit condition.

## Expected Observables

Record machine-readable, redacted summaries rather than raw transcripts.

1. **Health and loading:** `/global/health` reports healthy, and the server
   starts from the temporary XDG root.
2. **Roster:** `/agent` lists exactly the seven active HUSTLER roles,
   `Orchestrator`, `Planner`, `Developer`, `Tester`, `Approver`, `Librarian`,
   and `Architect`. No active legacy roster name or `team_*` tool name is
   accepted as a pass.
3. **SSE:** the per-instance `/event` stream contains `server.connected`,
   `session.created`, message activity such as `message.updated` or
   `message.part.updated`, and a terminal `session.idle` or `session.error`.
   Preserve event type and session ID only. Redact event properties.
4. **API:** the TUI control endpoints accept the prompt and submit it. A
   session or message lookup confirms the prompt reached the isolated project.
5. **Persisted workflow:** the HUSTLER task storage under `$RUN_ROOT/tasks`
   contains one workflow tied to the isolated session. Record only workflow ID,
   tier, phase, status, revision, and terminal outcome. A successful smoke
   normally reaches a terminal `complete` or `completed` state. A provider
   refusal, quota, authentication, or timeout is `BLOCKED`, not a product pass.
6. **TUI:** tmux proves that the TUI booted and accepted input. If rendered
   workflow state is claimed, use the existing web-terminal capture procedure
   and retain only its redacted artifacts.

## Abort, Cleanup, and Host Preservation

Abort immediately on a timeout, provider error, unexpected tool request, prompt
that leaves `$PROJECT_DIR`, or any output containing a secret. Send an abort to
the isolated session when possible, then stop the TUI and server. The `EXIT`
trap must run on success, assertion failure, `SIGINT`, `SIGTERM`, and timeout.

The cleanup receipt must show:

- the tmux session no longer exists;
- the server process and child processes have exited;
- `$RUN_ROOT` was removed;
- the host OpenCode SQLite session count is identical before and after;
- no host config, database, cache, state, or project path was written.

If any preservation check fails, mark the run `BLOCKED`, retain only the
minimal redacted diagnostic, and stop further provider traffic. Do not repair
host state as part of this runbook.

## Secret Redaction

Before writing evidence, remove provider names when they identify a private
account, model request bodies, API keys, bearer strings, cookies, authorization
headers, passwords, environment dumps, prompt contents that contain private
goal text, and raw server/provider logs. Keep only event types, opaque local
IDs, status fields, bounded timings, and redacted error classes. The evidence
directory must not contain the temporary config or raw logs.

## Evidence Receipt

Write a reviewer-readable receipt to:

`.omo/evidence/20260923-hustler-live-opencode-e2e/task-12-runbook.txt`

The receipt must contain these headings and machine-readable fields:

```text
WHAT WAS TESTED
status: PASS | BLOCKED
mode: supplemental-real-provider
build_command: <command with no secret values>
isolation_root: <redacted temporary-root marker>
prompt_budget_seconds: 90

WHAT WAS OBSERVED
health: pass | fail
roster: pass | fail
sse_types: [server.connected, ...]
api_control: pass | fail
workflow: {tier, phase, status, revision}
tui_boot_input: pass | fail
host_session_count: {before, after, unchanged}
cleanup: {tmux_removed, processes_stopped, sandbox_removed}

WHY IT IS ENOUGH
<How the bounded observations supplement, but do not replace, fake-provider coverage.>

WHAT WAS OMITTED
<Provider secret, auth material, raw logs, private prompt text, and any blocked
or unavailable prerequisite.>
```

`PASS` means every listed observable and preservation check passed within the
budget. `BLOCKED` means the provider prerequisite was unavailable or a bounded
observation could not be made. `BLOCKED` is an honest supplemental result and
does not weaken or bypass the deterministic fake-provider gate.

## Limitations

- One provider, one model, one short prompt, and one isolated session do not
  establish broad provider compatibility.
- A passing provider run cannot prove every lifecycle failure branch, retry
  path, cancellation path, or persistence recovery path. Those remain covered
  by deterministic tests and the fake-provider lifecycle driver.
- Provider latency, rate limits, permissions, tool policy, and service errors
  can produce `BLOCKED` without identifying a HUSTLER defect.
- Tmux boot/input smoke does not prove rendered visual fidelity. Use the
  existing web-terminal procedure when a visual claim is necessary.
- No real-provider call is made by the automated Wave 4 acceptance gate. The
  final gate must still include the fake-provider lifecycle receipt, the TUI
  driver receipt, and this runbook receipt, with any real-provider result
  reported separately as `PASS` or `BLOCKED`.
