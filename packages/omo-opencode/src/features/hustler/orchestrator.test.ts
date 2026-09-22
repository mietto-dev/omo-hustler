import { describe, expect, test } from "bun:test"
import { startHustlerWorkflow } from "./orchestrator"

describe("OpenCode HUSTLER workflow adapter", () => {
  test("starts through the OpenCode-owned feature boundary", () => {
    const workflow = startHustlerWorkflow({
      taskId: "task-1",
      signals: { localized: true, expectedFiles: 1 },
    })

    expect(workflow.classification.tier).toBe(0)
    expect(workflow.state.phase).toBe("implementation")
  })
})
