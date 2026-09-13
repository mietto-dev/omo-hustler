import { describe, expect, test } from "bun:test"

import { buildModelResolutionDetails } from "./model-resolution-details"
import { collectCapabilityResolutionIssues, getModelResolutionInfoWithOverrides } from "./model-resolution"
import type { OmoConfig } from "./model-resolution-types"

describe("doctor OpenAI GPT fast capability diagnostics", () => {
  test("preserves the configured model and variant while reporting alias-backed capabilities", () => {
    const config: OmoConfig = {
      agents: {
        developer: { model: "openai/gpt-5.6-sol-fast", variant: "xhigh" },
      },
    }
    const info = getModelResolutionInfoWithOverrides(config)
    const developer = info.agents.find((agent) => agent.name === "developer")
    const details = buildModelResolutionDetails({
      info,
      available: { providers: ["openai"], modelCount: 1, cacheExists: true },
      config,
    })
    const developerDetail = details.find((detail) => detail.includes("developer:"))

    expect(developer).toMatchObject({
      effectiveModel: "openai/gpt-5.6-sol-fast",
      userVariant: "xhigh",
      capabilityDiagnostics: {
        resolutionMode: "alias-backed",
        canonicalization: {
          source: "pattern-alias",
          ruleID: "openai-gpt-fast-service-tier-alias",
        },
      },
    })
    expect(developerDetail).toContain("openai/gpt-5.6-sol-fast (xhigh)")
    expect(developerDetail).toContain("capabilities: alias-backed")
    expect(developerDetail).not.toContain("heuristic-backed")
    expect(collectCapabilityResolutionIssues(info)).toEqual([])
  })
})
