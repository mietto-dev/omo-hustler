import { describe, expect, test } from "bun:test"

import { unsafeTestValue } from "../../../../test-support/unsafe-test-value"
import { collectPendingBuiltinAgents } from "./builtin-agents/general-agents"
import { createMomusAgent } from "./momus"

type AgentSources = Parameters<typeof collectPendingBuiltinAgents>[0]["agentSources"]

describe("Tester GPT-6 Astra warm-cache registration", () => {
  test("registers Copilot astra ahead of transformed Vercel astra", () => {
    // given
    const availableModels = new Set([
      "github-copilot/gpt-6-astra",
      "vercel/openai/gpt-6-astra",
    ])

    // when
    const { pendingAgentConfigs } = collectPendingBuiltinAgents({
      agentSources: unsafeTestValue<AgentSources>({ tester: createMomusAgent }),
      agentMetadata: {},
      disabledAgents: [],
      agentOverrides: {},
      mergedCategories: {},
      availableModels,
      isFirstRunNoCache: false,
    })
    const config = pendingAgentConfigs.get("tester")

    // then
    expect(config?.model).toBe("github-copilot/gpt-6-astra")
    expect(config?.variant).toBe("high")
  })
})
