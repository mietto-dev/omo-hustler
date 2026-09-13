/// <reference path="../../../../../bun-test.d.ts" />

import { describe, expect, test } from "bun:test"
import { OhMyOpenCodeConfigSchema } from "./oh-my-opencode-config"
import { BuiltinAgentNameSchema } from "./agent-names"
import { AgentOverridesSchema } from "./agent-overrides"

describe("OhMyOpenCodeConfigSchema disabled_skills", () => {
  test("accepts review-work, runtime security skills", () => {
    // given
    const config = {
      disabled_skills: [
        "review-work",
        "remove-ai-slops",
        "init-deep",
        "security-research",
        "security-review",
        "debugging",
        "visual-qa",
      ],
    }

    // when
    const result = OhMyOpenCodeConfigSchema.safeParse(config)

    // then
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.disabled_skills).toEqual([
        "review-work",
        "remove-ai-slops",
        "init-deep",
        "security-research",
        "security-review",
        "debugging",
        "visual-qa",
      ])
    }
  })
})

describe("canonical agent roster", () => {
  test("accepts exactly the seven competency roles", () => {
    // given
    const canonicalNames = [
      "orchestrator",
      "planner",
      "developer",
      "tester",
      "approver",
      "librarian",
      "architect",
    ] as const

    // when
    const parsed = canonicalNames.map((name) => BuiltinAgentNameSchema.safeParse(name))

    // then
    expect(parsed.every((result) => result.success)).toBe(true)
    expect(BuiltinAgentNameSchema.options).toEqual(canonicalNames)
  })

  test("rejects legacy agent override IDs instead of accepting aliases", () => {
    // given
    const legacyNames = ["sisyphus", "hephaestus", "prometheus", "atlas", "oracle", "explore", "metis", "momus", "sisyphus-junior"]

    // when
    const parsed = legacyNames.map((name) => AgentOverridesSchema.safeParse({ [name]: {} }))

    // then
    expect(parsed.every((result) => !result.success)).toBe(true)
  })
})
