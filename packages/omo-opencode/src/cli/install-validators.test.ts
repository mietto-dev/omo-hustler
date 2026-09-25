/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { argsToConfig, formatConfigSummary, validateNonTuiArgs } from "./install-validators"
import type { InstallArgs } from "./types"

function createArgs(overrides: Partial<InstallArgs> = {}): InstallArgs {
  return {
    tui: false,
    claude: "no",
    openai: "no",
    gemini: "no",
    copilot: "no",
    opencodeZen: "no",
    zaiCodingPlan: "no",
    kimiForCoding: "no",
    opencodeGo: "no",
    bailianCodingPlan: "no",
    minimaxCnCodingPlan: "no",
    minimaxCodingPlan: "no",
    vercelAiGateway: "no",
    skipAuth: false,
    ...overrides,
  }
}

describe("argsToConfig", () => {
  test("enables the retained OpenCode installer", () => {
    // given
    const args = createArgs({ platform: "opencode" })

    // when
    const config = argsToConfig(args)

    // then
    expect(config.platform).toBe("opencode")
    expect(config.hasOpenCode).toBe(true)
  })

  test("defaults to OpenCode when platform is omitted", () => {
    // given
    const config = argsToConfig(createArgs())

    // when / then
    expect(config.platform).toBe("opencode")
    expect(config.hasOpenCode).toBe(true)
  })

  test("enables MiniMax Coding Plan providers for OpenCode installs", () => {
    // given
    const config = argsToConfig(createArgs({ minimaxCnCodingPlan: "yes", minimaxCodingPlan: "yes" }))

    // when / then
    expect(config.hasMinimaxCnCodingPlan).toBe(true)
    expect(config.hasMinimaxCodingPlan).toBe(true)
  })

  test("enables Bailian Coding Plan for OpenCode installs", () => {
    // given
    const config = argsToConfig(createArgs({ bailianCodingPlan: "yes" }))

    // when / then
    expect(config.hasBailianCodingPlan).toBe(true)
  })
})

describe("validateNonTuiArgs", () => {
  test("rejects invalid provider values", () => {
    // given
    const args = createArgs({ opencodeGo: "maybe" as InstallArgs["opencodeGo"] })

    // when
    const result = validateNonTuiArgs(args)

    // then
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("Invalid --opencode-go value: maybe (expected: no, yes)")
  })

  test("requires OpenCode provider flags", () => {
    // given
    const args = createArgs({ claude: undefined, gemini: undefined, copilot: undefined })

    // when
    const result = validateNonTuiArgs(args)

    // then
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("--claude is required (values: no, yes, max20)")
    expect(result.errors).toContain("--gemini is required (values: no, yes)")
    expect(result.errors).toContain("--copilot is required (values: no, yes)")
  })
})

describe("formatConfigSummary", () => {
  test("shows the OpenCode platform without a Codex provider line", () => {
    // given
    const summary = formatConfigSummary(argsToConfig(createArgs()))

    // when / then
    expect(summary).toContain("Platform: opencode")
    expect(summary).not.toContain("Codex Harness")
  })

  test("describes ZAI as fallback-only in the OpenCode summary", () => {
    // given
    const summary = formatConfigSummary(argsToConfig(createArgs({ zaiCodingPlan: "yes" })))

    // when / then
    expect(summary).toContain("Z.ai Coding Plan")
    expect(summary).toContain("GLM fallbacks")
    expect(summary).not.toContain("Librarian/Multimodal")
  })

  test("describes MiniMax Coding Plan as MiniMax-M3 fallback", () => {
    // given
    const summary = formatConfigSummary(argsToConfig(createArgs({ minimaxCodingPlan: "yes" })))

    // when / then
    expect(summary).toContain("MiniMax Coding Plan (minimax.io)")
    expect(summary).toContain("MiniMax-M3 fallback")
  })
})
