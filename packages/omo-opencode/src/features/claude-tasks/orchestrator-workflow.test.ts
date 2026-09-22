import { describe, expect, test } from "bun:test"
import { ApproverInputSchema, PlannerPlanSchema, TesterReviewSchema } from "./workflow-contracts"
import { OrchestratorWorkflowConfigSchema } from "../../config/schema/workflow"
import {
  OrchestratorTaskSignalsSchema,
  WorkflowClassificationError,
  WorkflowStateError,
  attachPlannerPlan,
  classifyTask,
  createWorkflowState,
  getWorkflowRouting,
  readWorkflowStateMetadata,
  recordApproverResult,
  recordTesterReview,
  resolveRetryRoute,
  transitionWorkflowState,
  writeWorkflowStateMetadata,
} from "./orchestrator-workflow"

const plannerPlan = PlannerPlanSchema.parse({
  summary: "Implement the feature",
  workItems: [{
    id: "work-1",
    objective: "Implement the feature",
    scope: ["packages/app"],
    dependencies: [],
    skills: ["typescript"],
    acceptanceCriteria: ["The feature works"],
  }],
  parallelGroups: [],
  risks: [],
  finalAcceptance: ["Tests pass"],
})

describe("orchestrator workflow classification", () => {
  test("routes security, destructive, and cross-service signals to Tier 3", () => {
    expect(classifyTask({ securitySensitive: true, expectedFiles: 1 }).tier).toBe(3)
    expect(classifyTask({ destructiveMigration: true }).tier).toBe(3)
    expect(classifyTask({ crossServiceArchitecture: true }).tier).toBe(3)
  })

  test("routes multi-layer and multi-workstream signals to Tier 2", () => {
    expect(classifyTask({ layers: 2 }).tier).toBe(2)
    expect(classifyTask({ workstreams: 2 }).tier).toBe(2)
    expect(classifyTask({ expectedFiles: 5 }).tier).toBe(2)
  })

  test("keeps localized work on Tier 0 and other small work on Tier 1", () => {
    expect(classifyTask({ localized: true, expectedFiles: 1 }).tier).toBe(0)
    expect(classifyTask({ expectedFiles: 1 }).tier).toBe(1)
  })

  test("rejects contradictory signals and unsafe tier overrides", () => {
    expect(() => classifyTask({ localized: true, securitySensitive: true })).toThrow(WorkflowClassificationError)
    expect(() => classifyTask({ securitySensitive: true, tierOverride: 2 })).toThrow(WorkflowClassificationError)
    expect(OrchestratorTaskSignalsSchema.safeParse({ tierOverride: 4 }).success).toBe(false)
  })

  test("uses validated configurable thresholds", () => {
    const config = OrchestratorWorkflowConfigSchema.parse({
      thresholds: { layers: 3, workstreams: 4, expected_files: 8 },
    })

    expect(classifyTask({ layers: 2 }, config.thresholds).tier).toBe(1)
    expect(classifyTask({ layers: 3 }, config.thresholds).tier).toBe(2)
    expect(OrchestratorWorkflowConfigSchema.safeParse({ thresholds: { layers: 1 } }).success).toBe(false)
    expect(OrchestratorWorkflowConfigSchema.safeParse({ default_tier: 4 }).success).toBe(false)
  })
})

describe("orchestrator workflow routing", () => {
  test("skips Planner and Tester for Tier 0 by default", () => {
    expect(getWorkflowRouting({ tier: 0, signals: { localized: true } })).toEqual({
      requiresPlanner: false,
      requiresTester: false,
      requiresPreflightTester: false,
      architectReason: undefined,
    })
  })

  test("requires Planner and Tester for Tier 2", () => {
    expect(getWorkflowRouting({ tier: 2, signals: { layers: 2 } })).toMatchObject({
      requiresPlanner: true,
      requiresTester: true,
      requiresPreflightTester: false,
    })
  })

  test("supports Tier 3 preflight Tester and reason-coded Architect routing", () => {
    expect(getWorkflowRouting({ tier: 3, signals: { securitySensitive: true } })).toMatchObject({
      requiresPlanner: true,
      requiresTester: true,
      requiresPreflightTester: true,
      architectReason: "security",
    })
  })
})

