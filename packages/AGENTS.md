# packages/ Guidance

The retained package tree supports the OpenCode OMO Hustler product. `omo-opencode` is the adapter and build entry. Core packages contain reusable logic and must not depend on OpenCode APIs.

## Package Map

| Area | Location | Purpose |
| --- | --- | --- |
| OpenCode adapter | `omo-opencode/` | Plugin entry, agents, hooks, tools, MCPs, CLI, and tests |
| Core logic | `*-core/` | Configuration, prompts, rules, model resolution, task state, telemetry, and shared utilities |
| MCP support | `lsp-tools-mcp/`, `mcp-stdio-core/` | OpenCode tool-server and stdio primitives |
| Shared skills | `shared-skills/` | Skills consumed by the OpenCode product |

## Working Rules

- Add a package only for a clear OpenCode boundary.
- Keep package imports directed from the adapter toward core.
- Run the package tests and root gates after changes.
- Preserve legal and upstream attribution notices.
- Do not document removed harnesses or products as active packages.

See [`omo-opencode/src/AGENTS.md`](omo-opencode/src/AGENTS.md) for adapter-specific guidance.
