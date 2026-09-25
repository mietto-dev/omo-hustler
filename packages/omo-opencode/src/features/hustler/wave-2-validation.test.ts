import { afterAll, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  ApproverInputSchema,
  DeveloperTaskContractSchema,
  PlannerPlanSchema,
  TesterReviewSchema,
  WorkflowContractSchema,
} from "../opencode-tasks/workflow-contracts"
import { classifyTask } from "../opencode-tasks/orchestrator-classification"
import { createHustlerEventLifecycle } from "./event-lifecycle"
import { createHustlerLifecycleAdapter } from "./lifecycle-state"
import { buildTaskPromptBody } from "../background-agent/spawner/task-prompt-body"
import { createSyncSession } from "../../tools/delegate-task/sync-session-creator"

const fixtures = new Set<string>()
const verification = { tests: "pass", build: "pass", lint: "pass", typecheck: "pass" } as const

function fixture() {
  const storagePath = mkdtempSync(join(tmpdir(), "hustler-wave-2-"))
  fixtures.add(storagePath)
  return {
    storagePath,
    config: { sisyphus: { tasks: { storage_path: storagePath } } },
  }
}

function plannerEvidence() {
  return PlannerPlanSchema.parse({
    summary: "Build the requested feature",
    workItems: [{ id: "work-1", objective: "Implement the feature", scope: ["packages/app"], dependencies: [], skills: [], acceptanceCriteria: ["It works"] }],
    parallelGroups: [["work-1"]],
    risks: [],
    finalAcceptance: ["It works"],
  })
}

function developerContract(withEvidence = true) {
  return DeveloperTaskContractSchema.parse({
    id: "work-1",
    objective: "Implement the feature",
    scope: ["packages/app"],
    acceptanceCriteria: ["It works"],
    ...(withEvidence ? { plannerEvidence: plannerEvidence() } : {}),
  })
}

function metadata(role: "planner" | "developer" | "tester" | "approver", tier = 0) {
  return { role, workflowId: "WF-wave-2", taskId: "T-wave-2", ...(role === "planner" ? {} : { workItemId: "work-1" }), tier }
}

function contract(role: "planner" | "developer" | "tester" | "approver", tier = 0) {
  if (role === "planner") {
    return WorkflowContractSchema.parse({ kind: role, metadata: metadata(role, tier), contract: plannerEvidence() })
  }
  if (role === "developer") {
    return WorkflowContractSchema.parse({ kind: role, metadata: metadata(role, tier), contract: developerContract(tier < 2 ? true : true) })
  }
  if (role === "tester") {
    return WorkflowContractSchema.parse({
      kind: role,
      metadata: metadata(role, tier),
      contract: { status: "approved", issues: [], reviewSummary: "Verified", verification },
    })
  }
  return WorkflowContractSchema.parse({
    kind: role,
    metadata: metadata(role, tier),
    contract: { originalRequest: "Build it", acceptanceCriteria: ["It works"], completedWork: ["It works"], unresolvedIssues: [], verification },
  })
}

afterAll(() => {
  for (const path of fixtures) rmSync(path, { recursive: true, force: true })
})

