# OMO Hustler for OpenCode

OMO Hustler is an OpenCode plugin for handing off substantial engineering work to a coordinated group of agents. The retained product is OpenCode-only. It provides a competency-based workflow, bounded delegation, background execution, review gates, skills, MCP integration, configuration, and lifecycle hooks.

## Install

Use the supported OpenCode installer from this repository:

```bash
bunx oh-my-openagent install
```

The installer registers the plugin and guides provider setup. For local development, see the [installation guide](docs/guide/installation.md) and [contributing guide](CONTRIBUTING.md).

## How Hustler Works

Hustler routes work through seven roles:

1. Orchestrator receives the request and chooses the workflow.
2. Planner decomposes work that needs a plan.
3. Developer implements the approved work.
4. Tester verifies the result and reports defects.
5. Approver checks acceptance criteria and completion state.
6. Librarian provides repository and documentation research.
7. Architect advises on high-risk or ambiguous decisions.

The normal path is `PLAN -> BUILD -> TEST -> REVIEW`. Small tasks may skip planning. Expensive analysis is conditional, and delegation is bounded to prevent uncontrolled fan-out.

## Documentation

- [Overview](docs/guide/overview.md)
- [Orchestration](docs/guide/orchestration.md)
- [Team Mode](docs/guide/team-mode.md)
- [Configuration](docs/reference/configuration.md)
- [Feature reference](docs/reference/features.md)
- [Roadmap](ROADMAP.md)
- [Current status](STATUS.md)
- [Contribution guide](CONTRIBUTING.md)
- Security and legal requirements are covered by the repository governance and attribution notices.

## Development

```bash
bun install
bun run typecheck
bun test packages/omo-opencode/src
bun run build
```

OpenCode QA uses an isolated environment. Do not use a real user database or provider credentials for tests.

## License and Attribution

The project keeps the upstream license, copyright, and third-party attribution notices. See [LICENSE.md](LICENSE.md) and [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
