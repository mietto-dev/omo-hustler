import { describe, expect, test } from "bun:test"
import { migrateAgentNames } from "./migration"
import { getAgentDisplayName } from "./agent-display-names"
import { AGENT_MODEL_REQUIREMENTS } from "./model-requirements"

const CANONICAL_AGENTS = ["orchestrator", "planner", "developer", "tester", "approver", "librarian", "architect"] as const

describe("Agent Config Integration", () => {
  test("canonical config keys pass through without migration", () => {
    const config = Object.fromEntries(CANONICAL_AGENTS.map((name) => [name, { model: `provider/${name}` }]))

    expect(migrateAgentNames(config)).toEqual({ migrated: config, changed: false })
  })

  test("canonical display names resolve", () => {
    expect(CANONICAL_AGENTS.map((name) => getAgentDisplayName(name))).toEqual([
      "Orchestrator",
      "Planner",
      "Developer",
      "Tester",
      "Approver",
      "Librarian",
      "Architect",
    ])
  })

  test("model requirements contain exactly the canonical agents", () => {
    expect(Object.keys(AGENT_MODEL_REQUIREMENTS).sort()).toEqual([...CANONICAL_AGENTS].sort())
  })

  test("unknown display names remain unchanged", () => {
    expect(getAgentDisplayName("custom-agent")).toBe("custom-agent")
  })
})
