# script/ - Build and Repository Automation

The `script/` directory contains the build, schema, package-layout, and
repository-invariant automation for the private OpenCode-only OMO Hustler
checkout. The root `scripts/` directory contains standalone Node helpers.

## Important Scripts

- `build.ts` builds the retained OpenCode adapter and Hustler package.
- `build-schema.ts` and `build-omo-schema.ts` regenerate the checked-in local
  schema artifacts.
- `build-help-schemas.ts` regenerates CLI help schemas.
- `build-model-capabilities.ts` refreshes the model capability snapshot.
- `ci-fast-path.mjs` classifies the lightweight versus heavy CI path.
- `package-layout.test.ts` and `package-registration-audit.test.ts` guard the
  retained workspace and package file lists.
- `qa-hustler-topology.mjs` checks the retained HUSTLER package topology.

## Rules

- Keep automation limited to local OpenCode/Hustler validation.
- Do not add publishing, marketplace, deployment, or other distribution paths.
- Generated artifacts must be regenerated rather than hand-edited.
- Repository checks must not use real provider credentials or a real OpenCode
  database.

## Verification

Run focused script tests for the files changed, followed by `bun run typecheck`
and `bun run build` when the build graph or generated artifacts change.
