# FORK.md

# Competency-Based Agent Fork — Implementation Blueprint

> A lean, deterministic, token-conscious fork of **Oh My OpenAgent (OMO)**.
>
> Agents are named for their core competencies and bounded workflow responsibilities, not mythology or corporate job titles.
>
> Core principle:
>
> **Route once. Plan only when necessary. Build in parallel. Review real artifacts. Stop when acceptance criteria are satisfied.**

---

## 1. Purpose

This fork keeps the strongest infrastructure from OMO—model routing, agent factories, task delegation, background execution, skills, MCP integration, configuration, hooks, and OpenCode integration—while replacing the existing multi-agent reasoning topology with a smaller and more predictable competency-based hierarchy.

The primary goals are:

- reduce duplicated reasoning;
- reduce unnecessary pre-implementation validation;
- minimize token consumption;
- reduce end-to-end response time;
- preserve parallel execution where it produces real value;
- make agent hierarchy and responsibilities obvious;
- prevent recursive agent spawning and uncontrolled task fan-out;
- perform expensive reasoning only when uncertainty or risk justifies it;
- move most independent review to **after working implementation exists**.

This project is not intended to weaken correctness.

It changes **where correctness effort is spent**.

OMO generally favors repeated deliberation and validation before and during execution. This fork favors:

1. sufficient planning;
2. focused implementation;
3. local verification;
4. independent review of actual changes;
5. deterministic completion checks.

---

# 2. Design Doctrine

The fork follows five rules.

## 2.1 Workflow ownership belongs only to top-level agents

Only these agents may own a stage of the task lifecycle:

- **Orchestrator**
- **Planner**
- **Developer**
- **Tester**
- **Approver**

These agents form the canonical workflow.

```text
USER
  │
  ▼
ORCHESTRATOR
  │
  ├── trivial/simple ────────────────┐
  │                                  │
  └── feature/architectural          │
             │                       │
             ▼                       │
          PLANNER                    │
             │                       │
             └──────────────┐        │
                            ▼        ▼
                           DEVELOPER(S)
                              │
                              ▼
                         TESTER?
                              │
                              ▼
                          APPROVER
                              │
                              ▼
                            USER
```

The workflow is deliberately linear.

---

## 2.2 Sub-agents advise; they do not own work

First-class sub-agents:

- **Librarian**
- **Architect**

They can be invoked by top-level agents, but they never take ownership of the task lifecycle.

```text
LIBRARIAN
"What already exists?"

ARCHITECT
"What should we do when the answer is genuinely unclear?"
```

Sub-agents return information to their caller.

They may not:

- alter the execution graph;
- assign implementation work;
- spawn Developer workers;
- close tasks;
- independently escalate the workflow;
- recursively create more sub-agents unless explicitly allowed by configuration.

---

## 2.3 Skills are not agents

Domain expertise should be injected through skills or task profiles rather than represented by permanent personalities.

Examples:

- frontend
- backend
- database
- testing
- browser
- Playwright
- Git
- media
- documentation
- security
- accessibility
- API design

A Developer instance can therefore be:

```text
DEVELOPER + frontend + playwright
```

or:

```text
DEVELOPER + backend + database
```

rather than requiring separate permanent `frontend-agent`, `database-agent`, etc.

---

## 2.4 Expensive reasoning is conditional

Architect must never be part of the default happy path.

Architect is invoked when:

- architectural ambiguity is material;
- two or more repository patterns conflict;
- a decision has high blast radius;
- a debugging path has repeatedly failed;
- security or data integrity requires deeper analysis;
- the caller's confidence falls below a configured threshold.

Architect is not invoked merely because a task is large.

---

## 2.5 Review working artifacts, not hypothetical artifacts

Tester normally runs **after implementation and local verification**.

Default:

```text
PLAN → BUILD → TEST → REVIEW
```

Not:

```text
PLAN → REVIEW PLAN → REVIEW REVIEW → BUILD
```

Pre-implementation Tester is reserved for high-risk changes such as:

- destructive migrations;
- auth/authz changes;
- cryptography;
- public API breaking changes;
- production infrastructure changes;
- large cross-cutting refactors;
- irreversible operations.

---

# 3. Agent Hierarchy

## 3.1 Top-level agents

| Agent        | Responsibility             | Owns workflow stage? | Can implement? |
| ------------ | -------------------------- | -------------------: | -------------: |
| Orchestrator | orchestration and routing  |                  yes |             no |
| Planner      | planning and decomposition |                  yes |             no |
| Developer    | implementation             |                  yes |            yes |
| Tester       | independent review         |                  yes |             no |
| Approver     | acceptance and completion  |                  yes |             no |

## 3.2 Sub-agents

| Agent     | Responsibility                              | Typical cost | Frequency |
| --------- | ------------------------------------------- | -----------: | --------: |
| Librarian | repository/context reconnaissance           |          low |  frequent |
| Architect | expert architectural/debugging consultation |         high |      rare |

## 3.3 Skills / profiles

Skills are dynamically loaded capabilities, not workflow owners.

Example profiles:

```text
frontend
backend
database
testing
playwright
browser
git
media
docs
security
accessibility
performance
```

---

# 4. Agent Responsibilities

# 4.1 Orchestrator

## Role

Orchestrator is the root orchestrator.

Orchestrator receives the user request and owns the overall task state.

Its primary job is:

```text
understand → classify → route → coordinate → report
```

Orchestrator should perform as little domain reasoning as possible.

## Responsibilities

Orchestrator:

- interprets the user request;
- determines task complexity;
- determines whether Planner is needed;
- starts implementation waves;
- controls parallel Developer workers;
- tracks dependency completion;
- receives worker results;
- invokes Tester when required;
- invokes Approver before final completion;
- manages retries and targeted fixes;
- reports final results to the user.

