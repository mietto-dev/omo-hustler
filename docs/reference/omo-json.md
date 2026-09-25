# omo.json Configuration Reference

`omo.json` or `omo.jsonc` is the OpenCode configuration surface used by the
private OMO Hustler checkout. The adapter reads user configuration from
`~/.omo/omo.jsonc` and project configuration from `.omo/omo.jsonc` files.

## File locations and precedence

1. The user layer under `~/.omo` has the lowest precedence.
2. Project files are discovered from the current directory toward the home
   directory.
3. The nearest project file wins over earlier project files and the user layer.

JSONC comments and trailing commas are allowed. Plain objects merge
recursively. Scalars and arrays replace the lower layer. Invalid or unreadable
layers are reported as diagnostics and skipped.

## Schema

The generated schema is checked in at
[`assets/omo.schema.json`](../../assets/omo.schema.json). Point an editor at
that local file rather than an external schema URL.

```jsonc
{
  "$schema": "../../assets/omo.schema.json",
  "categories": {
    "deep": {
      "description": "Deep analysis",
      "model": "anthropic/claude",
      "reasoning": "high"
    }
  },
  "agents": {
    "reviewer": {
      "description": "Reviews code",
      "model": "openai/gpt-5",
      "execution_mode": "in-process"
    }
  },
  "task": {
    "default_execution_mode": "in-process",
    "default_concurrency": 5
  },
  "teams": {}
}
```

The complete accepted shape is defined by the schemas in
`packages/omo-config-core/src/schema/`. The OpenCode adapter-specific settings
are documented in the [configuration reference](configuration.md).

## Migration

There is no package or harness migration path in the retained project. When a
checkout changes configuration shape, update the local JSONC files directly and
keep a backup before editing them.
