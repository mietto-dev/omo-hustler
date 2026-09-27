# Configuration Reference

OMO Hustler is configured through the retained OpenCode adapter. It is a
private local checkout and has no installer-managed or multi-harness
configuration surface.

## Configuration files

- User configuration: `~/.omo/omo.jsonc`
- Project configuration: `.omo/omo.jsonc`

Project files are discovered from the current directory toward the home
directory. The nearest project file has the highest precedence. JSONC comments
and trailing commas are supported.

## Core settings

The configuration supports categories, agents, model catalogs, task execution,
teams, and the `[opencode]` adapter settings. A minimal file is:

```jsonc
{
  "$schema": "../../assets/omo.schema.json",
  "models": {
    "fast": { "model": "anthropic/claude-haiku-4-5" }
  },
  "categories": {
    "quick": { "model": "fast", "reasoning": "high" }
  },
  "task": {
    "default_execution_mode": "in-process",
    "default_concurrency": 5
  },
  "[opencode]": {
    "background_task": {
      "defaultConcurrency": 5
    }
  }
}
```

The generated schema is checked in at [`assets/omo.schema.json`](../../assets/omo.schema.json).
The complete schema implementation is under
`packages/omo-config-core/src/schema/`; OpenCode-specific options are described
in the surrounding reference pages.

## Model resolution

Agents and categories may reference entries in `models`. The adapter resolves
those references and reports cycles or unavailable models through diagnostics.
Provider and model identifiers use the OpenCode form `provider/model`.

Use the local entrypoint to inspect effective routing:

```bash
./bin/hustler-opencode.js doctor --verbose
./bin/hustler-opencode.js refresh-model-capabilities
```

## Teams and background work

Team definitions belong under `teams`. Background execution is configured in
the `[opencode]` block. See the [team mode guide](../guide/team-mode.md) and
[Hustler workflow design](../../HUSTLER.md) for operational examples.

## Validation and QA

Malformed or unreadable configuration layers are reported as diagnostics and
skipped. Test configuration and database behavior in an isolated OpenCode
environment, and record evidence under `.omo/evidence/`.
