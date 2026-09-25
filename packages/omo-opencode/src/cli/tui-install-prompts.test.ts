/// <reference types="bun-types" />

import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test"
import * as p from "@clack/prompts"
import { ULTIMATE_FALLBACK } from "./model-fallback"
import * as prompts from "./tui-install-prompts"
import type { DetectedConfig } from "./types"

function createDetectedConfig(): DetectedConfig {
  return {
    isInstalled: false,
    installedVersion: null,
    hasClaude: false,
    isMax20: false,
    hasOpenAI: false,
    hasGemini: false,
    hasCopilot: false,
    hasCodex: false,
    hasOpencodeZen: false,
    hasZaiCodingPlan: false,
    hasKimiForCoding: false,
    hasOpencodeGo: false,
    hasBailianCodingPlan: false,
    hasMinimaxCnCodingPlan: false,
    hasMinimaxCodingPlan: false,
    hasVercelAiGateway: false,
  }
}

function withTty(): () => void {
  const originalIsStdinTty = process.stdin.isTTY
  const originalIsStdoutTty = process.stdout.isTTY
  Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: true })
  Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: true })
  return () => {
    Object.defineProperty(process.stdin, "isTTY", { configurable: true, value: originalIsStdinTty })
    Object.defineProperty(process.stdout, "isTTY", { configurable: true, value: originalIsStdoutTty })
  }
}

describe("promptInstallPlatform", () => {
  let restoreTty: () => void

  beforeEach(() => { restoreTty = withTty() })
  afterEach(() => { restoreTty(); mock.restore() })

  test("offers only the retained OpenCode choice", async () => {
    // given
    const selectSpy = spyOn(p, "select").mockResolvedValue("opencode")

    // when
    const value = await prompts.promptInstallPlatform("opencode")

    // then
    expect(value).toBe("opencode")
    expect(selectSpy).toHaveBeenCalledTimes(1)
    expect(selectSpy.mock.calls[0]?.[0]).toMatchObject({
      initialValue: "opencode",
      options: [{ value: "opencode" }],
    })
  })
})

describe("promptInstallConfig", () => {
  let restoreTty: () => void

  beforeEach(() => { restoreTty = withTty() })
  afterEach(() => { restoreTty(); mock.restore() })

  test("asks all retained OpenCode questions", async () => {
    // given
    const selectSpy = spyOn(p, "select").mockResolvedValue("no")

    // when
    const config = await prompts.promptInstallConfig(createDetectedConfig(), "opencode")

    // then
    expect(config).toMatchObject({ platform: "opencode", hasOpenCode: true })
    expect(selectSpy).toHaveBeenCalledTimes(12)
  })

  test("Claude subscription No option hint uses ultimate fallback", async () => {
    // given
    const selectSpy = spyOn(p, "select").mockResolvedValue("no")

    // when
    await prompts.promptInstallConfig(createDetectedConfig(), "opencode")

    // then
    const firstCall = selectSpy.mock.calls[0]?.[0]
    expect(firstCall?.message).toBe("Do you have a Claude Pro/Max subscription?")
    const options = firstCall?.options as Array<{ value: string; hint?: string }>
    const noOption = options?.find((option) => option.value === "no")
    expect(noOption?.hint).toContain(ULTIMATE_FALLBACK)
    expect(noOption?.hint).not.toContain("big-pickle")
  })
})