## Orchestrator should NOT

- deeply investigate the repository;
- design architecture;
- perform implementation;
- repeatedly re-evaluate completed decisions;
- independently rewrite Planner's plan unless new evidence invalidates it;
- launch speculative reviewers.

## Allowed delegation

Orchestrator may call:

- Planner
- Developer
- Librarian
- Architect
- Tester
- Approver

Only Orchestrator may create parallel implementation workers by default.

---

# 4.2 Planner

## Role

Planner converts an ambiguous or multi-step request into an executable plan.

The Planner’s job is:

```text
understand repository → identify dependencies → create execution DAG
```

## Responsibilities

Planner:

- inspects existing conventions;
- identifies analogous implementations;
- determines affected subsystems;
- identifies dependencies;
- creates bounded work packages;
- marks work that can run in parallel;
- defines acceptance criteria;
- flags high-risk decisions;
- requests Librarian research where appropriate;
- requests Architect only when architecture is genuinely ambiguous.

## Output

Planner should return a compact structured plan.

Example:

```yaml
task: product-management

workstreams:
  backend:
    depends_on: []
    scope:
      - product schema
      - persistence
      - CRUD service
      - REST endpoints
      - backend tests

  frontend:
    depends_on:
      - backend-contract
    scope:
      - API client
      - product listing
      - create/edit form
      - deletion flow
      - frontend tests

parallel_groups:
  - [backend-schema, frontend-recon]
  - [backend-service, frontend-scaffold]

acceptance:
  - CRUD works
  - validation matches project conventions
  - tests pass
  - build passes
```

## Planner should NOT

- implement;
- invoke Tester by default;
- produce speculative architecture essays;
- inspect hundreds of files directly when Librarian can answer targeted questions;
- spawn Developer workers.

## Allowed delegation

Planner may call:

- Librarian
- Architect

---

# 4.3 Developer

## Role

Developer is the implementation worker.

Developer receives a bounded contract and builds it.

```text
inspect relevant context
→ implement
→ test
→ report
```

## Responsibilities

Developer:

- reads only necessary code;
- implements the assigned slice;
- writes or updates tests;
- runs local verification;
- reports changed files;
- reports test/build/lint results;
- reports deviations from the plan;
- asks Librarian targeted repository questions;
- escalates hard architectural/debugging questions to Architect.

## Required input

Every Developer assignment should contain:

```yaml
task:
scope:
relevant_context:
acceptance_criteria:
allowed_files_or_modules:
forbidden_scope:
skills:
```

## Example

```yaml
task: Implement Product backend

scope:
  - Product schema
  - migration
  - repository
  - service
  - CRUD routes
  - tests

reference_patterns:
  - Customer module
  - Zod validators
  - Prisma repository conventions

forbidden_scope:
  - frontend
  - shared architecture refactor
  - unrelated cleanup

acceptance:
  - all CRUD endpoints implemented
  - SKU uniqueness enforced
  - tests pass
  - typecheck passes
```

## Developer should NOT

- redesign the overall project;
- re-plan the entire feature;
- spawn other Developers;
- invoke Tester;
- invoke Approver;
- expand scope because nearby code "could be improved".

## Allowed delegation

Developer may call:

- Librarian
- Architect

---

# 4.4 Tester

## Role

Tester independently reviews the completed implementation.

The Tester judges what exists.

```text
requirements + diff + evidence → review
```

## Responsibilities

Tester evaluates:

- requirement coverage;
- correctness;
- regressions;
- modularity (regressions outside the feature being implemented);
- missing tests (specially integration / e2e tests with related features);
- security concerns;
- data integrity;
- error handling;
- maintainability.

## Preferred inputs

- original user request;
- Planner plan, if one exists;
- git diff;
- changed file list;
- test results;
- build/typecheck/lint results;
- relevant decisions made during implementation.

## Output

Issues should be actionable.

Example:

```yaml
status: changes_requested

issues:
  - severity: low
    file: src/http/routes/products.ts
    issue: DELETE returns 200 while project convention uses 204
    fix: return 204 and update affected test
```

## Tester should NOT

- directly modify code;
- restart planning;
- spawn implementation workers;
- block completion over subjective style preferences;
- demand architectural rewrites without material benefit.

## Allowed delegation

Tester may call:

- Librarian
- Architect, only for exceptional review ambiguity

Fixes are returned to Orchestrator, which routes them to Developer.

---

# 4.5 Approver

## Role

Approver decides whether the task is complete.

Tester asks:

> Is the implementation good?

Approver asks:

> Is the requested task finished?

Approver is the final acceptance gate.

## Responsibilities

Approver checks:

- original requirements;
- explicit acceptance criteria;
- planned deliverables;
- implementation status;
- test status;
- build status;
- lint/typecheck status where relevant;
- unresolved Tester findings;
- unfinished TODOs introduced by the task;
- missing artifacts.

## Output

Only two normal states should exist:

```text
APPROVER: ACCEPTED
```

or:

```text
APPROVER: INCOMPLETE
```

If incomplete, Approver returns exact missing criteria.

Approver should be deterministic and inexpensive.

Approver should not propose improvements outside scope.

---

# 4.6 Librarian

## Role

Librarian is the contextual reconnaissance agent.

Librarian looks inward and outward:

```text
              LIBRARIAN
             /     \
        INWARD     OUTWARD
       repository  ecosystem
       patterns    docs
       history     APIs
       conventions libraries
       tests       examples
```

## Typical questions

```text
Find the existing CRUD module most similar to Product.

Where is authentication middleware applied?

How does this repository enforce unique identifiers?

What existing component implements delete confirmation?

Which tests cover this service?

How is currency formatting handled?

What does the current library API require?
```

## Design requirements

Librarian should be:

- cheap;
- fast;
- read-only;
- narrowly scoped;
- easy to invoke in parallel.

