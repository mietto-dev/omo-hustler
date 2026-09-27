# Repository Cleanup Inventory Plan

## Objective

Create a complete, evidence-backed cleanup inventory before further feature
development. The inventory will explain the role and project relevance of every
tracked file, assign a primary `KEEP` or `DELETE` flag, and use explicit
exception states where deletion is not yet safe:

`REWRITE`, `ARCHIVE`, `MIGRATE`, `GENERATED`, or `MANUAL-CONFIRMATION`.

This plan does not delete or rewrite repository content.

## Authority And Boundary

Use these sources in descending order of authority:

1. Current source, package manifests, build inputs, tests, and QA evidence.
2. `ROADMAP.md`, which defines the current standalone OpenCode boundary.
3. `HUSTLER.md`, which defines the competency-based target and retained
   infrastructure.
4. Migration/history evidence.
5. Maintainer confirmation when evidence remains inconclusive.

The retained product is the standalone OpenCode Hustler:

- `packages/omo-opencode/` is the adapter and primary runtime boundary.
- Registered `packages/*-core/` packages remain reusable infrastructure.
- The seven roles are `orchestrator`, `planner`, `developer`, `tester`,
  `approver`, `librarian`, and `architect`.
- Skills, MCPs, hooks, background tasks, model routing, task tracking, Tmux,
  LSP, TUI visibility, configuration, tests, QA, generated artifacts, and
  legal attribution remain in scope.
- Codex, Senpi, Pi, native, Claude compatibility, Cursor, web products,
  launchers, marketplaces, and publishing surfaces are not current products.

Legacy names are not deletion evidence by themselves. Current role factories
still route exposed Hustler roles through legacy implementation names, so those
files require migration analysis before removal.

## Current Baseline

The read-only survey found:

- 7,536 tracked paths.
- 4,153 files recognized by the graphify detector, including 3,789 code files
  and 364 documents.
- Approximately 3,000 tracked `.omo` paths, mostly evidence and historical
  planning records.
- Approximately 4,100 tracked package paths across the adapter, core packages,
  shared skills, tests, and package metadata.
- The worktree was clean at survey time.

The final counts must be regenerated from `git ls-files`; these numbers are
orientation only.

## Required Deliverables

Produce these artifacts during execution:

1. `docs/repository-cleanup-inventory.md`
   - Human-readable report and decision index.
   - Summary by package, directory, file kind, decision, confidence, and risk.
   - Explicit candidate deletion queue and rewrite/archive/migration queues.
   - Links to exact manifest rows and evidence.
2. `docs/repository-cleanup-manifest.jsonl`
   - Exactly one sorted row for every path returned by `git ls-files`.
   - File-level role, relevance, decision, confidence, consumers, owner,
     evidence, risk, and replacement metadata.
3. `.omo/evidence/repository-cleanup-inventory/`
   - Read-only baseline, reference searches, package graph, generated-artifact
     map, documentation-link results, and validation logs.
4. A deterministic generator/validator, if repository conventions permit it,
   with focused tests for coverage and decision safety.

## Manifest Contract

Each row must contain at least:

```json
{
  "path": "relative/path",
  "tracked": true,
  "kind": "source|test|doc|config|script|fixture|generated|evidence|legal|binary|unknown",
  "role": "plain-language purpose",
  "relevance": "why this is or is not part of standalone OpenCode Hustler",
  "decision": "KEEP|DELETE|REWRITE|ARCHIVE|MIGRATE|GENERATED|MANUAL-CONFIRMATION",
  "confidence": "high|medium|low",
  "consumers": ["runtime|build|test|docs|package|qa|legal|migration|external"],
  "evidence": [{"type": "import|reference|manifest|generator|test|qa|history|legal|manual", "location": "path:line or command", "finding": "specific fact"}],
  "owner": "package or surface owner",
  "replacement_or_target": null,
  "generator": null,
  "risk": "low|medium|high|irreversible",
  "notes": "bounded rationale"
}
```

Validation rules:

- Manifest path set must equal `git ls-files` exactly.
- Rows must be sorted, unique, valid JSON, and individually addressable.
- Every file gets a role and relevance statement; directory rows cannot replace
  file rows.
- Every non-`KEEP` row requires concrete evidence and a rationale.
- `DELETE` requires negative evidence across runtime, build, package, test,
  documentation, legal, migration, and dynamic-discovery consumers.
