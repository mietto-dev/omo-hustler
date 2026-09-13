import { describe, expect, test } from "bun:test"
import { AGENT_MODEL_REQUIREMENTS } from "./agent-model-requirements"

describe("AGENT_MODEL_REQUIREMENTS", () => {
  test("contains the canonical seven-role roster", () => {
    // given
    const expectedNames = ["orchestrator", "planner", "developer", "tester", "approver", "librarian", "architect"]

    // when
    const names = Object.keys(AGENT_MODEL_REQUIREMENTS)

    // then
    expect(new Set(names)).toEqual(new Set(expectedNames))
  })

  test("routes each role to its required model class", () => {
    // given
    const primaryModels = Object.fromEntries(
      Object.entries(AGENT_MODEL_REQUIREMENTS).map(([name, requirement]) => [name, requirement.fallbackChain[0]?.model]),
    )

    // when
    const roleModels = primaryModels

    // then
    expect(roleModels.orchestrator).toBe("claude-opus-5")
    expect(roleModels.planner).toBe("claude-fable-5-1")
    expect(roleModels.developer).toBe("gpt-5.6-sol")
    expect(roleModels.tester).toBe("gpt-6-astra")
    expect(roleModels.approver).toBe("claude-sonnet-5")
    expect(roleModels.librarian).toBe("gpt-5.6-luna-fast")
    expect(roleModels.architect).toBe("gpt-5.6-sol")
  })

  test("does not retain legacy routing keys", () => {
    // given
    const legacyNames = ["sisyphus", "hephaestus", "prometheus", "oracle", "explore", "multimodal-looker", "metis", "momus", "atlas", "sisyphus-junior"]

    // when
    const hasLegacyKey = legacyNames.some((name) => name in AGENT_MODEL_REQUIREMENTS)

    // then
    expect(hasLegacyKey).toBe(false)
  })
})
