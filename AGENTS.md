# OMO Hustler Repository Guidance

This repository contains the standalone OpenCode edition of OMO Hustler. Do not describe or restore removed Codex, Senpi, Pi, native, Claude compatibility, Cursor, or web products in current documentation.

## Scope

- OpenCode adapter: `packages/omo-opencode/`
- Reusable packages: selected `packages/*-core/` packages
- User documentation: `docs/`
- Evidence and plans: `.omo/`

The build entry is `packages/omo-opencode/src/index.ts`. Keep OpenCode integration in the adapter and keep reusable logic independent of harness APIs.

## Required Checks

For adapter changes, run isolated OpenCode QA and record evidence under `.omo/evidence/`. For documentation-only changes, run the markdown link audit and the relevant repository gates. Never use real provider credentials or a real OpenCode database for QA.

```bash
bun test packages/omo-opencode/src/shared/markdown-link-audit.test.ts
bun test packages/omo-opencode/src
bun test script/
bun run typecheck
bun run build
GIT_MASTER=1 git diff --check
```

## Development Environment

`script/agent/setup.sh` is the single source of truth for the OpenCode development environment. Keep `script/agent/setup.sh`, `script/agent/cleanup.sh`, and `script/agent/qa-sandbox.sh` in sync with the OpenCode wiring. The supported health check is `omo doctor`.

The ignored `.env.example` pattern documents local credential injection. The `.devcontainer` setup is the supported container wiring. OpenCode (this plugin's own harness) is the only retained harness.

## Structure

```text
packages/omo-opencode/src/   OpenCode plugin, agents, hooks, tools, MCPs, and tests
packages/*-core/             Reusable TypeScript packages
docs/                        User guides, references, and legal notices
script/                      Build, test, and repository automation
.omo/evidence/               Reviewer-readable QA and migration records
```

## Documentation Rules

Keep claims current and operational. Local Markdown links must target checked-in files. Preserve legal attribution and do not modify `LICENSE.md` or `THIRD-PARTY-NOTICES.md`.

## Change Discipline

Do not add prose-contract tests. Do not weaken existing tests. Do not edit package identity, dependency metadata, or workflows as part of documentation cleanup unless a separate task explicitly requires it.
