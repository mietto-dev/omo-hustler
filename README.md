# OMO Hustler for OpenCode

OMO Hustler is an OpenCode plugin for handing off substantial engineering work to a coordinated group of agents. The retained product is OpenCode-only. It provides a competency-based workflow, bounded delegation, background execution, review gates, skills, MCP integration, configuration, and lifecycle hooks.

## Install from a checkout

This repository is a private, OpenCode-only development tree. It does not provide
a published package, binary download, or marketplace listing. Install the local
Hustler profile from a fresh checkout:

```bash
git clone <repository-url> omo-hustler
cd omo-hustler
bun install
bun run build
node bin/hustler-opencode.js install
```

The installer creates:

- `~/.config/opencode/profiles/hustler/opencode.json`, registering the built
  Hustler plugin;
- `~/.local/bin/opencode-hustler`, a launcher for that profile.

Ensure `~/.local/bin` is on your `PATH`, then launch Hustler from any project:

```bash
export PATH="$HOME/.local/bin:$PATH"
cd ~/Development/Example
opencode-hustler
```

The launcher preserves the current project directory and forwards arguments to
OpenCode. After updating the checkout, rerun `bun run build` and
`node bin/hustler-opencode.js install`.

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

- [Hustler design](HUSTLER.md)
- [Roadmap](ROADMAP.md)
- [Team Mode](docs/guide/team-mode.md)
- [Configuration](docs/reference/configuration.md)
- [Feature reference](docs/reference/features.md)
- [Roadmap and progress](ROADMAP.md#progress)
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