Librarian should answer the question asked and stop.

## Librarian should NOT

- design features;
- implement;
- create tasks;
- trigger additional agents;
- editorialize about unrelated architecture.

---

# 4.7 Architect

## Role

Architect is expert reasoning on demand.

Architect exists for questions whose cost of a wrong answer exceeds the cost of expensive reasoning.

## Typical triggers

```text
Two competing tenancy patterns exist. Which should this module use?

This transaction crosses several aggregates. Do we need an outbox?

Three debugging attempts failed. What systemic cause are we missing?

Would this migration introduce unsafe locking behavior?

Does this authorization change create an escalation path?
```

## Output format

Architect should return:

```yaml
recommendation:
reasoning:
evidence:
alternatives:
risk:
affected_scope:
confidence:
```

## Architect should NOT

- implement;
- own the feature;
- routinely review normal code;
- be called automatically because a task is "complex";
- spawn implementation agents.

---

# 5. Complexity Tiers

Orchestrator classifies every request before delegation.

## Tier 0 — Trivial

Examples:

- typo;
- rename;
- tiny CSS adjustment;
- change display text;
- obvious local fix.

Flow:

```text
Orchestrator → Developer → Approver
```

No Planner.

No Tester unless risk signals appear.

---

## Tier 1 — Localized

Examples:

- isolated bug;
- small endpoint;
- local component behavior;
- straightforward test addition.

Flow:

```text
Orchestrator
   │
   ├── Librarian?
   │
   ▼
Developer
   │
   ▼
Approver
```

Tester optional.

---

## Tier 2 — Feature

Examples:

- multi-file feature;
- CRUD module;
- backend + frontend;
- cross-layer integration;
- moderate refactor.

Flow:

```text
Orchestrator
   ↓
Planner
   ├── Librarian*
   └── Architect?
   ↓
Developer*
   ├── Librarian?
   └── Architect?
   ↓
Tester
   ↓
Approver
```

`*` means parallel execution may be used.

---

## Tier 3 — Architectural / High Risk

Examples:

- auth changes;
- destructive migrations;
- major architecture changes;
- cross-service consistency;
- security-sensitive code;
- broad API break;
- infrastructure changes.

Flow:

```text
Orchestrator
   ↓
Planner
   ├── Librarian*
   └── Architect
   ↓
Tester? PRE-FLIGHT
   ↓
Developer*
   └── Architect? if blocked
   ↓
Tester
   ↓
Approver
```

---

# 6. Example Feature Workflow

User prompt:

```text
Create a Product Management module.

Requirements:
- Product CRUD operations
- Product fields: name, description, SKU, price, active status
- REST API endpoints
- Persistence using the project's existing database layer
- Validation and error handling
- Product listing page in the web client
- Create/edit forms
- Delete confirmation
- Follow existing UI patterns and architecture
- Add appropriate tests
```

## Step 1 — Orchestrator

Orchestrator classifies:

```yaml
type: feature
tier: 2
planning_required: true
review_required: true
parallelism: useful
```

Orchestrator delegates planning to Planner.

---

## Step 2 — Planner

Planner requests parallel Librarian investigations.

```text
LIBRARIAN A
Find analogous backend CRUD module.

LIBRARIAN B
Find analogous management UI.

LIBRARIAN C
Find test conventions.
```

Librarian results are returned to Planner.

Planner creates the execution DAG.

```text
Product schema
    │
    ▼
repository
    │
    ▼
service ───────────────┐
    │                  │
    ▼                  │
routes                 │
    │                  │
    └──── API contract ┘
                       │
                       ▼
                  frontend API
                       │
              ┌────────┼────────┐
              ▼        ▼        ▼
            list      form     delete
                       │
                       ▼
                  create/edit
```

---

## Step 3 — Orchestrator dispatches implementation

Orchestrator creates two primary workers:

```text
DEVELOPER A
backend + backend tests

DEVELOPER B
frontend + frontend tests
```

Each receives bounded scope and relevant repository references.

---

## Step 4 — Developer local execution

Developer A:

```text
schema
→ persistence
→ service
→ validation
→ routes
→ tests
→ local verification
```

Developer B:

```text
API client
→ query/mutation layer
→ list
→ form
→ create/edit
→ delete
→ tests
→ local verification
```

Both may ask Librarian narrow questions.

Architect is invoked only when a material architectural ambiguity appears.

---

## Step 5 — Integration

Orchestrator collects results.

If integration reveals a mismatch, Orchestrator sends a narrow fix task to the relevant Developer.

Example:

```text
Frontend expects `isActive`.
Backend returns `active`.

Fix contract mismatch and rerun affected tests.
```

No replanning.

---

## Step 6 — Tester

Tester receives:

- request;
- plan;
- diff;
- test evidence;
- build evidence.

Tester reviews the actual implementation.

Any issue is returned to Orchestrator.

Orchestrator sends targeted fixes to Developer.

---

## Step 7 — Approver

Approver validates acceptance criteria.

Example:

```text
Backend
✓ create
✓ read
✓ update
✓ delete
✓ validation
✓ persistence

Frontend
✓ listing
✓ create
✓ edit
✓ delete confirmation

Quality
✓ backend tests
✓ frontend tests
✓ build
✓ typecheck
✓ Tester findings resolved

APPROVER: ACCEPTED
```

Orchestrator then responds to the user.

---

# 7. Delegation Matrix

