# Contributing to OMO Hustler

Thanks for helping improve the OpenCode-only OMO Hustler project. Keep changes focused, tested, and aligned with the workflow documented in [HUSTLER.md](HUSTLER.md).

## Prerequisites

- Bun 1.4.0
- Node 24 for vendored MCP tooling
- Git
- tmux for interactive terminal and Team Mode checks

## Setup

```bash
git clone https://github.com/code-yeongyu/oh-my-openagent.git
cd oh-my-openagent
bun install
bun run build
```

Use the repository's `script/agent/setup.sh` when a complete local bootstrap is needed. Never install dependencies with npm, yarn, or pnpm.

## Verification

Run focused tests first, then the relevant full gates:

```bash
bun test packages/omo-opencode/src
bun test script/
bun run typecheck
bun run build
git diff --check
```

OpenCode behavior must be checked in an isolated environment. Use the repository OpenCode QA instructions and record reviewer-readable evidence under `.omo/evidence/`. Never use a real user database, credentials, or provider session for QA.

The adapter registry is defined by `agentSources`, `tool-registry-factories`, and `createBuiltinMcps`, with `HookNameSchema` defining hook names and `@opencode-ai/sdk` providing the host types. Source plugin paths use the absolute `file:///` form. The legacy `test:codex` gate and `codex-qa` skill are not part of this OpenCode-only checkout; use the OpenCode source and script suites listed above. The `opencode-qa` skill documents isolated runtime checks.

## Development Environment

`script/agent/setup.sh` is the single source of truth for local setup. `script/agent/cleanup.sh` removes generated local state. Keep those scripts and the OpenCode wiring in sync. Credentials belong in the ignored `.env` file described by `.env.example`, and QA uses `script/agent/qa-sandbox.sh` with isolated XDG directories.

## Changes

- Keep OpenCode integration in `packages/omo-opencode/`.
- Keep reusable logic in the appropriate `packages/*-core` package.
- Add or update tests for runtime behavior, not authored prose.
- Update user documentation when public behavior changes.
- Preserve `LICENSE.md` and `THIRD-PARTY-NOTICES.md` exactly.

## Pull Requests

Describe the behavior changed, the verification run, and any residual risk. Target the repository's active development branch. Do not commit generated files unless the relevant build command is part of the change.

## Language and Conduct

Use clear English for issues, pull requests, code comments, and documentation. Be respectful, specific, and constructive.