- `GENERATED` requires its source, generator, consumer, and regeneration command.
- `MIGRATE` requires source, target, precedence, and exit condition.
- `MANUAL-CONFIRMATION` requires a named question and decision owner.
- A legacy-name text match may not produce a high-confidence `DELETE`.

## Classification Rules By Surface

### Runtime And Core Packages

Initial default: `KEEP`.

Inventory every file under `packages/omo-opencode/` and every registered core
package. Record imports, exports, package dependencies, tests, build inclusion,
and runtime registration. In particular retain pending proof:

- adapter entrypoint and OpenCode plugin interface;
- Hustler role vocabulary, delegation policy, lifecycle, contracts, and TUI;
- background-agent, task, hook, MCP, configuration, model, LSP, Tmux, and
  skill-loader surfaces;
- `packages/hustler/` while its documented limited package/CLI facade remains;
- `packages/shared-skills/` and provenance/materialization inputs;
- co-located tests and test support.

Legacy implementation directories such as `agents/sisyphus`, `agents/atlas`,
`agents/prometheus`, `agents/hephaestus`, `agents/momus`, `agents/oracle`,
`agents/explore`, and their prompt assets are `MIGRATE` or `KEEP` until current
factory mappings are replaced and focused tests prove the replacement.

Compatibility schemas, config migration, model fallback, and migration helpers
are `KEEP` or `MANUAL-CONFIRMATION` until existing-user upgrade behavior is
explicitly retired.

### Generated Artifacts

Initial default: `GENERATED` / `KEEP`.

Map each output to its generator and consumer before changing it. Known pairs:

- `packages/omo-opencode/src/generated/model-capabilities.generated.json` <-
  `script/build-model-capabilities.ts`.
- `assets/omo-hustler.schema.json` and related schema outputs <-
  `script/build-schema.ts` and related schema builders.
- bundled shared-skill outputs <- `script/copy-shared-skills-assets.ts`.

Do not delete or hand-edit generated outputs independently of their source,
freshness tests, and package payload rules.

### Documentation

Use `REWRITE` where the file still serves a valid product purpose but describes
the wrong topology. Use `ARCHIVE` only when historical context is valuable and
is clearly labeled as non-current. Use `DELETE` only for unsupported documents
with no legal, historical, or navigation value.

High-confidence rewrite queue:

- `docs/guide/orchestration.md`: legacy 11-agent Prometheus/Atlas route.
- `docs/guide/overview.md`: legacy role terminology and execution path.
- `docs/guide/agent-model-matching.md`: legacy agent-centric routing.
- `docs/manifesto.md`: legacy planning/review model presented as current.
- `docs/reference/known-issues.md`: mixed historical and current issues.
- `CONTINUE.md`: contradictory/stale evidence paths.
- generated or hand-maintained `AGENTS.md` files that still claim 11 agents.

Retain and synchronize `README.md`, `STATUS.md`, `CONTRIBUTING.md`,
`HUSTLER.md`, `ROADMAP.md`, current installation/configuration/feature guides,
and current OpenCode QA documentation.

### Scripts, CI, QA, And Release Surfaces

Classify each script by whether it supports retained OpenCode development,
isolated QA, package/build integrity, notices, or obsolete distribution.

Retain OpenCode lifecycle/topology/TUI QA and package/build/schema guards, but
mark stale scripts `REWRITE` when the capability remains useful. Strong
rewrite/delete review candidates include:

- `script/agent/setup.sh`, `cleanup.sh`, `qa-sandbox.sh`, `qa-docker.sh`, and
  `script/agent/docker-dev.sh` where they still provision Codex/Claude/Cursor or validate
  `oh-my-openagent` instead of `omo-hustler`.
- Codex/Senpi release fixtures and release-layer tests.
- notice scripts that still require removed package names, after checking legal
  and shipped dependency ownership.
- obsolete publishing workflows and package release skills, subject to the
  explicit private/no-publishing decision.

Do not delete a CI or package-layout test merely because it mentions a removed
package: it may be a guard proving that removed paths stay absent. Rewrite such
tests to the current boundary where appropriate.

### Skills And Migration Surfaces

`.agents/` and `.opencode/` are migration surfaces. Inventory every file
individually, including loader-discovered skills, commands, metadata, and
benchmarks. Record source/target, precedence, duplication, and removal
conditions. Do not delete `.opencode/` solely because `.agents/` exists.