describe("Wave 2 HUSTLER contracts and event lifecycle", () => {
  test("accepts canonical contracts and rejects malformed, role-mismatched, and legacy-only metadata", () => {
    // #given
    const valid = contract("developer")

    // #when
    const malformed = WorkflowContractSchema.safeParse({ kind: "developer", metadata: metadata("developer"), contract: { id: "work-1" } })
    const mismatched = WorkflowContractSchema.safeParse({ ...valid, metadata: metadata("tester") })
    const legacy = WorkflowContractSchema.safeParse({ kind: "sisyphus", metadata: metadata("developer"), contract: {} })

    // #then
    expect(WorkflowContractSchema.safeParse(valid).success).toBe(true)
    expect(malformed.success).toBe(false)
    expect(mismatched.success).toBe(false)
    expect(legacy.success).toBe(false)
  })

  test("requires planner evidence before a Tier 2 developer contract can run", () => {
    // #given
    const withoutEvidence = { kind: "developer", metadata: metadata("developer", 2), contract: developerContract(false) }
    const withEvidence = { kind: "developer", metadata: metadata("developer", 2), contract: developerContract(true) }

    // #when
    const rejected = WorkflowContractSchema.safeParse(withoutEvidence)
    const accepted = WorkflowContractSchema.safeParse(withEvidence)

    // #then
    expect(rejected.success).toBe(false)
    expect(accepted.success).toBe(true)
  })

  test("propagates the same workflow contract through background prompt and synchronous child creation", async () => {
    // #given
    const workflowContract = contract("developer", 2)
    const promptBody = buildTaskPromptBody({ kind: "launch", agent: "developer", system: undefined, model: undefined, prompt: "Implement it", includeTeamToolDenylist: true, workflowContract })
    const createdBodies: Record<string, unknown>[] = []
    const client = {
      session: {
        get: async () => ({ data: { directory: "/repo" } }),
        create: async (input: { body: Record<string, unknown> }) => { createdBodies.push(input.body); return { data: { id: "ses-child" } } },
      },
    }

    // #when
    const child = await createSyncSession(client as never, { parentSessionID: "ses-parent", agentToUse: "developer", description: "Implement it", defaultDirectory: "/fallback", workflowContract })

    // #then
    expect(promptBody.metadata?.workflowContract).toEqual(workflowContract)
    expect(child).toEqual({ ok: true, sessionID: "ses-child", parentDirectory: "/repo" })
    expect(createdBodies[0]?.metadata).toEqual({ workflowContract })
  })

  test("records Tier 0 completion exactly once and suppresses repeated idle/error recovery", () => {
    // #given
    const { config } = fixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({ sessionId: "ses-tier-0-events", classification: classifyTask({ localized: true, expectedFiles: 1 }) })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:implementation", nextPhase: "implementation" })
    const events = createHustlerEventLifecycle(config, adapter)

    // #when
    events.toolResult({ tool: "task", sessionID: "ses-tier-0-events", callID: "developer-1", output: { metadata: { workflowContract: { ...contract("developer"), metadata: { ...metadata("developer"), workflowId: created.identity.workflowId } } } } })
    events.event({ type: "session.idle", properties: { sessionID: "ses-tier-0-events", messageID: "idle-1" } })
    events.event({ type: "session.idle", properties: { sessionID: "ses-tier-0-events", messageID: "idle-1" } })
    events.event({ type: "session.error", properties: { sessionID: "ses-tier-0-events", messageID: "error-1", error: { name: "ProviderError", message: "provider failed" } } })
    events.event({ type: "session.error", properties: { sessionID: "ses-tier-0-events", messageID: "error-1", error: { name: "ProviderError", message: "provider failed" } } })

    // #then
    const record = adapter.load(created.identity.workflowId)
    expect(record?.status).toBe("failed")
    expect(record?.events.filter(event => event.operation === "complete")).toHaveLength(0)
    expect(record?.events.filter(event => event.operation === "fail")).toHaveLength(1)
  })

  test("accepts tester and approver results before exactly-once completion, while rejection stays non-terminal", () => {
    // #given
    const { config } = fixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({ sessionId: "ses-acceptance", classification: classifyTask({ localized: true, expectedFiles: 1 }) })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:implementation", nextPhase: "implementation" })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:review", nextPhase: "review" })
    const events = createHustlerEventLifecycle(config, adapter)
    const tester = { ...contract("tester"), metadata: { ...metadata("tester"), workflowId: created.identity.workflowId, taskId: created.identity.taskId } }
    const approver = { ...contract("approver"), metadata: { ...metadata("approver"), workflowId: created.identity.workflowId, taskId: created.identity.taskId } }

    // #when
    events.toolResult({ tool: "task", sessionID: "ses-acceptance", callID: "tester-reject", output: { metadata: { workflowContract: tester, workflowResult: { status: "changes_requested", issues: [{ severity: "medium", description: "fix", requiredFix: "fix", workItemId: "work-1" }], reviewSummary: "Needs work", verification: { ...verification, tests: "fail" } } } } })
    const rejected = adapter.load(created.identity.workflowId)
    adapter.retry(created.identity.workflowId, { eventKey: "retry:tester", failure: "tester", workItemId: "work-1" })
    adapter.transition(created.identity.workflowId, { eventKey: "phase:review-again", nextPhase: "review" })
    events.toolResult({ tool: "task", sessionID: "ses-acceptance", callID: "tester-accept", output: { metadata: { workflowContract: tester, workflowResult: tester.contract } } })
    events.toolResult({ tool: "task", sessionID: "ses-acceptance", callID: "approver-accept", output: { metadata: { workflowContract: approver, workflowResult: approver.contract } } })
    events.event({ type: "session.idle", properties: { sessionID: "ses-acceptance", messageID: "idle-complete" } })
    events.event({ type: "session.idle", properties: { sessionID: "ses-acceptance", messageID: "idle-complete" } })

    // #then
    expect(rejected?.state.review?.status).toBe("changes_requested")
    const completed = adapter.load(created.identity.workflowId)
    expect(completed?.status).toBe("completed")
    expect(completed?.events.filter(event => event.operation === "complete")).toHaveLength(1)
  })

  test("cancellation is terminal and repeated cancellation does not mutate state", () => {
    // #given
    const { config } = fixture()
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({ sessionId: "ses-cancel", classification: classifyTask({ localized: true, expectedFiles: 1 }) })
    const events = createHustlerEventLifecycle(config, adapter)

    // #when
    events.event({ type: "session.cancel", properties: { sessionID: "ses-cancel", messageID: "cancel-1" } })
    const first = adapter.load(created.identity.workflowId)
    events.event({ type: "session.cancel", properties: { sessionID: "ses-cancel", messageID: "cancel-1" } })
    const replay = adapter.load(created.identity.workflowId)

    // #then
    expect(first?.status).toBe("cancelled")
    expect(replay?.revision).toBe(first?.revision)
    expect(replay?.events.filter(event => event.operation === "cancel")).toHaveLength(1)
  })
})
