# Roadmap

## Product Boundary

OMO Hustler is maintained as an OpenCode plugin. The roadmap covers the OpenCode adapter, the Hustler workflow, shared TypeScript packages used by that adapter, and their tests, documentation, and release artifacts.

Removed harnesses and products are not roadmap targets. New abstractions must earn their place through a concrete OpenCode use case.

## Current Priorities

1. Complete the standalone Hustler workflow and keep role transitions durable.
2. Make delegation, cancellation, retry, and approval behavior deterministic.
3. Improve OpenCode TUI workflow visibility without exposing private task data.
4. Keep configuration, generated schemas, package metadata, and documentation aligned.
5. Maintain isolated OpenCode QA and regression coverage for every adapter change.

## Architecture Direction

The OpenCode adapter owns harness integration. Core packages hold reusable logic such as configuration, prompts, rules, model resolution, task state, and telemetry. The dependency direction is from the adapter to those packages, never from core back into OpenCode.

Hustler keeps the workflow explicit:

```text
USER -> ORCHESTRATOR -> PLANNER -> DEVELOPER -> TESTER -> APPROVER -> USER
```

Librarian and Architect are advisory roles. They may return research or a decision, but they do not own workflow stages. Team Mode and background agents remain bounded OpenCode features, not separate products.

## Non-Goals

- Supporting another agent harness in this repository.
- Reintroducing removed launchers, adapters, websites, or publishing surfaces.
- Building a universal plugin interface before a concrete OpenCode need exists.
- Adding a permanent agent role where a skill or task profile is sufficient.

## Decision Principle

Prefer the smallest design that makes the OpenCode workflow observable, testable, and safe. Preserve user-visible behavior unless a migration explicitly changes it, and record architectural decisions in the implementation evidence.
