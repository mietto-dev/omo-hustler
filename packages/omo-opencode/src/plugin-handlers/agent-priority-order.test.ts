import { describe, expect, test } from "bun:test"
import { CANONICAL_CORE_AGENT_ORDER, reorderAgentsByPriority } from "./agent-priority-order"
import { CANONICAL_CORE_AGENT_ORDER as RUNTIME_CANONICAL_CORE_AGENT_ORDER } from "../shared/agent-runtime-name-sort"

describe("agent-priority-order", () => {
  test("uses the five workflow roles in canonical order", () => {
    // given / when
    const order = RUNTIME_CANONICAL_CORE_AGENT_ORDER

    // then
    expect(order).toEqual(["orchestrator", "developer", "planner", "approver", "tester", "librarian", "architect"])
  })

  test("places canonical display names before custom agents", () => {
    // given
    const agents = {
      custom: { name: "custom" },
      Approver: { name: "Approver" },
      Orchestrator: { name: "Orchestrator" },
      Planner: { name: "Planner" },
      Developer: { name: "Developer" },
      Tester: { name: "Tester" },
    }

    // when
    const result = reorderAgentsByPriority(agents, RUNTIME_CANONICAL_CORE_AGENT_ORDER)

    // then
    expect(Object.keys(result)).toEqual(["Orchestrator", "Developer", "Planner", "Approver", "Tester", "custom"])
  })
})
