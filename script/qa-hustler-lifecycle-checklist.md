# Task 10 Wave 4 Validation Checklist

Implementation scope: the deterministic fake-provider lifecycle driver and its
fixture support only. This file is a validation checklist, not QA evidence.

## Gate Preconditions

- [ ] Tasks 10, 11, and 12 are prepared on the same worktree.
- [ ] The built plugin artifact is present and corresponds to the worktree.
- [ ] No provider credential, auth header, raw environment dump, or unredacted
      server log is copied into the evidence directory.

## Task 10 Driver

- [ ] Start the bounded local fake provider and record only redacted branch
      counts and request summaries.
- [ ] Start OpenCode with isolated `HOME`, XDG directories, project directory,
      and HUSTLER task storage.
- [ ] Record the real host OpenCode SQLite `session` count before and after;
      require equality.
- [ ] Assert `/agent` contains exactly the seven HUSTLER roles and excludes
      legacy active names.
- [ ] Assert fake-provider requests contain no `team_*` tool names and the
      sandbox configuration has Team Mode disabled.
- [ ] Drive Tier 0 chat and delegation, then assert API/SSE activity and a
      persisted terminal `completed` workflow.
- [ ] Drive Planner-required Tier 2 chat and delegation, then assert the
      persisted planner gate, work item, review, approval, retry, and terminal
      completion records.
- [ ] Exercise tester rejection, approver rejection, provider failure,
      tool failure, cancellation, and retry; require the expected terminal or
      retry state rather than accepting process exit status.
- [ ] Bound every health, SSE, API, provider, and persisted-state wait.
- [ ] On success, assertion failure, signal, or timeout, terminate child
      processes and remove the sandbox.

## Task 11 TUI Driver

- [ ] Run the existing TUI boot/input smoke in an isolated sandbox.
- [ ] Assert workflow behavior through TUI control API, server API, SSE, and
      mirror state; do not use pane text as the behavioral oracle.
- [ ] If visual output is claimed, retain only the redacted web-terminal
      artifacts and record the exact capture command.

## Task 12 Runbook

- [ ] Document the exact build, isolated fake-provider gate, and cleanup
      commands with bounded timeouts.
- [ ] Mark real-provider validation as supplemental `PASS` or `BLOCKED`, never
      as a substitute for the local fake-provider gate.
- [ ] Run the final documentation/link and secret-redaction checks.

## Final Wave 4 Receipt

- [ ] Run the task 10 driver and `serve-wake-split-probe.sh --expect fixed`.
- [ ] Run task 11's TUI smoke/control scenarios.
- [ ] Run task 12's runbook checks.
- [ ] Write one reviewer-readable receipt under
      `.omo/evidence/20260923-hustler-live-opencode-e2e/` for each task.
- [ ] Include observed API/SSE/state assertions, host DB preservation, cleanup
      receipt, and explicit omissions in every receipt.
