# OMO Hustler

OMO Hustler is the OpenCode-only workflow layer for OMO. It routes engineering work through explicit competencies instead of a large set of permanent personas.

## Workflow

```text
USER -> ORCHESTRATOR -> PLANNER -> DEVELOPER -> TESTER -> APPROVER -> USER
```

The Orchestrator owns routing. The Planner decomposes work when needed. Developers implement. Testers review working artifacts. Approvers decide whether acceptance criteria are met. Librarian and Architect provide bounded advice when their expertise is needed.

## Design Rules

- Route once, then execute against a clear work item.
- Plan only when scope or risk requires it.
- Parallelize independent work, with explicit limits.
- Review real artifacts, not hypothetical plans.
- Persist workflow state and make retries idempotent.
- Stop when acceptance criteria are satisfied.

Skills provide domain knowledge without creating permanent workflow owners. Architect is reserved for material ambiguity, high blast radius, repeated debugging failure, security, or data integrity concerns.

## OpenCode Boundary

The plugin is designed for OpenCode. OpenCode-facing lifecycle hooks, tools, TUI state, configuration, and MCP integration belong in the adapter. Shared packages remain harness-neutral where practical. Removed harnesses and products are outside this project.
