import { afterAll, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"
import { acquireLock, ensureDir } from "../claude-tasks/storage"
import { classifyTask } from "../claude-tasks/orchestrator-classification"
import {
  createHustlerLifecycleAdapter,
  getHustlerWorkflowPath,
  HustlerLifecycleError,
} from "./lifecycle-state"
import { ApproverInputSchema, TesterReviewSchema } from "../claude-tasks/workflow-contracts"

type TestFixture = Readonly<{
  storagePath: string
  config: Readonly<{
    sisyphus: Readonly<{
      tasks: Readonly<{
        storage_path: string
        claude_code_compat: false
      }>
    }>
  }>
}>

const fixturePaths = new Set<string>()

function createTestFixture(): TestFixture {
  const storagePath = mkdtempSync(join(tmpdir(), "hustler-lifecycle-"))
  fixturePaths.add(storagePath)
  return {
    storagePath,
    config: {
      sisyphus: {
        tasks: {
          storage_path: storagePath,
          claude_code_compat: false,
        },
      },
    },
  }
}

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

afterAll(() => {
  for (const storagePath of fixturePaths) {
    rmSync(storagePath, { recursive: true, force: true })
  }
})

describe("HUSTLER lifecycle identity", () => {
  test("maps the same session to stable workflow and task IDs across adapter instances", () => {
    // #given
    const { config } = createTestFixture()
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
    const { config } = createTestFixture()
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
    const { config } = createTestFixture()
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

  test("derives a stable work-item ID when a delegated event omits one", () => {
    // #given
    const { config } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_work_item_identity",
      classification: classifyTask({ expectedFiles: 1 }),
    })

    // #when
    const first = adapter.recordWorkItem(created.identity.workflowId, {
      eventKey: "work-item:stable",
      workerId: "worker-stable",
      role: "developer",
      status: "running",
    })
    const restored = createHustlerLifecycleAdapter(config).load(created.identity.workflowId)

    // #then
    expect(first.state.workers[0]?.workItemId).toBe(restored?.state.workers[0]?.workItemId)
    expect(first.state.workers[0]?.workItemId).toMatch(/^WI-/)
  })

  test("persists only an atomic record and no temporary files", () => {
    // #given
    const { config, storagePath } = createTestFixture()
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
    const { config, storagePath } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_concurrent",
      classification: classifyTask({ localized: true, expectedFiles: 1 }),
    })

    // #when
    const directory = join(storagePath, "hustler-workflows")
    ensureDir(directory)
    const heldLock = acquireLock(directory)
    expect(heldLock.acquired).toBe(true)
    const lifecycleModule = JSON.stringify(join(process.cwd(), "packages/omo-opencode/src/features/hustler/lifecycle-state.ts"))
    const childCode = `
      import { createHustlerLifecycleAdapter } from ${lifecycleModule};
      const config = { sisyphus: { tasks: { storage_path: process.env.HUSTLER_TEST_STORAGE, claude_code_compat: false } } };
      const adapter = createHustlerLifecycleAdapter(config);
      adapter.transition(process.env.HUSTLER_TEST_WORKFLOW_ID, { eventKey: "idle:1", nextPhase: "implementation" });
    `
    const spawnContender = () => Bun.spawn(["bun", "-e", childCode], {
      env: {
        ...process.env,
        HUSTLER_TEST_STORAGE: storagePath,
        HUSTLER_TEST_WORKFLOW_ID: created.identity.workflowId,
      },
      stderr: "pipe",
      stdout: "pipe",
    })
    const children = [spawnContender(), spawnContender()]
    const releaseTimer = setTimeout(() => heldLock.release(), 25)
    const exitCodes = await Promise.all(children.map(child => child.exited))
    clearTimeout(releaseTimer)
    heldLock.release()
    const persisted = adapter.load(created.identity.workflowId)

    // #then
    expect(exitCodes).toEqual([0, 0])
    expect(persisted?.revision).toBe(1)
    expect(persisted?.state.phase).toBe("implementation")
    expect(persisted?.events).toHaveLength(1)
  })

  test("collapses duplicate tester review replay and rejects conflicting replay", () => {
    // #given
    const { config } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_tester_replay",
      classification: classifyTask({ expectedFiles: 1 }),
    })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:implementation", nextPhase: "implementation" })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:review", nextPhase: "review" })

    // #when
    const first = adapter.recordTesterReview(created.identity.workflowId, { eventKey: "review:tester", review: approvedReview })
    const replay = adapter.recordTesterReview(created.identity.workflowId, { eventKey: "review:tester", review: approvedReview })
    const conflicting = () => adapter.recordTesterReview(created.identity.workflowId, {
      eventKey: "review:tester",
      review: { ...approvedReview, reviewSummary: "different" },
    })

    // #then
    expect(replay.revision).toBe(first.revision)
    expect(replay.events).toHaveLength(3)
    expect(conflicting).toThrow(HustlerLifecycleError)
    expect(adapter.load(created.identity.workflowId)?.revision).toBe(first.revision)
  })

  test("collapses concurrent duplicate tester reviews into one persisted review", async () => {
    // #given
    const { config, storagePath } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({ sessionId: "ses_concurrent_tester", classification: classifyTask({ expectedFiles: 1 }) })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:implementation", nextPhase: "implementation" })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:review", nextPhase: "review" })
    const directory = join(storagePath, "hustler-workflows")
    const heldLock = acquireLock(directory)
    expect(heldLock.acquired).toBe(true)
    const lifecycleModule = JSON.stringify(join(process.cwd(), "packages/omo-opencode/src/features/hustler/lifecycle-state.ts"))
    const reviewJson = JSON.stringify(approvedReview)
    const childCode = `
      import { createHustlerLifecycleAdapter } from ${lifecycleModule};
      const config = { sisyphus: { tasks: { storage_path: process.env.HUSTLER_TEST_STORAGE, claude_code_compat: false } } };
      const adapter = createHustlerLifecycleAdapter(config);
      adapter.recordTesterReview(process.env.HUSTLER_TEST_WORKFLOW_ID, { eventKey: "review:concurrent", review: JSON.parse(process.env.HUSTLER_TEST_REVIEW) });
    `
    const spawnContender = () => Bun.spawn(["bun", "-e", childCode], {
      env: { ...process.env, HUSTLER_TEST_STORAGE: storagePath, HUSTLER_TEST_WORKFLOW_ID: created.identity.workflowId, HUSTLER_TEST_REVIEW: reviewJson },
      stderr: "pipe",
      stdout: "pipe",
    })

    // #when
    const children = [spawnContender(), spawnContender()]
    const releaseTimer = setTimeout(() => heldLock.release(), 25)
    const exitCodes = await Promise.all(children.map(child => child.exited))
    clearTimeout(releaseTimer)
    heldLock.release()
    const persisted = adapter.load(created.identity.workflowId)

    // #then
    expect(exitCodes).toEqual([0, 0])
    expect(persisted?.revision).toBe(3)
    expect(persisted?.events.filter(event => event.operation === "tester_review")).toHaveLength(1)
    expect(persisted?.state.review?.status).toBe("approved")
  })

  test("collapses duplicate approver replay and rejects conflicting replay", () => {
    // #given
    const { config } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_approver_replay",
      classification: classifyTask({ expectedFiles: 1 }),
    })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:implementation", nextPhase: "implementation" })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:review", nextPhase: "review" })
    adapter.recordTesterReview(created.identity.workflowId, { eventKey: "review:tester", review: approvedReview })

    // #when
    const first = adapter.recordApproverResult(created.identity.workflowId, { eventKey: "approval:replay", result: acceptedInput })
    const replay = adapter.recordApproverResult(created.identity.workflowId, { eventKey: "approval:replay", result: acceptedInput })
    const conflicting = () => adapter.recordApproverResult(created.identity.workflowId, {
      eventKey: "approval:replay",
      result: { ...acceptedInput, completedWork: ["criterion", "different completed work"] },
    })

    // #then
    expect(replay.revision).toBe(first.revision)
    expect(replay.events).toHaveLength(4)
    expect(conflicting).toThrow(HustlerLifecycleError)
    expect(adapter.load(created.identity.workflowId)?.revision).toBe(first.revision)
  })

  test("collapses concurrent duplicate approver results into one persisted approval", async () => {
    // #given
    const { config, storagePath } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({ sessionId: "ses_concurrent_approver", classification: classifyTask({ expectedFiles: 1 }) })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:implementation", nextPhase: "implementation" })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:review", nextPhase: "review" })
    adapter.recordTesterReview(created.identity.workflowId, { eventKey: "review:approved", review: approvedReview })
    const directory = join(storagePath, "hustler-workflows")
    const heldLock = acquireLock(directory)
    expect(heldLock.acquired).toBe(true)
    const lifecycleModule = JSON.stringify(join(process.cwd(), "packages/omo-opencode/src/features/hustler/lifecycle-state.ts"))
    const approvalJson = JSON.stringify(acceptedInput)
    const childCode = `
      import { createHustlerLifecycleAdapter } from ${lifecycleModule};
      const config = { sisyphus: { tasks: { storage_path: process.env.HUSTLER_TEST_STORAGE, claude_code_compat: false } } };
      const adapter = createHustlerLifecycleAdapter(config);
      adapter.recordApproverResult(process.env.HUSTLER_TEST_WORKFLOW_ID, { eventKey: "approval:concurrent", result: JSON.parse(process.env.HUSTLER_TEST_APPROVAL) });
    `
    const spawnContender = () => Bun.spawn(["bun", "-e", childCode], {
      env: { ...process.env, HUSTLER_TEST_STORAGE: storagePath, HUSTLER_TEST_WORKFLOW_ID: created.identity.workflowId, HUSTLER_TEST_APPROVAL: approvalJson },
      stderr: "pipe",
      stdout: "pipe",
    })

    // #when
    const children = [spawnContender(), spawnContender()]
    const releaseTimer = setTimeout(() => heldLock.release(), 25)
    const exitCodes = await Promise.all(children.map(child => child.exited))
    clearTimeout(releaseTimer)
    heldLock.release()
    const persisted = adapter.load(created.identity.workflowId)

    // #then
    expect(exitCodes).toEqual([0, 0])
    expect(persisted?.revision).toBe(4)
    expect(persisted?.events.filter(event => event.operation === "approver_result")).toHaveLength(1)
    expect(persisted?.state.acceptance?.status).toBe("accepted")
  })

  test("preserves a valid record when create, load, or update receives a conflicting identity", () => {
    // #given
    const { config } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_identity_conflict",
      workflowId: "workflow-identity-conflict",
      classification: classifyTask({ expectedFiles: 1 }),
    })
    const conflictingCreate = () => adapter.create({
      sessionId: "ses_other",
      workflowId: created.identity.workflowId,
      classification: classifyTask({ expectedFiles: 1 }),
    })
    const conflictingReference = {
      workflowId: created.identity.workflowId,
      sessionId: "ses_other",
    }

    // #when
    const conflictingLoad = () => adapter.load(conflictingReference)
    const conflictingUpdate = () => adapter.recordEvent(conflictingReference, { eventKey: "identity:conflict", kind: "session_idle" })

    // #then
    expect(conflictingCreate).toThrow(HustlerLifecycleError)
    expect(conflictingLoad).toThrow(HustlerLifecycleError)
    expect(conflictingUpdate).toThrow(HustlerLifecycleError)
    expect(adapter.load(created.identity.workflowId)).toEqual(created)
  })

  test("rejects a persisted workflow ID that disagrees with its storage path", () => {
    // #given
    const { config } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_workflow_reference",
      workflowId: "workflow-reference",
      classification: classifyTask({ expectedFiles: 1 }),
    })

    const filePath = getHustlerWorkflowPath(config, created.identity.workflowId)
    const persisted = JSON.parse(readFileSync(filePath, "utf8")) as { identity: { workflowId: string } }
    persisted.identity.workflowId = "workflow-other"
    const conflictingJson = JSON.stringify(persisted)
    writeFileSync(filePath, conflictingJson, "utf8")

    // #when
    const attempt = () => adapter.load(created.identity.workflowId)

    // #then
    expect(attempt).toThrow(HustlerLifecycleError)
    expect(readFileSync(filePath, "utf8")).toBe(conflictingJson)
  })

  test("rejects a conflicting replay without changing the valid record", () => {
    // #given
    const { config } = createTestFixture()
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
    const { config } = createTestFixture()
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

  test("fails closed on conflicting persisted event history without rewriting it", () => {
    // #given
    const { config } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses_conflicting_history",
      classification: classifyTask({ expectedFiles: 1 }),
    })
    adapter.recordEvent(created.identity.workflowId, { eventKey: "idle:1", kind: "session_idle" })
    const filePath = getHustlerWorkflowPath(config, created.identity.workflowId)
    const persisted = JSON.parse(readFileSync(filePath, "utf8")) as { events: Array<{ eventKey: string; revision: number }>; revision: number }
    persisted.events.push({ ...persisted.events[0], revision: 2 })
    persisted.revision = 2
    const conflictingJson = JSON.stringify(persisted)
    writeFileSync(filePath, conflictingJson, "utf8")

    // #when
    const attempt = () => adapter.load(created.identity.workflowId)

    // #then
    expect(attempt).toThrow(HustlerLifecycleError)
    expect(readFileSync(filePath, "utf8")).toBe(conflictingJson)
  })

  test("keeps terminal completion immutable and permits exact replay only", () => {
    // #given
    const { config } = createTestFixture()
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
    const { config } = createTestFixture()
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

  test("fails every active worker on cancellation and rejects later mutation", () => {
    // #given
    const { config } = createTestFixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({ sessionId: "ses_cancel_workers", classification: classifyTask({ expectedFiles: 1 }) })
    adapter.recordWorkItem(created.identity.workflowId, { eventKey: "worker:pending", workerId: "pending", role: "developer", status: "pending", workItemId: "work-pending" })
    adapter.recordWorkItem(created.identity.workflowId, { eventKey: "worker:running", workerId: "running", role: "tester", status: "running", workItemId: "work-running" })
    adapter.recordWorkItem(created.identity.workflowId, { eventKey: "worker:completed", workerId: "completed", role: "planner", status: "completed", workItemId: "work-completed" })
    adapter.recordWorkItem(created.identity.workflowId, { eventKey: "worker:failed", workerId: "failed", role: "approver", status: "failed", workItemId: "work-failed" })

    // #when
    const cancelled = adapter.cancel(created.identity.workflowId, { eventKey: "cancel:workers" })
    const mutation = () => adapter.recordWorkItem(created.identity.workflowId, { eventKey: "worker:after-cancel", workerId: "new-worker", role: "developer", status: "running", workItemId: "work-after-cancel" })

    // #then
    expect(cancelled.state.workers.map(worker => [worker.id, worker.status])).toEqual([
      ["pending", "failed"],
      ["running", "failed"],
      ["completed", "completed"],
      ["failed", "failed"],
    ])
    expect(cancelled.status).toBe("cancelled")
    expect(mutation).toThrow(HustlerLifecycleError)
    expect(adapter.load(created.identity.workflowId)?.events).toHaveLength(5)
  })
})