| Caller       | Orchestrator | Planner | Developer | Tester | Approver |                           Librarian |   Architect |
| ------------ | -----------: | ------: | --------: | -----: | -------: | ----------------------------------: | ----------: |
| Orchestrator |            — |     yes |       yes |    yes |      yes |                                 yes |         yes |
| Planner      |           no |       — |        no |     no |       no |                                 yes |         yes |
| Developer    |           no |      no |        no |     no |       no |                                 yes |         yes |
| Tester       |           no |      no |        no |      — |       no |                                 yes | exceptional |
| Approver     |           no |      no |        no |     no |        — |                                  no |          no |
| Librarian    |           no |      no |        no |     no |       no |                                   — |          no |
| Architect    |           no |      no |        no |     no |       no | optional read-only Librarian lookup |           — |

Hard rules:

1. Only Orchestrator may spawn Developer workers.
2. Developer may never spawn Developer.
3. Librarian may never spawn agents.
4. Approver may never spawn agents.
5. Architect is advisory only.
6. Tester never fixes code directly.
7. Failed review returns to Orchestrator, not directly into an autonomous correction loop.

---

# 8. Parallelism Policy

Parallelism is valuable only for independent work.

Orchestrator and Planner should construct explicit dependency waves.

Example:

```text
Wave 1
├── Librarian backend reconnaissance
├── Librarian frontend reconnaissance
└── Librarian test reconnaissance

Wave 2
└── Planner plan

Wave 3
├── Developer backend
└── Developer frontend

Wave 4
└── integration fixes if necessary

Wave 5
└── Tester

Wave 6
└── Approver
```

Do not parallelize tasks with unstable shared ownership.

Avoid:

```text
Developer A edits product service
Developer B edits product service
Developer C "improves" product service
```

Prefer ownership boundaries.

---

# 9. Token Economy Rules

The fork should explicitly optimize context usage.

## 9.1 No duplicated reconnaissance

If Librarian has already produced a repository summary, downstream agents should receive that summary and exact file paths.

They should not rediscover the same architecture unless evidence becomes stale.

## 9.2 No mandatory plan review

Tier 2 plans proceed directly from Planner to execution.

Tester does not inspect normal plans.

## 9.3 Bounded worker context

Developer should receive:

- task slice;
- exact acceptance criteria;
- relevant files;
- referenced patterns;
- necessary Librarian output.

Avoid injecting the entire planning conversation.

## 9.4 Architect escalation budget

Architect calls should be rate-limited per task.

Recommended default:

```yaml
architect:
  max_calls:
    tier_0: 0
    tier_1: 1
    tier_2: 2
    tier_3: 4
```

A caller should include why Architect is necessary.

## 9.5 Review once

Tester should perform one normal review.

If issues are found:

```text
Tester → Orchestrator → Developer fix → targeted verification → Approver
```

A second Tester review should only occur when:

- the fix materially changes architecture;
- the original review explicitly requests re-review;
- the issue severity is high.

---

# 10. OMO Components to Preserve

The fork should preserve as much proven OMO infrastructure as possible.

Current OMO already contains reusable systems for:

- background agents;
- synchronous delegated tasks;
- category-based delegation;
- direct `subagent_type` targeting;
- skills injection;
- model selection and fallback;
- configuration schema validation;
- hooks;
- MCP integration;
- task tracking;
- Tmux visualization;
- LSP tooling;
- AST-aware search via skills;
- session management.

These are infrastructure capabilities, not the source of the workflow bloat.

The initial fork should therefore avoid rewriting them.

---

# 11. OMO Components to Replace or Collapse

Conceptual mapping:

| OMO               | competency-based fork                         |
| ----------------- | --------------------------------------------- |
| Sisyphus          | Orchestrator                                  |
| Prometheus        | Planner                                       |
| Hephaestus        | Developer                                     |
| Atlas             | Orchestrator + Approver                       |
| Oracle            | Architect                                     |
| Explore           | Librarian                                     |
| Librarian         | Librarian outward research                    |
| Metis             | removed / absorbed into Planner               |
| Momus             | Tester, moved primarily post-implementation   |
| Sisyphus-Junior   | Developer execution profiles                  |
| Multimodal-Looker | skill/profile or narrow specialist capability |

The mapping is conceptual, not necessarily a one-file rename.

---

# 12. Repository Implementation Strategy

The current OMO codebase organizes built-in agents under:

```text
packages/omo-opencode/src/agents/
```

The built-in agent enum is defined under:

```text
packages/omo-opencode/src/config/schema/agent-names.ts
```

Agent registration is handled through the built-in agent registry and configuration pipeline.

The fork should replace the existing built-in agent set with:

```text
orchestrator
planner
developer
tester
approver
librarian
architect
```

Suggested directory structure:

```text
packages/omo-opencode/src/agents/
├── orchestrator/
│   ├── agent.ts
│   ├── prompt.ts
│   ├── types.ts
│   └── index.ts
│
├── planner/
│   ├── agent.ts
│   ├── prompt.ts
│   ├── planner.ts
│   └── index.ts
│
├── developer/
│   ├── agent.ts
│   ├── prompt.ts
│   ├── worker-contract.ts
│   └── index.ts
│
├── tester/
│   ├── agent.ts
│   ├── prompt.ts
│   ├── review-schema.ts
│   └── index.ts
│
├── approver/
│   ├── agent.ts
│   ├── prompt.ts
│   ├── acceptance.ts
│   └── index.ts
│
├── librarian/
│   ├── agent.ts
│   ├── prompt.ts
│   └── index.ts
│
├── architect/
│   ├── agent.ts
│   ├── prompt.ts
│   └── index.ts
│
├── builtin-agents.ts
├── types.ts
└── index.ts
```

Exact file decomposition should follow current upstream factory conventions rather than forcing this structure where unnecessary.

---

# 13. Agent Schema Changes

Update:

```text
packages/omo-opencode/src/config/schema/agent-names.ts
```

Target enum:

```ts
export const BuiltinAgentNameSchema = z.enum([
  "orchestrator",
  "planner",
  "developer",
  "tester",
  "approver",
  "librarian",
  "architect",
]);
```

