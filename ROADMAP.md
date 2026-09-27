# Roadmap

This roadmap turns the original vision in [`HUSTLER.md`](HUSTLER.md) into an
implementation plan for the standalone OpenCode product. `HUSTLER.md` remains
the conceptual guidance document: it describes the desired competency-based
workflow, its trade-offs, and its definition of done. Runtime behavior is
authoritatively defined by the current source, tests, configuration schemas,
and isolated QA evidence.

## Product Boundary

The roadmap covers:

- `packages/omo-opencode/`, the OpenCode adapter;
- reusable `packages/*-core/` packages used by that adapter;
- the seven-role Hustler workflow;
- tests, documentation, generated artifacts, and isolated QA.

It does not restore removed harnesses, compatibility products, launchers,
websites, or publishing surfaces. Team Mode, background agents, skills, MCPs,
hooks, TUI support, model routing, and LSP remain retained OpenCode
infrastructure, not separate workflow products.

## Status and Evidence

Milestone status uses:

- `proposed`: planned but not started;
- `ready`: scoped and unblocked;
- `in_progress`: actively being implemented;
- `blocked`: cannot progress until a named dependency or decision is resolved;
- `shipped`: implemented and supported by focused tests or QA evidence;
- `deferred`: intentionally postponed;
- `superseded`: replaced by a newer design.

Evidence qualifiers are separate:

- `verified`: current source and relevant tests or QA agree;
- `unverified`: source exists, but representative behavior lacks evidence;
- `stale`: documentation or evidence no longer describes the current tree;
- `contradicted`: current source disagrees with the claim.

The roadmap must not mark a capability `shipped` solely because a type,
prompt, or partial implementation exists. New work should link its source,
tests, and, where behavior is user-visible, an isolated QA artifact under
[`.omo/evidence/`](.omo/evidence/).

## Target Workflow

The target hierarchy is deliberately small:

```text
USER
  -> ORCHESTRATOR
  -> PLANNER?
  -> DEVELOPER(S)
  -> TESTER?
  -> APPROVER
  -> USER
```

`Librarian` and `Architect` advise their caller and do not own workflow
stages. Skills provide domain expertise to workers instead of creating a
permanent agent for every domain. The process should scale with uncertainty,
risk, and blast radius rather than task size alone.

## Milestones

### M0. Evidence and Documentation Reconciliation

**Status:** `in_progress`
**Evidence:** `verified` for the inventory; documentation alignment remains
unfinished.

Create one authoritative view of the fork by mapping every phase and
definition-of-done item in [`HUSTLER.md`](HUSTLER.md) to source, tests, QA
evidence, or an explicit gap.

Acceptance criteria:

- every HUSTLER phase is classified as shipped, partial, unverified,
  deferred, or superseded;
- current status claims agree with source and tests;
- stale OMO-era documentation is either rewritten for OpenCode Hustler or
  clearly marked historical;
- no roadmap claim relies on a stale guide as completion evidence;
- generated schemas, package boundaries, and evidence paths are identified.

### M1. Seven-Role Topology and Delegation Foundation

**Status:** `shipped`
**Evidence:** `verified` in
[`role-constants.ts`](packages/omo-opencode/src/features/hustler/role-constants.ts),
[`roles.ts`](packages/omo-opencode/src/features/hustler/roles.ts),
[`delegation-policy.ts`](packages/omo-opencode/src/features/background-agent/delegation-policy.ts),
and their focused tests.

Keep the canonical roles explicit: `orchestrator`, `planner`, `developer`,
`tester`, `approver`, `librarian`, and `architect`. Enforce the caller-aware
delegation matrix, bounded depth, lineage ownership, fallback authorization,
and per-role parallel limits across synchronous and background paths.

Acceptance criteria:

- illegal role edges fail closed;
- Developers cannot create Developers, Librarians cannot spawn work, and
  Approvers cannot delegate;
- depth, lineage, retry, continuation, and parallel reservations are
  deterministic;
- compatibility aliases are documented and do not silently change role
  semantics;
- policy regressions remain covered by focused tests.

