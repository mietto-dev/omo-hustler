import { describe, expect, test } from "bun:test"
import {
  ApproverInputSchema,
  ApproverResultSchema,
  ActionableTesterIssueSchema,
  DeveloperTaskContractSchema,
  PlannerPlanSchema,
  resolveApproverResult,
  TesterReviewSchema,
} from "./workflow-contracts"
import { buildTaskRecord } from "../background-agent/spawner/task-record"

describe("workflow contracts", () => {
  const passingVerification = {
    tests: "pass",
    build: "pass",
    lint: "pass",
    typecheck: "pass",
  } as const

  test("rejects duplicate and unknown Planner dependencies", () => {
    const result = PlannerPlanSchema.safeParse({
      summary: "Implement the feature",
      workItems: [
        {
          id: "work-1",
          objective: "Build the first part",
          scope: ["packages/app"],
          dependencies: ["work-1", "missing"],
          skills: ["typescript"],
          acceptanceCriteria: ["The first part works"],
        },
        {
          id: "work-1",
          objective: "Build the second part",
          scope: ["packages/app"],
          dependencies: [],
          skills: [],
          acceptanceCriteria: ["The second part works"],
        },
      ],
      parallelGroups: [["missing"]],
      risks: [],
      finalAcceptance: ["The feature is verified"],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map(issue => issue.path.join("."))).toEqual(expect.arrayContaining([
      "workItems.1.id",
      "workItems.0.dependencies.0",
      "workItems.0.dependencies.1",
      "parallelGroups.0.0",
    ]))
  })

  test("rejects Developer files outside the declared scope", () => {
    const result = DeveloperTaskContractSchema.safeParse({
      id: "work-1",
      objective: "Implement the feature",
      scope: ["packages/app"],
      acceptanceCriteria: ["The feature works"],
      relevantFiles: ["packages/other/file.ts"],
    })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.some(issue => issue.path.join(".") === "relevantFiles.0")).toBe(true)
  })

  test("preserves valid planning fields and background task records", () => {
    const plan = PlannerPlanSchema.parse({
      summary: "Implement the feature",
      workItems: [{
        id: "work-1",
        objective: "Build the feature",
        scope: ["packages/app"],
        dependencies: [],
        skills: ["typescript"],
        acceptanceCriteria: ["The feature works"],
      }],
      parallelGroups: [["work-1"]],
      risks: [{
        severity: "medium",
        description: "The API may change",
        requiresArchitect: false,
        requiresPreflightReview: true,
      }],
      finalAcceptance: ["Tests pass"],
    })
    const developer = DeveloperTaskContractSchema.parse({
      id: "work-1",
      objective: "Build the feature",
      scope: ["packages/app"],
      acceptanceCriteria: ["The feature works"],
      relevantFiles: ["packages/app/index.ts"],
      forbiddenScope: ["packages/app/generated"],
      skills: ["typescript"],
      dependencies: ["setup"],
    })
    const task = buildTaskRecord({
      description: "Build feature",
      prompt: "Build feature",
      agent: "developer",
      parentSessionId: "parent",
      parentMessageId: "message",
      workflowContract: { kind: "developer", contract: developer },
    }, "bg_test", new Date(0))

    expect(plan.parallelGroups).toEqual([["work-1"]])
    expect(plan.workItems[0]?.skills).toEqual(["typescript"])
    expect(task.workflowContract).toEqual({ kind: "developer", contract: developer })
  })

  test("accepts a complete Tester review and Approver result", () => {
    const review = TesterReviewSchema.parse({
      status: "approved",
      issues: [],
      reviewSummary: "Implementation satisfies the requested behavior",
      verification: passingVerification,
    })
    const input = ApproverInputSchema.parse({
      originalRequest: "Implement the feature",
      acceptanceCriteria: ["The feature works"],
      completedWork: ["The feature works"],
      unresolvedIssues: [],
      verification: passingVerification,
    })

    expect(review.status).toBe("approved")
    expect(resolveApproverResult(input)).toEqual({ status: "accepted", missingCriteria: [] })
  })

  test("reports an exact missing acceptance criterion", () => {
    const input = ApproverInputSchema.parse({
      originalRequest: "Implement the feature",
      acceptanceCriteria: ["The feature works", "The feature is documented"],
      completedWork: ["The feature works"],
      unresolvedIssues: [],
      verification: passingVerification,
    })

    expect(resolveApproverResult(input)).toEqual({
      status: "incomplete",
      missingCriteria: ["The feature is documented"],
    })
  })

  test("rejects an approved Tester review when the build fails", () => {
    const result = TesterReviewSchema.safeParse({
      status: "approved",
      issues: [],
      reviewSummary: "The implementation looks complete",
      verification: { ...passingVerification, build: "fail" },
    })

    expect(result.success).toBe(false)
  })

  test("rejects an approved Tester review with an unresolved high-severity issue", () => {
    const issue = ActionableTesterIssueSchema.parse({
      severity: "high",
      file: "packages/app/index.ts",
      description: "The error path drops the response body",
      requiredFix: "Preserve and assert the response body before returning",
      workItemId: "work-1",
    })
    const result = TesterReviewSchema.safeParse({
      status: "approved",
      issues: [issue],
      reviewSummary: "The implementation looks complete",
      verification: passingVerification,
    })

    expect(result.success).toBe(false)
  })

  test("requires actionable issues for a changes-requested review", () => {
    const result = TesterReviewSchema.safeParse({
      status: "changes_requested",
      issues: [],
      reviewSummary: "The implementation needs a fix",
      verification: { ...passingVerification, tests: "fail" },
    })

    expect(result.success).toBe(false)
  })

  test("requires missing criteria only for an incomplete Approver result", () => {
    expect(ApproverResultSchema.safeParse({ status: "accepted", missingCriteria: ["criterion"] }).success).toBe(false)
    expect(ApproverResultSchema.safeParse({ status: "incomplete", missingCriteria: [] }).success).toBe(false)
  })
})