If migration compatibility is desired, legacy names may temporarily remain aliases.

Recommended compatibility strategy:

```json
{
  "agent_aliases": {
    "sisyphus": "orchestrator",
    "prometheus": "planner",
    "hephaestus": "developer",
    "oracle": "architect",
    "explore": "librarian",
    "librarian": "librarian",
    "momus": "tester",
    "atlas": "approver"
  }
}
```

Aliases should emit deprecation warnings.

Do not silently map Metis or Sisyphus-Junior without documenting behavioral differences.

---

# 14. Agent Ordering

OMO currently has explicit core-agent ordering behavior.

The competency-based fork should expose only top-level workflow agents in the normal primary-agent order:

```text
Orchestrator
Planner
Developer
Tester
Approver
```

Suggested default:

```ts
export const DEFAULT_AGENT_ORDER = ["orchestrator", "planner", "developer", "tester", "approver"];
```

Librarian and Architect are sub-agents and should not appear as normal workflow tabs unless explicitly configured.

---

# 15. Delegation Engine Changes

OMO's existing `task` delegation engine already supports:

- synchronous tasks;
- background tasks;
- category resolution;
- model resolution;
- skill loading;
- direct sub-agent targeting;
- task continuation.

Reuse it.

The main changes should occur in policy and validation.

## 15.1 Add caller-aware delegation constraints

The delegation layer should know the caller agent.

Pseudo-interface:

```ts
type DelegationContext = {
  caller: BuiltinAgentName;
  target: BuiltinAgentName;
  category?: string;
  skills?: string[];
  runInBackground?: boolean;
};
```

Validation:

```ts
assertDelegationAllowed(caller, target);
```

Example policy:

```ts
const ALLOWED_DELEGATIONS = {
  orchestrator: ["planner", "developer", "tester", "approver", "librarian", "architect"],

  planner: ["librarian", "architect"],

  developer: ["librarian", "architect"],

  tester: ["librarian", "architect"],

  approver: [],

  librarian: [],

  architect: ["librarian"],
};
```

Any illegal delegation should fail immediately.

---

# 16. Prevent Recursive Swarms

A major design objective is bounded fan-out.

Add task metadata:

```ts
type AgentTaskMetadata = {
  rootTaskId: string;
  parentTaskId?: string;
  depth: number;
  caller: BuiltinAgentName;
  role: "workflow" | "subagent" | "worker";
};
```

Recommended defaults:

```yaml
delegation:
  max_depth: 2

  limits:
    developer_parallel: 4
    librarian_parallel: 6
    architect_parallel: 1
```

The common execution tree should be:

```text
Orchestrator
├── Planner
│   ├── Librarian
│   └── Architect?
│
├── Developer
│   ├── Librarian
│   └── Architect?
│
├── Developer
│   └── Librarian
│
├── Tester
│   └── Librarian?
│
└── Approver
```

Not:

```text
Orchestrator
└── agent
    └── agent
        └── agent
            ├── agent
            └── agent
```

---

# 17. Worker Contract

Developer tasks should use a strict contract.

Suggested schema:

```ts
const DeveloperTaskSchema = z.object({
  id: z.string(),

  objective: z.string(),

  scope: z.array(z.string()),

  acceptanceCriteria: z.array(z.string()),

  relevantFiles: z.array(z.string()).optional(),

  referencePatterns: z.array(z.string()).optional(),

  forbiddenScope: z.array(z.string()).default([]),

  skills: z.array(z.string()).default([]),

  dependencies: z.array(z.string()).default([]),
});
```

The contract reduces worker re-planning.

Developer should be instructed:

```text
If the task can be completed within the provided contract, execute it.

If information is missing:
1. ask Librarian;
2. if architectural ambiguity remains, ask Architect;
3. otherwise return BLOCKED to Orchestrator.

Do not expand scope.
```

---

# 18. Planning Contract

Planner's output should also be structured.

Suggested schema:

```ts
const PlannerPlanSchema = z.object({
  summary: z.string(),

  workItems: z.array(
    z.object({
      id: z.string(),
      objective: z.string(),
      scope: z.array(z.string()),
      dependencies: z.array(z.string()),
      skills: z.array(z.string()),
      acceptanceCriteria: z.array(z.string()),
    }),
  ),

  parallelGroups: z.array(z.array(z.string())),

  risks: z.array(
    z.object({
      severity: z.enum(["low", "medium", "high"]),
      description: z.string(),
      requiresArchitect: z.boolean(),
      requiresPreflightReview: z.boolean(),
    }),
  ),

  finalAcceptance: z.array(z.string()),
});
```

Orchestrator consumes this directly.

The planner should produce an execution artifact, not prose-heavy deliberation.

---

# 19. Review Contract

Suggested Tester output:

```ts
const TesterReviewSchema = z.object({
  status: z.enum(["approved", "changes_requested"]),

  issues: z.array(
    z.object({
      severity: z.enum(["low", "medium", "high", "critical"]),

      file: z.string().optional(),
      description: z.string(),
      requiredFix: z.string(),
    }),
  ),

  reviewSummary: z.string(),
});
```

Orchestrator routes each required fix.

Subjective suggestions should not block completion unless they relate to an explicit project standard.

---

# 20. Acceptance Contract

Suggested Approver input:

```ts
const ApproverInputSchema = z.object({
  originalRequest: z.string(),
  acceptanceCriteria: z.array(z.string()),
  completedWork: z.array(z.string()),
  unresolvedIssues: z.array(z.string()),
  verification: z.object({
    tests: z.enum(["pass", "fail", "not-applicable"]),
    build: z.enum(["pass", "fail", "not-applicable"]),
    lint: z.enum(["pass", "fail", "not-applicable"]),
    typecheck: z.enum(["pass", "fail", "not-applicable"]),
  }),
});
```

Output:

