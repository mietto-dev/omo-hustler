# Repository Status

## Product

The repository is the standalone OpenCode/Hustler product. The Hustler workflow implementation, OpenCode adapter, package boundaries, and isolated QA tooling are present in this worktree.

## Implemented

- Seven-role competency workflow: Orchestrator, Planner, Developer, Tester, Approver, Librarian, and Architect.
- Role-aware delegation, bounded recursion, parallel limits, retries, fallback routing, and idempotency.
- Durable workflow state and OpenCode event-driven advancement.
- Planner, Developer, Tester, and Approver workflow contracts.
- Redacted TUI workflow visibility.
- OpenCode plugin build, typecheck, test, and isolated QA paths.

## Current Limitations

- The standalone CLI surface is still limited compared with the OpenCode plugin path.
- Some deeper Librarian and Architect behavior remains on the roadmap.
- Generated artifacts and release checks must remain synchronized with package changes.

## Verification

Use the commands in [README.md](README.md) and [CONTRIBUTING.md](CONTRIBUTING.md). Evidence for migration work is kept under `.omo/evidence/`.
