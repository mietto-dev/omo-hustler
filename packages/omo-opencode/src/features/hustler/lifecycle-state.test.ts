import { afterEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs"
import { join } from "path"
import { classifyTask } from "../claude-tasks/orchestrator-classification"
import {
  createHustlerLifecycleAdapter,
  getHustlerWorkflowPath,
  HustlerLifecycleError,
} from "./lifecycle-state"
import { ApproverInputSchema, TesterReviewSchema } from "../claude-tasks/workflow-contracts"

const storagePath = join(process.cwd(), ".test-hustler-lifecycle")
const config = {
  sisyphus: {
    tasks: {
      storage_path: storagePath,
      claude_code_compat: false,
    },
  },
} as const

const approvedReview = TesterReviewSchema.parse({
  status: "approved",
  issues: [],
  reviewSummary: "approved",
  verification: { tests: "pass", build: "pass", lint: "pass", typecheck: "pass" },
})

const acceptedInput = ApproverInputSchema.parse({
  originalRequest: "request",
  acceptanceCriteria: ["criterion"],
  completedWork: ["criterion"],
  unresolvedIssues: [],
  verification: { tests: "pass", build: "pass", lint: "pass", typecheck: "pass" },
})

afterEach(() => {
  rmSync(storagePath, { recursive: true, force: true })
})

describe("HUSTLER lifecycle identity", () => {
  test("maps the same session to stable workflow and task IDs across adapter instances", () => {
    // #given
    const classification = classifyTask({ localized: true, expectedFiles: 1 })
    const first = createHustlerLifecycleAdapter(config).create({
      sessionId: "ses_stable",
      classification,
    })

    // #when
    const second = createHustlerLifecycleAdapter(config).create({
      sessionId: "ses_stable",
      classification,
    })

    // #then
    expect(second.identity).toEqual(first.identity)
    expect(second.revision).toBe(first.revision)
  })

  test("collapses a duplicate transition event to one persisted transition", () => {
    // #given
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_duplicate",
      classification: classifyTask({ localized: true, expectedFiles: 1 }),
    })

    // #when
    const first = adapter.transition(created.identity.workflowId, {
      eventKey: "session-idle:1",
      nextPhase: "implementation",
    })
    const replay = adapter.transition(created.identity.workflowId, {
      eventKey: "session-idle:1",
      nextPhase: "implementation",
    })
    const persistedPath = getHustlerWorkflowPath(config, created.identity.workflowId)

    // #then
    expect(replay.revision).toBe(first.revision)
    expect(replay.events).toHaveLength(1)
    expect(existsSync(persistedPath)).toBe(true)
  })

  test("reconstructs workflow state after a new adapter instance", () => {
    // #given
    const firstAdapter = createHustlerLifecycleAdapter(config)
    const created = firstAdapter.create({
      sessionId: "ses_restart",
      taskId: "T-task-restart",
      classification: classifyTask({ localized: true, expectedFiles: 1 }),
    })
    firstAdapter.recordWorkItem(created.identity.workflowId, {
      eventKey: "work-item:1",
      workerId: "worker-1",
      role: "developer",
      status: "running",
      workItemId: "work-1",
    })

    // #when
    const restored = createHustlerLifecycleAdapter(config).load(created.identity.workflowId)

    // #then
    expect(restored?.identity.taskId).toBe("T-task-restart")
    expect(restored?.state.workers[0]?.workItemId).toBe("work-1")
    expect(restored?.revision).toBe(1)
  })

  test("persists only an atomic record and no temporary files", () => {
    // #given
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_atomic",
      classification: classifyTask({ localized: true, expectedFiles: 1 }),
    })
    const filePath = getHustlerWorkflowPath(config, created.identity.workflowId)

    // #when
    const persisted = JSON.parse(readFileSync(filePath, "utf8")) as { version: number; kind: string }
    const files = readdirSync(join(storagePath, "hustler-workflows"))

    // #then
    expect(persisted).toMatchObject({ version: 1, kind: "hustler-workflow" })
    expect(files.some(file => file.includes(".tmp."))).toBe(false)
  })

  test("collapses concurrent duplicate transitions into one event", async () => {
    // #given
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_concurrent",
      classification: classifyTask({ localized: true, expectedFiles: 1 }),
    })

    // #when
    const results = await Promise.all([
      Promise.resolve(adapter.transition(created.identity.workflowId, { eventKey: "idle:1", nextPhase: "implementation" })),
      Promise.resolve(adapter.transition(created.identity.workflowId, { eventKey: "idle:1", nextPhase: "implementation" })),
    ])

    // #then
    expect(results[0]?.revision).toBe(1)
    expect(results[1]?.revision).toBe(1)
    expect(adapter.load(created.identity.workflowId)?.events).toHaveLength(1)
  })

  test("rejects a conflicting replay without changing the valid record", () => {
    // #given
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_conflict",
      classification: classifyTask({ localized: true, expectedFiles: 1 }),
    })
    adapter.transition(created.identity.workflowId, { eventKey: "idle:1", nextPhase: "implementation" })

    // #when
    const attempt = () => adapter.transition(created.identity.workflowId, { eventKey: "idle:1", nextPhase: "planning" })

    // #then
    expect(attempt).toThrow(HustlerLifecycleError)
    expect(adapter.load(created.identity.workflowId)?.revision).toBe(1)
    expect(adapter.load(created.identity.workflowId)?.state.phase).toBe("implementation")
  })

  test("fails closed on malformed persisted data", () => {
    // #given
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_malformed",
      classification: classifyTask({ localized: true, expectedFiles: 1 }),
    })
    const filePath = getHustlerWorkflowPath(config, created.identity.workflowId)
    writeFileSync(filePath, "{broken", "utf8")

    // #when
    const attempt = () => adapter.load(created.identity.workflowId)

    // #then
    expect(attempt).toThrow(HustlerLifecycleError)
    expect(readFileSync(filePath, "utf8")).toBe("{broken")
  })

  test("keeps terminal completion immutable and permits exact replay only", () => {
    // #given
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_complete",
      classification: classifyTask({ expectedFiles: 1 }),
    })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:implementation", nextPhase: "implementation" })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:acceptance", nextPhase: "acceptance" })
    adapter.recordApproverResult(created.identity.workflowId, { eventKey: "approval:1", result: acceptedInput })
    const completed = adapter.complete(created.identity.workflowId, { eventKey: "complete:1" })

    // #when
    const replay = adapter.complete(created.identity.workflowId, { eventKey: "complete:1" })
    const mutation = () => adapter.recordEvent(created.identity.workflowId, { eventKey: "idle:after", kind: "session_idle" })

    // #then
    expect(replay.revision).toBe(completed.revision)
    expect(completed.status).toBe("completed")
    expect(mutation).toThrow(HustlerLifecycleError)
  })

  test("records review, retry, and cancellation transitions with redacted review text", () => {
    // #given
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_retry",
      classification: classifyTask({ expectedFiles: 1 }),
    })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:implementation", nextPhase: "implementation" })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:review", nextPhase: "review" })
    const review = TesterReviewSchema.parse({
      ...approvedReview,
      status: "changes_requested",
      issues: [{ severity: "medium", description: "secret prompt", requiredFix: "secret fix", workItemId: "work-1" }],
      reviewSummary: "secret summary",
      verification: { tests: "fail", build: "pass", lint: "pass", typecheck: "pass" },
    })

    // #when
    const revised = adapter.recordTesterReview(created.identity.workflowId, { eventKey: "review:1", review })
    const retried = adapter.retry(created.identity.workflowId, { eventKey: "retry:1", failure: "developer", workItemId: "work-1" })
    const cancelled = adapter.cancel(created.identity.workflowId, { eventKey: "cancel:1" })

    // #then
    expect(revised.state.retryCount).toBe(1)
    expect(retried.state.retryCount).toBe(2)
    expect(cancelled.status).toBe("cancelled")
    expect(cancelled.state.review?.reviewSummary).toBe("redacted")
    expect(cancelled.state.review?.issues?.[0]?.description).toBe("redacted")
    expect(cancelled.events.map(event => event.operation)).toEqual([
      "transition",
      "transition",
      "tester_review",
      "retry",
      "cancel",
    ])
  })
})