### M2. Complexity Routing and Durable Lifecycle

**Status:** `shipped`
**Evidence:** `verified` for the implemented path in
[`orchestrator-classification.ts`](packages/omo-opencode/src/features/opencode-tasks/orchestrator-classification.ts),
[`hustler-workflow.ts`](packages/omo-opencode/src/plugin/chat-message/hustler-workflow.ts),
the lifecycle state modules, and tier/workflow tests.

Implement the cheaper valid path for Tier 0 through Tier 3 work. Persist
workflow identity, classification, phase, events, revisions, work items,
failures, retries, and terminal state so event-driven advancement can resume
without duplicating effects.

Acceptance criteria:

- each tier has a documented route and review policy;
- Tier 0 and Tier 1 do not require unnecessary planning by default;
- Tier 2 requires planning evidence before implementation;
- Tier 3 supports pre-flight review and risk-based Architect escalation;
- duplicate events, invalid transitions, cancellation, failure, and restart
  behavior are deterministic;
- lifecycle state is durable and repository-local without introducing a
  second independent persistence system.

### M3. Structured Contracts and Completion Gates

**Status:** `in_progress`
**Evidence:** `verified` in
[`workflow-contracts.ts`](packages/omo-opencode/src/features/opencode-tasks/workflow-contracts.ts),
workflow tests, and lifecycle validation; representative end-to-end evidence
still needs to be consolidated.

Make the execution artifact, not prose-heavy deliberation, the handoff
between stages. Keep Planner, Developer, Tester, and Approver contracts
strict, bounded, and tied to workflow metadata. Route review findings back to
the Orchestrator as targeted fixes rather than autonomous replanning.

Acceptance criteria:

- Planner work items include dependencies, skills, scope, and acceptance;
- Developer work has an explicit scope, forbidden scope, relevant context,
  and verification result;
- Tester reports actionable severity, affected file or scope, and required
  fix without modifying code;
- Approver rejects missing criteria, failed verification, and unresolved
  issues, and emits only accepted or incomplete results;
- one representative Tier 2 flow demonstrates plan, build, review, targeted
  fix, and acceptance using durable state.

### M4. Conditional Librarian and Architect Advisory Behavior

**Status:** `in_progress`
**Evidence:** `unverified` for complete behavior; role registration and
contract plumbing exist, but deeper behavior is still limited.

Consolidate repository, documentation, ecosystem, and history reconnaissance
under Librarian modes. Make Architect an exceptional, read-only escalation
for architecture conflicts, security, data integrity, repeated debugging
failure, high blast radius, or uncertain external contracts.

Acceptance criteria:

- Librarian answers a narrow question and stops without spawning work;
- Librarian modes and tool permissions match the actual repository and
  external-research surfaces;
- Architect requests carry a reason, question, evidence, and attempted
  resolution;
- Architect call budgets are configurable and enforced; the implemented
  budget is documented where it differs from the conceptual example in
  `HUSTLER.md`;
- task size alone does not invoke Architect;
- failed advisory calls return bounded uncertainty instead of blocking normal
  work indefinitely.

### M5. Skills, Retained Infrastructure, and OpenCode Surface

**Status:** `in_progress`
**Evidence:** `verified` across adapter tests and isolated QA for the tested
surfaces; broader coverage remains part of M7.

Preserve proven OMO infrastructure while changing workflow policy: model
routing and fallback, categories, dynamic skills, background tasks, task
tracking, hooks, MCP integration, configuration, Tmux, LSP, TUI visibility,
and OpenCode registration.

Acceptance criteria:

- Developer workers can receive skills such as frontend, backend, testing,
  browser, security, accessibility, performance, Git, and documentation
  without creating permanent specialist agents;
- OpenCode adapter ownership and core-package dependency direction remain
  clear;
- TUI workflow visibility is useful while task data remains redacted;
- configuration, generated artifacts, and model routing remain compatible
  with the retained OpenCode surface;
- the limited standalone CLI surface is documented honestly and is not
  presented as equivalent to the plugin path.

