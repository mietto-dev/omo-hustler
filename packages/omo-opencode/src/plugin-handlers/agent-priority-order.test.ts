import { describe, expect, test } from "bun:test"
import { CANONICAL_CORE_AGENT_ORDER, reorderAgentsByPriority } from "./agent-priority-order"
import { CANONICAL_CORE_AGENT_ORDER as RUNTIME_CANONICAL_CORE_AGENT_ORDER } from "../shared/agent-runtime-name-sort"
import { validateAgentOrder } from "../shared/agent-ordering"

describe("agent-priority-order", () => {
  test("uses the seven HUSTLER roles in canonical order", () => {
    // given / when
    const order = RUNTIME_CANONICAL_CORE_AGENT_ORDER

    // then
    expect(order).toEqual(["orchestrator", "planner", "developer", "tester", "approver", "librarian", "architect"])
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
    expect(Object.keys(result)).toEqual(["Orchestrator", "Planner", "Developer", "Tester", "Approver", "custom"])
  })

  test("rejects stale legacy and unknown order entries while retaining canonical defaults", () => {
    // given an order containing a legacy name, an unknown name, and a duplicate
    const validation = validateAgentOrder(["Atlas", "architect", "unknown", "architect"])

    // then invalid entries are reported and the canonical order is deduplicated
    expect(validation.invalid).toEqual(["Atlas", "unknown"])
    expect(validation.duplicates).toEqual(["architect"])
    expect(validation.order).toEqual([
      "architect",
      "orchestrator",
      "planner",
      "developer",
      "tester",
      "approver",
      "librarian",
    ])
  })
})