describe("orchestrator workflow state", () => {
  const passingVerification = {
    tests: "pass",
    build: "pass",
    lint: "pass",
    typecheck: "pass",
  } as const

  function reviewState() {
    const routing = createWorkflowState("task-1", 1)
    const implementation = transitionWorkflowState(routing, "implementation")
    return transitionWorkflowState(implementation, "review")
  }

  test("rejects Tier 2 implementation without Planner evidence", () => {
    const state = createWorkflowState("task-1", 2)

    expect(() => transitionWorkflowState(state, "implementation")).toThrow(WorkflowStateError)
    expect(() => transitionWorkflowState(state, "implementation")).toThrow("Planner evidence")
  })

  test("rejects illegal phase transitions and accepts a planned Tier 2 flow", () => {
    const state = createWorkflowState("task-1", 2)
    expect(() => transitionWorkflowState(state, "complete")).toThrow(WorkflowStateError)

    const planning = transitionWorkflowState(state, "planning")
    const planned = attachPlannerPlan(planning, plannerPlan)
    const implementation = transitionWorkflowState(planned, "implementation")
    expect(implementation.phase).toBe("implementation")
  })

  test("routes retries deterministically to the smallest responsible target", () => {
    expect(resolveRetryRoute({ failure: "developer", workItemId: "work-2" })).toEqual({
      role: "developer",
      workItemId: "work-2",
      phase: "implementation",
    })
    expect(resolveRetryRoute({ failure: "developer", workItemId: "work-2", planInvalidated: true })).toEqual({
      role: "planner",
      workItemId: undefined,
      phase: "planning",
    })
    expect(resolveRetryRoute({ failure: "tester", workItemId: "work-2" })).toEqual({
      role: "developer",
      workItemId: "work-2",
      phase: "implementation",
    })
    expect(() => resolveRetryRoute({ failure: "approver" })).toThrow(WorkflowStateError)
  })

  test("round-trips state through existing task metadata", () => {
    const state = createWorkflowState("task-1", 0)
    const metadata = writeWorkflowStateMetadata({ priority: "high" }, state)

    expect(readWorkflowStateMetadata(metadata)).toEqual(state)
    expect(metadata.priority).toBe("high")
  })

  test("records complete review and acceptance before completing the workflow", () => {
    const review = TesterReviewSchema.parse({
      status: "approved",
      issues: [],
      reviewSummary: "Review passed",
      verification: passingVerification,
    })
    const reviewAccepted = recordTesterReview(reviewState(), review)
    const acceptanceInput = ApproverInputSchema.parse({
      originalRequest: "Implement the feature",
      acceptanceCriteria: ["The feature works"],
      completedWork: ["The feature works"],
      unresolvedIssues: [],
      verification: passingVerification,
    })
    const accepted = recordApproverResult(reviewAccepted, acceptanceInput)

    expect(accepted.phase).toBe("acceptance")
    expect(accepted.acceptance?.status).toBe("accepted")
    expect(transitionWorkflowState(accepted, "complete").phase).toBe("complete")
  })

  test("rejects direct completion before acceptance is recorded", () => {
    const routing = createWorkflowState("task-1", 1)
    const implementation = transitionWorkflowState(routing, "implementation")
    const acceptance = transitionWorkflowState(implementation, "acceptance")

    expect(() => transitionWorkflowState(acceptance, "complete")).toThrow(WorkflowStateError)
    expect(() => transitionWorkflowState(acceptance, "complete")).toThrow("Approver acceptance")
  })

  test("rejects bypassing Tester approval on the review-to-acceptance edge", () => {
    expect(() => transitionWorkflowState(reviewState(), "acceptance")).toThrow("Tester approval")
  })

  test("routes Tester changes to the targeted Developer work item", () => {
    const review = TesterReviewSchema.parse({
      status: "changes_requested",
      issues: [{
        severity: "high",
        description: "The build path is not covered",
        requiredFix: "Add the missing build-path test",
        workItemId: "work-2",
      }],
      reviewSummary: "A targeted fix is required",
      verification: { ...passingVerification, build: "fail" },
    })

    const routed = recordTesterReview(reviewState(), review)

    expect(routed.phase).toBe("implementation")
    expect(routed.lastRetry).toEqual({
      role: "developer",
      workItemId: "work-2",
      phase: "implementation",
    })
  })

  test("routes incomplete Approver acceptance to the requested Developer work item", () => {
    const review = TesterReviewSchema.parse({
      status: "approved",
      issues: [],
      reviewSummary: "Review passed",
      verification: passingVerification,
    })
    const reviewAccepted = recordTesterReview(reviewState(), review)
    const incompleteInput = ApproverInputSchema.parse({
      originalRequest: "Implement the feature",
      acceptanceCriteria: ["The feature works", "The feature is documented"],
      completedWork: ["The feature works"],
      unresolvedIssues: [],
      verification: passingVerification,
    })

    const routed = recordApproverResult(reviewAccepted, incompleteInput, "work-3")

    expect(routed.phase).toBe("implementation")
    expect(routed.acceptance?.status).toBe("incomplete")
    expect(routed.lastRetry?.workItemId).toBe("work-3")
  })
})
