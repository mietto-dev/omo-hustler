import { describe, expect, test } from "bun:test"
import {
  applyHustlerApproverResult,
  applyHustlerTesterReview,
  advanceHustlerWorkflowToReview,
  completeHustlerWorkflow,
  startHustlerWorkflow,
} from "./orchestrator"

const verification = {
  tests: "pass",
  build: "pass",
  lint: "pass",
  typecheck: "pass",
} as const

describe("HUSTLER workflow entrypoint", () => {
  test("runs a Tier 0 workflow through review and acceptance", () => {
    const started = startHustlerWorkflow({
      taskId: "task-1",
      signals: { localized: true, expectedFiles: 1 },
    })
    const reviewState = advanceHustlerWorkflowToReview(started.state)
    const testerState = applyHustlerTesterReview(reviewState, {
      status: "approved",
      issues: [],
      reviewSummary: "The localized change is complete",
      verification,
    })
    const acceptedState = applyHustlerApproverResult(testerState, {
      originalRequest: "Fix the localized issue",
      acceptanceCriteria: ["The issue is fixed"],
      completedWork: ["The issue is fixed"],
      unresolvedIssues: [],
      verification,
    })

    expect(completeHustlerWorkflow(acceptedState).phase).toBe("complete")
  })

  test("stops a Tier 2 workflow in planning until Planner evidence exists", () => {
    const started = startHustlerWorkflow({
      taskId: "task-2",
      signals: { layers: 2 },
    })

    expect(started.classification.tier).toBe(2)
    expect(started.state.phase).toBe("planning")
  })
})