### M6. Observability and Comparative Benchmarks

**Status:** `proposed`
**Evidence:** `unverified` for Hustler workflow economics.

Measure whether the fork achieves its central goals: less duplicated
reasoning, lower token use, lower latency, bounded fan-out, and no
unacceptable quality regression.

Acceptance criteria:

- per-task metrics include input/output/total tokens, wall time, role calls,
  Librarian calls, Architect calls, Developer workers, retries, review
  cycles, and failures;
- metrics are privacy-preserving and do not capture prompts, responses, source
  files, credentials, or raw repository contents;
- a repeatable Tier 0, Tier 1, Tier 2, and Tier 3 benchmark corpus exists;
- the same representative tasks can be run against the agreed upstream
  reference without mixing products or credentials;
- results report cost, latency, agent count, and quality/regressions;
- performance improvements remain claims, not completion criteria, until
  benchmark evidence is recorded.

### M7. Documentation, QA, and Release Alignment

**Status:** `in_progress`
**Evidence:** `partial`.

Keep the implementation, documentation, generated artifacts, and QA records
in sync as the workflow changes.

Acceptance criteria:

- current guides describe the standalone OpenCode Hustler roles and routes;
- old 11-agent OMO topology and legacy Prometheus/Atlas usage are removed
  from current guidance or explicitly labeled historical;
- Markdown links target checked-in files and the link audit passes;
- adapter changes have isolated OpenCode QA evidence under
  [`.omo/evidence/`](.omo/evidence/);
- focused tests, `bun run typecheck`, `bun run build`, and repository scripts
  are run as applicable, with unrelated pre-existing failures recorded rather
  than hidden;
- generated schemas and release artifacts are synchronized with source.

## Long-Term Guardrails

