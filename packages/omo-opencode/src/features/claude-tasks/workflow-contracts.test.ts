import { describe, expect, test } from "bun:test"
import {
  DeveloperTaskContractSchema,
  PlannerPlanSchema,
} from "./workflow-contracts"
import { buildTaskRecord } from "../background-agent/spawner/task-record"

describe("workflow contracts", () => {
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
})
