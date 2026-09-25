# Installation and Local Runtime

OMO Hustler is retained as a private OpenCode-only project. There is no published
package, binary download, marketplace listing, or external installer.

## Prerequisites

- Bun
- OpenCode
- A local checkout of this repository

## Local development

From the repository root:

```bash
bun install
bun run typecheck
bun test packages/omo-opencode/src
bun run build
```

The supported local entrypoint is `hustler-opencode`. Use the repository scripts
and the built entrypoint from this checkout. See the [CLI reference](../reference/cli.md)
for the commands the retained adapter exposes.

## OpenCode runtime

OpenCode loads the adapter from the local development tree. Keep runtime checks
and QA isolated from your real OpenCode database and provider credentials. The
repository's OpenCode QA workflow records evidence under `.omo/evidence/`.

Configuration is documented in the [configuration reference](../reference/configuration.md).
The user configuration lives under `~/.omo`, and project overrides live under
`.omo/omo.jsonc`.

## Updating a checkout

Pull changes into the checkout, then repeat the local development commands above.
There is no separate upgrade command or package migration path.