Before adding a permanent agent, answer the five questions in
[`HUSTLER.md`](HUSTLER.md#42-final-principle): does it own a fundamentally
different responsibility, can it be a skill or mode instead, reduce total
reasoning, contribute unique information, and have an obvious place in the
hierarchy? If not, add a function, skill, tool, or structured contract
instead.

# Progress

Progress below compares the current tree with the vision, rather than
repeating the vision as if it were already complete.

## Current Snapshot

The repository has crossed the structural fork baseline. The seven Hustler
roles are registered in the runtime role vocabulary, role-aware delegation
and bounded recursion are implemented, workflow classification and durable
event-driven state exist, and Planner/Developer/Tester/Approver contracts are
validated. Redacted TUI workflow visibility, OpenCode build/typecheck/test
paths, and isolated QA tooling are also present. These foundations align
with the core of HUSTLER's Phases 1, 3, 4, 5, 6, 7, and 8.

The fork is not yet at the conceptual definition of done. The largest gaps
are complete Librarian/Architect behavior, representative end-to-end proof,
workflow-specific token and latency benchmarks, and final evidence and release
alignment.

The repository cleanup wave is complete: obsolete publishing and compatibility
surfaces were removed, stale legacy guides were deleted, and retained
documentation references were aligned with the standalone OpenCode boundary.
The remaining M0/M7 work is inventory completion plus synchronization of
generated artifacts, QA evidence, and release checks.

## Milestone Status

| Milestone | Status | Evidence | Current observation |
| --- | --- | --- | --- |
| M0 Evidence and documentation reconciliation | `in_progress` | `verified` inventory, `stale` docs remain | Source and status are ahead of several guides. |
| M1 Seven-role topology and delegation | `shipped` | `verified` source and focused tests | Policy edges, aliases, lineage, depth, and role limits exist. |
| M2 Complexity routing and lifecycle | `shipped` | `verified` source and tier/lifecycle tests | Tier classification and durable event progression exist. |
| M3 Contracts and completion gates | `in_progress` | `verified` schemas; E2E `unverified` | Core contracts and Approver logic exist; evidence needs consolidation. |
| M4 Librarian and Architect advisory behavior | `in_progress` | `unverified` beyond plumbing | Deeper modes and escalation behavior remain limited. |
| M5 Skills, infrastructure, OpenCode surface | `in_progress` | `verified` for tested surfaces | Retained adapter infrastructure works; CLI surface remains limited. |
| M6 Observability and benchmarks | `proposed` | `unverified` | General telemetry exists, but Hustler economics are not benchmarked. |
| M7 Documentation, QA, release alignment | `in_progress` | `partial` | QA and gates exist; current guides and generated artifacts need ongoing sync. |

## Shipped Foundations

- Seven-role competency vocabulary in
  [`role-constants.ts`](packages/omo-opencode/src/features/hustler/role-constants.ts).
- Caller-aware delegation policy with allowed edges, max depth, lineage,
  fallback checks, and role parallelism in
  [`delegation-policy.ts`](packages/omo-opencode/src/features/background-agent/delegation-policy.ts).
- Tier classification and signal derivation in
  [`orchestrator-classification.ts`](packages/omo-opencode/src/features/opencode-tasks/orchestrator-classification.ts)
  and [`hustler-workflow.ts`](packages/omo-opencode/src/plugin/chat-message/hustler-workflow.ts).
- Durable workflow records, event idempotency, legal transitions, retries,
  and terminal state in the Hustler lifecycle modules.
- Structured Planner, Developer, Tester, and Approver contracts plus
  deterministic acceptance resolution in
  [`workflow-contracts.ts`](packages/omo-opencode/src/features/opencode-tasks/workflow-contracts.ts).
- OpenCode registration, model resolution, background execution, hooks,
  skills, MCPs, Tmux, LSP, configuration, and redacted TUI workflow state.
- Focused tests and isolated QA paths described in
  [`README.md`](README.md), and
  [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Partial and Unverified Areas

- The runtime still uses legacy factory and implementation names internally
  in places, even though the exposed Hustler role vocabulary is competency
  based. This is a migration/detail gap, not evidence that the old workflow
  should return.
- Librarian and Architect are present as bounded roles, but the full set of
  HUSTLER modes, reason codes, evidence requirements, and escalation behavior
  needs broader proof.
- Contract schemas are strong, but a single reviewer-readable end-to-end
  record covering plan, parallel build, review rejection, targeted fix, and
  Approver acceptance is still needed.
- Existing telemetry and performance tests do not yet establish the fork's
  token, latency, fan-out, or quality advantage over a controlled reference.
- The standalone CLI path is intentionally narrower than the OpenCode plugin
  path and should remain documented as such.

## Documentation Drift

Historical orchestration descriptions were removed from the current user
documentation because they contradict the standalone Hustler role model.
Obsolete publishing, compatibility, and legacy troubleshooting surfaces were
also removed during the repository cleanup. Any remaining migration notes
should be treated as M0/M7 work and must not be used as current product
guidance.

The proposed directory layout, exact model assignments, and compatibility
aliases in [`HUSTLER.md`](HUSTLER.md) are design suggestions, not promises
that the current tree must match literally. Current factory conventions and
OpenCode boundaries take precedence when implementing the remaining work.

## Verification Baseline

For adapter changes, use the repository-required checks as applicable:

```bash
bun test packages/omo-opencode/src/shared/markdown-link-audit.test.ts
bun test packages/omo-opencode/src
bun test script/
bun run typecheck
bun run build
GIT_MASTER=1 git diff --check
```

Documentation-only changes should at minimum run the Markdown link audit and
`GIT_MASTER=1 git diff --check`. Any broader check that is unavailable or
fails for an unrelated pre-existing reason belongs in the evidence record and
must not be represented as a successful gate.

## Immediate Next Work

1. Finish the M0 inventory and update current guides to the seven-role
   OpenCode model.
2. Consolidate an end-to-end M3 evidence artifact, including a targeted fix
   after Tester rejection and final Approver acceptance.
3. Complete and test the M4 Librarian modes and Architect reason/budget
   contract.
4. Define the M6 benchmark corpus and workflow metric schema before making
   cost or latency claims.
5. Keep M7 documentation, isolated QA, generated-artifact, and release gates
   synchronized with each implementation wave.