```ts
const ApproverResultSchema = z.object({
  status: z.enum(["accepted", "incomplete"]),

  missingCriteria: z.array(z.string()),
});
```

Approver should preferably run with a small/fast model.

---

# 21. Model Routing Strategy

Model selection should align with reasoning responsibility.

Recommended default policy:

| Agent        | Model class                   |
| ------------ | ----------------------------- |
| Orchestrator | medium / fast reasoning       |
| Planner      | strong reasoning              |
| Developer    | strong coding                 |
| Tester       | strong reasoning/code review  |
| Approver     | cheap/fast                    |
| Librarian    | cheap/fast                    |
| Architect    | strongest available reasoning |

The exact provider should remain configurable.

Example:

```jsonc
{
  "agents": {
    "orchestrator": {
      "model": "openai/gpt-5.x",
    },

    "planner": {
      "model": "openai/gpt-5.x",
    },

    "developer": {
      "model": "openai/gpt-5.x-codex",
    },

    "tester": {
      "model": "openai/gpt-5.x",
    },

    "approver": {
      "model": "openai/gpt-5.x-mini",
    },

    "librarian": {
      "model": "openai/gpt-5.x-mini",
    },

    "architect": {
      "model": "openai/gpt-5.x",
      "reasoning_effort": "high",
    },
  },
}
```

These are conceptual defaults only.

Provider-specific mappings belong in configuration.

---

# 22. Complexity Classifier

Orchestrator needs a deterministic classifier.

Suggested signals:

```text
files likely touched
number of architectural layers
schema/database changes
public API changes
security impact
cross-service impact
explicit ambiguity
estimated independent workstreams
```

Pseudo-code:

```ts
function classifyTask(task: TaskSignals): Tier {
  if (task.securitySensitive) return 3;
  if (task.destructiveMigration) return 3;
  if (task.crossServiceArchitecture) return 3;

  if (task.layers >= 2) return 2;
  if (task.workstreams >= 2) return 2;
  if (task.expectedFiles >= 5) return 2;

  if (task.expectedFiles <= 1 && task.localized) return 0;

  return 1;
}
```

The classifier should bias toward the cheaper path.

Users may override:

```text
/plan
```

or:

```text
--tier=2
```

if command support is implemented.

---

# 23. Tester Invocation Policy

Suggested default:

```ts
function requiresTester(ctx: TaskContext): boolean {
  if (ctx.tier >= 2) return true;
  if (ctx.securitySensitive) return true;
  if (ctx.publicApiChange) return true;
  if (ctx.databaseMigration) return true;
  if (ctx.userRequestedReview) return true;

  return false;
}
```

Tier 0 should almost never invoke Tester.

Tier 1 should invoke Tester only when risk warrants it.

---

# 24. Architect Invocation Policy

Architect should require a reason code.

Example:

```ts
type ArchitectReason =
  | "architecture-conflict"
  | "security"
  | "data-integrity"
  | "repeated-debug-failure"
  | "high-blast-radius"
  | "uncertain-external-contract";
```

A caller must provide:

```yaml
reason:
question:
evidence:
attempted_resolution:
```

This discourages casual expensive consultation.

---

# 25. Librarian Modes

Librarian can unify much of the old Explore/Librarian distinction through mode.

Suggested modes:

```ts
type LibrarianMode = "repository" | "documentation" | "ecosystem" | "history";
```

Example:

```yaml
agent: librarian
mode: repository
question: Find existing CRUD implementations.
```

or:

```yaml
agent: librarian
mode: documentation
question: Determine whether library X supports Y.
```

The model may be the same while tool permissions differ.

---

# 26. Tool Permissions

Tool access should follow role.

## Orchestrator

Allowed:

- task/delegation;
- task status;
- background task control;
- basic repository inspection;
- shell for integration commands;
- git diff/status;
- build/test invocation.

Avoid broad editing tools.

## Planner

Allowed:

- read;
- grep/glob;
- Librarian;
- Architect;
- LSP/search;
- git history.

No write tools.

## Developer

Allowed:

- read;
- edit;
- shell;
- test/build;
- LSP;
- Librarian;
- Architect;
- skills.

## Tester

Allowed:

- read;
- diff;
- test result inspection;
- grep/LSP;
- Librarian;
- Architect if enabled.

No write tools.

## Approver

Allowed:

- read task state;
- inspect verification results;
- inspect acceptance criteria.

Prefer no edit tools.

## Librarian

Read-only research tools.

## Architect

Read-only reasoning/research tools.

---

# 27. Configuration Proposal

Example project configuration:

```jsonc
{
  "$schema": "./assets/competency-agent.schema.json",

  "workflow": {
    "default_tier": "auto",

    "parallelism": {
      "developer": 4,
      "librarian": 6,
      "architect": 1,
    },

    "review": {
      "tier_0": false,
      "tier_1": "risk-based",
      "tier_2": true,
      "tier_3": true,
    },

    "architect": {
      "max_calls_per_task": 2,
    },
  },

  "agents": {
    "orchestrator": {},
    "planner": {},
    "developer": {},
    "tester": {},
    "approver": {},
    "librarian": {},
    "architect": {},
  },
}
```

---

# 28. Runtime State

Orchestrator should maintain explicit task state.

Suggested model:

```ts
type WorkflowState = {
  taskId: string;
  tier: 0 | 1 | 2 | 3;

  phase:
    | "routing"
    | "planning"
    | "implementation"
    | "integration"
    | "review"
    | "acceptance"
    | "complete";

  plan?: PlannerPlan;

  workers: WorkerState[];

  review?: TesterReview;

  acceptance?: ApproverResult;

  architectCalls: number;
};
```

This should use OMO's existing task/session infrastructure where possible.

Do not create another independent persistence subsystem until necessary.

---

# 29. Failure Handling

