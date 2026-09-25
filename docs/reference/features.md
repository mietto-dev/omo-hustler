# OMO Hustler Features Reference

OMO Hustler is a private OpenCode-only orchestration plugin.

## Agents and categories

The adapter provides specialized agents and categories for planning, research,
implementation, testing, review, and approval. Each agent can define a model,
reasoning effort, tools, and fallback models in `~/.omo/omo.jsonc` or a project
`.omo/omo.jsonc`.

The normal workflow is:

```text
PLAN -> BUILD -> TEST -> REVIEW
```

Small tasks may use a direct implementation path. Larger tasks can use the
planner, background agents, Team Mode, and approval gates.

## Background work and Team Mode

Background tasks run through the OpenCode adapter's task tools. Team Mode adds a
lead, bounded member sessions, a shared task list, mailbox acknowledgements,
optional worktrees, and optional tmux layout support. It is enabled with
`team_mode.enabled: true`.

See the [Team Mode guide](../guide/team-mode.md) and
[orchestration guide](../guide/orchestration.md).

## Hooks and context

Hooks provide lifecycle gates for prompts, tools, continuation, skills, and
workflow state. Project `AGENTS.md` files are injected according to directory
scope. OpenCode configuration and project `.omo` layers control enabled hooks,
agents, tools, and skills.

## MCPs

The adapter provides built-in MCPs for web search, documentation lookup, code
search, and local LSP operations. Skills may declare additional MCP servers in
their `SKILL.md` frontmatter. MCPs injected by the plugin are runtime services;
they do not need to appear in OpenCode's static `opencode.json` list.

Disable built-in servers with the adapter configuration:

```jsonc
{
  "[opencode]": {
    "disabled_mcps": ["websearch", "grep_app"]
  }
}
```

## Model capabilities

Model capability data combines the bundled snapshot, optional refreshed cache,
provider metadata, and family heuristics. Inspect effective routing with:

```bash
./bin/hustler-opencode.js doctor --verbose
./bin/hustler-opencode.js refresh-model-capabilities
```

## Configuration

See the [configuration reference](configuration.md) for file locations,
precedence, model catalogs, task settings, and OpenCode adapter options.
