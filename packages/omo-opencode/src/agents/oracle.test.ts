import { describe, expect, test } from "bun:test"

import { ARCHITECT_PROMPT_METADATA, createOracleAgent } from "./oracle"

describe("createOracleAgent", () => {
  test("exposes Architect as the active role identity", () => {
    // given
    const agent = createOracleAgent("openai/gpt-5.6-sol")

    // when
    const metadata = ARCHITECT_PROMPT_METADATA

    // then
    expect(metadata.promptAlias).toBe("Architect")
    expect(agent.permission?.call_omo_agent).toBeUndefined()
  })

  test("uses xhigh reasoning effort for gpt-5.6", () => {
    // given
    const model = "openai/gpt-5.6-sol"

    // when
    const agent = createOracleAgent(model)

    // then
    expect(agent.reasoningEffort).toBe("xhigh")
  })

  test("uses xhigh reasoning effort for GPT-6 Astra frontier routing", () => {
    expect(createOracleAgent("github-copilot/gpt-6-astra").reasoningEffort).toBe("xhigh")
  })

  test("preserves medium reasoning effort for gpt-5.5 fallback", () => {
    // given
    const model = "openai/gpt-5.5"

    // when
    const agent = createOracleAgent(model)

    // then
    expect(agent.reasoningEffort).toBe("medium")
  })
})