## Developer failure

Retry only the failed work item.

```text
Developer B fails
     │
     ▼
Orchestrator
     │
     └── retry Developer B
```

Do not restart Planner unless the failure invalidates the plan.

## Librarian failure

Caller may:

1. retry;
2. perform local search;
3. proceed if non-blocking.

## Architect failure

Do not block ordinary tasks indefinitely.

Return uncertainty to the caller.

## Tester rejection

Orchestrator creates targeted fix tasks.

Do not automatically trigger full replanning.

## Approver incomplete

Orchestrator maps missing criteria to the smallest necessary Developer task.

---

# 30. User Interaction

Orchestrator is the only agent normally speaking to the user.

The user should not see internal agent chatter unless verbose/debug mode is enabled.

Normal output:

```text
Implemented Product Management.

Backend:
- Product CRUD API
- persistence and validation
- backend tests

Frontend:
- product list
- create/edit forms
- delete confirmation
- frontend tests

Verification:
- tests pass
- typecheck pass
- build pass
```

Optional debug mode:

```text
Orchestrator → Tier 2
Planner → 6 work items
Librarian → 3 parallel investigations
Developer → 2 parallel workers
Tester → 1 issue
Developer → fixed
Approver → accepted
```

This mode will be useful for benchmarking the fork against OMO.

---

# 31. Observability and Benchmarking

The fork exists largely to improve cost and latency.

Instrumentation should therefore be first-class.

Track per task:

```yaml
total_tokens:
input_tokens:
output_tokens:
wall_time:
agent_calls:
librarian_calls:
architect_calls:
developer_workers:
review_cycles:
failed_tasks:
```

Also track by agent.

Example:

```yaml
orchestrator:
  calls: 1
  tokens: 4200

planner:
  calls: 1
  tokens: 8300

librarian:
  calls: 3
  tokens: 5400

developer:
  calls: 2
  tokens: 22000

tester:
  calls: 1
  tokens: 6200

approver:
  calls: 1
  tokens: 900
```

This makes it possible to compare:

```text
OMO tokens
vs
competency-based fork tokens

OMO latency
vs
competency-based fork latency

OMO agent calls
vs
competency-based fork agent calls

quality/regressions
```

---

# 32. Initial Benchmark Suite

Create representative tasks:

## A. Tiny UI change

```text
Change the Product table Active column from true/false to Enabled/Disabled.
```

Expected:

```text
Orchestrator → Developer → Approver
```

## B. Local bug

```text
Fix duplicate product SKU returning 500 instead of 409.
```

Expected:

```text
Orchestrator → Librarian? → Developer → Approver
```

## C. Full feature

```text
Create Product Management CRUD backend and frontend.
```

Expected:

```text
Orchestrator
→ Planner
→ Librarian*
→ Developer*
→ Tester
→ Approver
```

## D. Architectural feature

```text
Add multi-tenant Product support while preserving existing account isolation.
```

Expected:

```text
Orchestrator
→ Planner
→ Librarian*
→ Architect
→ Developer*
→ Tester
→ Approver
```

Run the same prompts through upstream OMO and compare.

---

# 33. Implementation Phases

## Phase 0 — Fork baseline

- fork upstream repository;
- record upstream commit/tag;
- ensure full test suite passes unchanged;
- document fork divergence policy.

## Phase 1 — Agent rename/replacement

Introduce:

- Orchestrator
- Planner
- Developer
- Tester
- Approver
- Librarian
- Architect

Update:

- agent name schema;
- agent registry;
- exports;
- default ordering;
- documentation;
- generated schema.

Keep behavior close to upstream initially.

## Phase 2 — Remove redundant planning agents

Remove or disable:

- Metis;
- Momus plan review behavior;
- separate Explore/Librarian identities;
- Sisyphus-Junior as a permanent agent.

Ensure no references remain in:

- config validation;
- prompts;
- tests;
- task resolver;
- ordering;
- docs.

## Phase 3 — Delegation policy

Implement caller-aware delegation matrix.

Prevent:

- Developer → Developer;
- Librarian → any agent;
- Approver → any agent;
- arbitrary recursive task spawning.

Add delegation-depth metadata.

## Phase 4 — Complexity routing

Implement Orchestrator classification.

Support Tier 0–3.

Add configurable thresholds.

## Phase 5 — Structured planning

Implement Planner plan schema.

Orchestrator should consume structured work items.

Support dependency waves.

## Phase 6 — Worker contracts

Implement bounded Developer assignments.

Attach skills dynamically.

Add scope and acceptance constraints.

## Phase 7 — Post-implementation review

Implement Tester review contract.

Make it optional by tier.

Remove mandatory plan review from standard feature path.

## Phase 8 — Completion gate

Implement Approver.

Keep acceptance deterministic and cheap.

## Phase 9 — Librarian consolidation

Merge Explore/Librarian behavior under Librarian modes.

Preserve appropriate repository and web/documentation capabilities.

## Phase 10 — Architect escalation

Map Oracle-style deep reasoning into Architect.

Add reason codes and call budget.

## Phase 11 — Telemetry

Instrument:

- tokens;
- latency;
- calls;
- parallel workers;
- review cycles.

## Phase 12 — Benchmark

Run benchmark suite against upstream OMO.

Publish results.

---

# 34. Suggested First Code Changes

Start with low-risk structural work.

### Commit 1

```text
chore(fork): establish competency-based agent architecture
```

- add FORK.md;
- document upstream revision;
- add architecture docs.

### Commit 2

```text
refactor(agents): introduce competency-based built-in agent names
```

Modify:

```text
packages/omo-opencode/src/config/schema/agent-names.ts
packages/omo-opencode/src/agents/builtin-agents.ts
packages/omo-opencode/src/agents/index.ts
```

### Commit 3

