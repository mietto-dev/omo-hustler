# Continue: HUSTLER Delegation

## Feature Context

HUSTLER defines canonical competency roles and caller-aware delegation with bounded recursion. The canonical roles are `orchestrator`, `planner`, `developer`, `tester`, `approver`, `librarian`, and `architect`. The first five own the primary workflow. `librarian` and `architect` are bounded advisors.

Delegation policy must enforce:

- Explicitly allowed role edges, with trusted root, parent, and caller lineage.
- Depth limits and per-role parallel caps.
- Continuation ownership, authorized fallback targets, and idempotent reservation release.
- The same caller-aware policy across direct delegation, background work, team members, unstable agents, and continuation or retry recovery.

Integrated surfaces are `delegate-task`, `call_omo_agent`, generic `background_task`, OpenCode Team Mode member creation, unstable-agent launch, and continuation, retry, and fallback manager paths.

Key implementation files:

- `packages/omo-opencode/src/features/background-agent/delegation-policy.ts`
- `packages/omo-opencode/src/features/background-agent/delegation-authorizer.ts`
- `packages/omo-opencode/src/features/background-agent/manager.ts`
- `packages/omo-opencode/src/features/background-agent/fallback-retry-handler.ts`
- `packages/omo-opencode/src/features/background-agent/spawner.ts`
- `packages/omo-opencode/src/tools/delegate-task/tools.ts`
- `packages/omo-opencode/src/tools/delegate-task/background-task.ts`
- `packages/omo-opencode/src/tools/delegate-task/unstable-agent-task.ts`
- `packages/omo-opencode/src/tools/delegate-task/sync-continuation.ts`
- `packages/omo-opencode/src/tools/call-omo-agent/tools.ts`
- `packages/omo-opencode/src/tools/call-omo-agent/background-executor.ts`
- `packages/omo-opencode/src/tools/call-omo-agent/sync-executor.ts`
- `packages/omo-opencode/src/tools/background-task/create-background-task.ts`
- `packages/omo-opencode/src/features/team-mode/team-runtime/create.ts`

## Verification Evidence

- Evidence directory: `.omo/evidence/20260913-hustler-delegation/`
- Plan: `.omo/plans/hustler-agent-topology.md`. Todo 4 is marked complete. Later plan work remains pending where applicable.
- Affected delegation and call suites: 569 passed, 0 failed.
- Policy, lifecycle, and lineage gate: 27 passed, 0 failed.
- Typecheck, build, and diff checks passed.
- OpenCode common isolation self-check and TUI smoke passed, with the host database unchanged.
- Bounded isolated `/global/health` and `/event` server probes succeeded, and `server.connected` was observed.
- The packaged helper server and SSE self-tests hang. Treat that as a tooling caveat, not a pass.

## Current Status

The HUSTLER work is at the end of the foundation phase. Todos 0-6 in
`.omo/plans/hustler-agent-topology.md` are complete. The current branch has
the canonical seven-role roster, role restrictions, caller-aware delegation
and bounded recursion, validated Planner/Developer contracts, and local Tier
0-3 workflow classification/state helpers with isolated OpenCode QA evidence.

The package builds and can be loaded by OpenCode, but the HUSTLER workflow is
not yet runnable end to end. `packages/hustler/src/index.ts` currently
re-exports the OpenCode adapter, and its CLI only provides help/version.
There is not yet an Orchestrator entrypoint that classifies a request, creates
workflow state, invokes Planner/Developer/Tester/Approver, or routes review
fixes.

Remaining implementation order:

1. Todo 7: Tester review and Approver acceptance gates.
3. Todo 8: Librarian modes and bounded Architect escalation.
4. Todo 9: runtime consumer migration, excluding Team Mode creation/configuration.
5. Todo 10: telemetry and deterministic benchmark fixtures.
6. Todo 11: generated artifacts, documentation, and regression sweep.
7. Todo 12: isolated real OpenCode topology probe and final evidence ledger.
8. Final gates F1-F4: plan compliance, code quality, real QA, and scope fidelity.

For a first runnable HUSTLER loop, Todos 6 and 7 plus a thin Orchestrator
entrypoint and a fake-model OpenCode probe are required. Telemetry,
benchmarks, documentation, and final audits can follow that milestone.

Team Mode creation, Team Mode configuration, tmux visualization setup, and
team startup instructions are intentionally out of scope. Existing team
lineage enforcement code remains only where it is part of the delegation
policy and is not an instruction to create or configure teams.

Verification evidence is stored under
`.omo/evidence/20260911-hustler-agent-topology/`. Do not claim full feature
completion while Todos 7-12 or F1-F4 remain pending.

## Continuation Checklist

- Read `CONTINUE.md` first.
- Inspect `git status` and `git diff`.
- Preserve unrelated dirty changes.
- Run the relevant delegation and call suites, policy and lifecycle gates, typecheck, and build.
- Recheck the evidence directory after QA.
- Do not claim full feature completion while remaining plan gates are pending.