Likely deletion candidates after loader verification:

- active publish, pre-publish, unpublished-change, Senpi-QA, and Codex-QA
  skills/commands that directly target removed products;
- duplicate easter-egg or compatibility commands with no current consumer.

Likely `KEEP` or `REWRITE` candidates:

- generic programming, debugging, Git, browser, security, QA, and planning
  skills used by retained workers;
- shared skills with provenance or materialization tests;
- cross-platform session discovery, unless maintainers explicitly retire the
  supported imported session formats.

### Evidence, Plans, And Legal Files

Default `.omo/evidence/**` to `KEEP` or `ARCHIVE`, not `DELETE`. Inventory each
file, identify producer and covered behavior, and label stale historical
records. Senpi/Codex/native evidence is outside current product behavior but may
be required migration/audit history; deletion requires explicit retention
approval and a replacement/archive target.

Keep legal notices, signatures, attribution, and third-party requirements by
default. Stale package names in legal material are `MANUAL-CONFIRMATION` or
`REWRITE`, never automatic deletion.

## Execution Waves

## Execution Checklist

- [ ] Wave 1: capture baseline and decision policy
- [ ] Wave 2: define and test the manifest contract
- [ ] Wave 3: complete runtime, migration, docs/evidence, and legacy audit lanes
- [ ] Wave 4: synthesize the exhaustive manifest and human report
- [ ] Wave 5: validate completeness and prepare cleanup handoff

### Wave 1: Baseline And Policy

Capture status, tracked/untracked paths, counts, package roots, product
boundary, protected paths, and decision semantics. Save raw outputs under the
evidence directory.

QA: run `git status --short --untracked-files=all`, `git ls-files`, and grouped
path/count commands; assert that the recorded tracked-path set is non-empty,
the worktree baseline is preserved, and the evidence snapshot contains the
exact command outputs plus the boundary/protected-path policy.

### Wave 2: Manifest Contract

Implement or document the row schema and validator first. Add tests for exact
tracked coverage, duplicate/missing rows, decision-specific metadata, stable
ordering, binary paths, and unusual filenames.

QA: run `bun test script/repository-cleanup-manifest.test.ts`; the tests must
feed duplicate, missing-path, unsupported-decision, missing-DELETE-evidence,
missing-GENERATED-metadata, and missing-MIGRATE-target fixtures to the validator
and expect non-zero validation results, then feed a sorted complete fixture and
expect exit 0.

### Wave 3: Parallel Evidence Lanes

Run these independently:

1. Runtime, package, build, registration, dependency, and generated-artifact
   audit.
2. `.agents`, `.opencode`, shared skills, commands, loader, and migration audit.
3. Docs, scripts, CI, QA, tests, legal files, and `.omo` evidence audit.
4. Legacy references, dynamic discovery, fixtures, binaries, and exceptional
   artifact audit.

Each lane produces path-specific evidence, not only a prose summary.

QA: run the four lane commands defined by the inventory tooling, for example
`bun run script/repository-cleanup-audit.ts --lane runtime`, `--lane migration`,
`--lane docs-evidence`, and `--lane legacy`; expect each command to exit 0 and
write path-specific evidence. Assert from the resulting JSON that runtime and
package output includes manifests/generators, migration output includes
precedence/exit conditions, docs/evidence output covers its tracked scope, and
legacy output labels ambiguous matches instead of converting them to DELETE.

### Wave 4: Synthesis

Merge evidence into the JSONL manifest and human report. Resolve conflicts in
favor of current consumers and ROADMAP boundary. Produce counts, protected
surfaces, deletion candidates, rewrite/archive/migration queues, generated map,
and manual-confirmation queue.

QA: run `bun run script/repository-cleanup-manifest.ts --root . --out
docs/repository-cleanup-manifest.jsonl` followed by `bun run
script/repository-cleanup-report.ts --manifest
docs/repository-cleanup-manifest.jsonl --out
docs/repository-cleanup-inventory.md`; expect both commands to exit 0, then
assert that the manifest path set equals `git ls-files`, every row has
role/relevance/decision, and every non-KEEP row has evidence and exception
metadata.

### Wave 5: Validation And Handoff