```text
refactor(agents): replace core agent ordering
```

Modify relevant ordering helpers and tests.

### Commit 4

```text
feat(delegation): enforce competency-based delegation hierarchy
```

Modify the existing delegate-task engine.

### Commit 5

```text
feat(orchestrator): add task complexity routing
```

### Commit 6

```text
feat(planner): add structured execution plans
```

### Commit 7

```text
feat(developer): add bounded implementation contracts
```

### Commit 8

```text
feat(review): add Tester post-implementation review
```

### Commit 9

```text
feat(approver): add deterministic acceptance gate
```

### Commit 10

```text
refactor(research): consolidate explore and librarian into Librarian
```

### Commit 11

```text
refactor(reasoning): replace Oracle with Architect escalation
```

### Commit 12

```text
feat(metrics): add workflow token and latency instrumentation
```

---

# 35. Tests Required

## Unit

- agent-name schema;
- delegation matrix;
- complexity classifier;
- Planner plan parser;
- Developer contract parser;
- Tester result parser;
- Approver acceptance logic;
- Architect budget;
- recursion/depth guard;
- agent ordering.

## Integration

- Tier 0 flow;
- Tier 1 flow;
- Tier 2 flow;
- Tier 3 flow;
- parallel Developer execution;
- Librarian background queries;
- Architect escalation;
- Tester rejection → targeted fix;
- Approver incomplete → targeted work;
- task failure recovery.

## Regression

Ensure retained OMO functionality still works:

- model fallback;
- categories;
- skills;
- MCPs;
- background tasks;
- synchronous tasks;
- Tmux;
- hooks;
- config loading;
- OpenCode agent registration.

---

# 36. Non-Goals for v1

Do not initially:

- rewrite OMO's session engine;
- rewrite background task management;
- create a new MCP system;
- create custom LSP tooling;
- replace the skill system;
- create an elaborate workflow UI;
- implement autonomous agent negotiation;
- implement agent voting;
- implement recursive swarms;
- add dozens of specialist personalities.

The first milestone is a **workflow simplification fork**, not a platform rewrite.

---

# 37. Naming Summary

```text
TOP-LEVEL AGENTS
==============

ORCHESTRATOR
route / orchestrate

PLANNER
plan

DEVELOPER
build

TESTER
review

APPROVER
accept / close


SUB-AGENTS
==========

LIBRARIAN
find / inspect / research

ARCHITECT
reason / advise


SKILLS
======

frontend
backend
database
testing
browser
media
docs
security
...
```

---

# 38. One-Line Mental Model

```text
ORCHESTRATOR decides how much process is necessary.
PLANNER decides what must be built.
LIBRARIAN finds what already exists.
DEVELOPER builds it.
ARCHITECT resolves difficult uncertainty.
TESTER judges the actual implementation.
APPROVER decides whether the request is complete.
```

---

# 39. Core Architectural Difference From OMO

OMO's architecture deliberately uses multiple specialized reasoning and verification passes.

This fork should instead optimize for:

```text
minimum sufficient reasoning
```

The system should spend intelligence proportional to:

```text
uncertainty × risk × blast radius
```

—not simply proportional to task size.

Therefore:

```text
Trivial work gets trivial process.

Normal features get one planning pass.

Workers verify their own implementation.

Independent review happens after useful artifacts exist.

Expensive expert reasoning is an escalation path.

Completion is evaluated against explicit acceptance criteria.
```

---

# 40. Definition of Done for the Fork

The first stable release is ready when all of the following are true:

- [ ] only five top-level workflow agents exist;
- [ ] Librarian and Architect function as bounded sub-agents;
- [ ] recursive implementation delegation is prevented;
- [ ] Orchestrator performs complexity classification;
- [ ] Planner planning is skipped for Tier 0/1 by default;
- [ ] Developer can execute independent workstreams in parallel;
- [ ] Developer performs local verification;
- [ ] Tester runs primarily after implementation;
- [ ] Approver gates completion;
- [ ] skills can be attached dynamically to Developer workers;
- [ ] retained OMO infrastructure continues to work;
- [ ] token usage is measurable per agent;
- [ ] wall-clock latency is measurable;
- [ ] benchmark results can be compared against upstream OMO;
- [ ] a representative Tier 2 feature consumes materially fewer tokens and less wall-clock time without unacceptable quality regression.

---

# 41. Upstream Reference Notes

Implementation planning for this fork is based on the current OMO repository structure and documentation as reviewed on 2026-09-01.

Relevant upstream areas include:

```text
packages/omo-opencode/src/agents/
packages/omo-opencode/src/config/
packages/omo-opencode/src/plugin-handlers/
packages/omo-opencode/src/tools/delegate-task/
packages/omo-opencode/src/features/background-agent/
packages/model-core/
packages/prompts-core/
```

Before beginning implementation, record the exact upstream commit being forked and treat it as the reference point for this document.

Because OMO is actively developed, file names and internal APIs may move. Prefer adapting the concepts in this document to upstream's current factory and configuration conventions rather than preserving stale paths mechanically.

---

# 42. Final Principle

> **Do not add an agent when a function, skill, tool, or structured contract is enough.**

The competency-based hierarchy should remain small intentionally.

Every proposed new permanent agent must answer:

1. Does this agent own a fundamentally different reasoning responsibility?
2. Can this responsibility be expressed as a skill or mode instead?
3. Does adding this agent reduce total reasoning, or merely create another validation pass?
4. Will this agent normally contribute unique information?
5. Is its place in the hierarchy obvious?

If those answers are weak, do not add the agent.

---

# Further Improvements

## Kanban View

## Git View

Use something like `gitui` inside the harness

## Team View

Use something like https://github.com/jc01rho/omo-herdr-dag

## Jev Verifier

Use a lighter, faster, decision model on the validating steps of the workflow.