Re-run exact path coverage, decision metadata validation, reference searches for
every DELETE candidate, package/build checks, schema freshness, Markdown link
audit, legal references, migration rules, and worktree status. Record failures
as failures and state clearly that no cleanup occurred.

QA: run `bun run script/validate-repository-cleanup-manifest.ts
docs/repository-cleanup-manifest.jsonl --compare-git-files` and expect exit 0;
this validator must derive `git ls-files` itself and fail on any missing,
extra, duplicate, or unsorted manifest path. Run
`bun run script/repository-cleanup-audit.ts --lane legacy --manifest
docs/repository-cleanup-manifest.jsonl --decisions DELETE` and expect exit 0
with zero unreviewed DELETE rows. Run
`bun test packages/omo-opencode/src/shared/markdown-link-audit.test.ts`,
`bun test script/package-layout.test.ts script/package-registration-audit.test.ts`,
and `bun test tests/omo-schema-freshness.test.ts`; expect each applicable suite
to pass or record an unrelated pre-existing failure. Run the DELETE-candidate
reference audit above and expect zero unreviewed DELETE rows. Finish with `git
status --short --untracked-files=all` and assert that the only new files are
explicitly approved inventory artifacts.

## Initial Decision Index

These are survey conclusions to seed the final manifest, not blanket recursive
decisions:

| Surface | Initial flag | Rationale |
| --- | --- | --- |
| `HUSTLER.md`, `ROADMAP.md` | `KEEP` | Conceptual and current boundary authorities. |
| `packages/omo-opencode/**` | `KEEP` / `MIGRATE` exceptions | Primary adapter and current runtime; legacy factories need migration proof. |
| Registered `packages/*-core/**` | `KEEP` pending consumer audit | Reusable infrastructure and adapter dependencies. |
| `packages/shared-skills/**` | `KEEP` / `REWRITE` exceptions | Runtime skill inputs, provenance, and tests. |
| `script/`, retained QA, schema/build guards | `KEEP` / `REWRITE` | Development and acceptance infrastructure; some scripts contain old product assumptions. |
| `docs/guide/orchestration.md` | `REWRITE` | Explicitly stale per ROADMAP. |
| `docs/guide/overview.md`, `docs/manifesto.md`, model guide | `REWRITE` or `ARCHIVE` | Useful guidance with obsolete current topology. |
| `.agents/` and `.opencode/` | `MIGRATE` / selective `DELETE` | Active transition and loader-discovered surfaces. |
| publish/Codex/Senpi-only commands and skills | `DELETE` candidate | Directly outside the current boundary; verify consumers first. |
| `.omo/evidence/**` | `KEEP` / `ARCHIVE` | Audit and migration evidence; deletion is irreversible. |
| legal/attribution/signature files | `KEEP` / `MANUAL-CONFIRMATION` | Legal and distribution obligations. |
| root `--out-dir/dag-wait-detach-qa.json` | `MANUAL-CONFIRMATION` | Apparent QA residue; verify history and references before deletion. |

## Acceptance Criteria

- Every tracked path has one manifest row with a plain-language role and
  relevance statement.
- Every `DELETE` is rare, evidence-backed, and safe across runtime/build/test/
  package/docs/legal/migration consumers.
- Rewrite, archive, migrate, generated, and manual-confirmation cases are not
  disguised as deletion.
- OpenCode adapter, reusable cores, retained infrastructure, QA, generated
  artifacts, legal files, and evidence are explicitly protected or escalated.
- Legacy names are classified as active implementation, compatibility,
  historical evidence, fixture, stale guidance, or unresolved.
- Manifest and report are reproducible from the tracked tree.
- No deletion or unrelated cleanup is performed as part of this inventory.

## Later Cleanup Order

After review and approval, execute in this order:

1. Rewrite current documentation and stale generated guidance.
2. Remove confirmed obsolete commands, skills, release tests, and QA residue.
3. Normalize setup/cleanup/QA scripts to the OpenCode-only boundary.
4. Resolve `.agents`/`.opencode` migration and shared-skill duplication.
5. Replace legacy role factories only with equivalent current implementations
   and focused regression evidence.
6. Remove optional packages or evidence only after explicit confirmation and
   package/build/QA validation.

Every cleanup wave must run the repository-required checks from `AGENTS.md` and
record isolated OpenCode QA evidence for adapter changes.
