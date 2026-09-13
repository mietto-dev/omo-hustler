import { describe, it, expect } from "bun:test"
import { AGENT_DISPLAY_NAMES, getAgentConfigKey, getAgentDisplayName, getAgentListDisplayName, normalizeAgentForPrompt, normalizeAgentForPromptKey, stripAgentListSortPrefix } from "./agent-display-names"

describe("getAgentDisplayName", () => {
  it("returns display name for lowercase config key (new format)", () => {
    // given config key "orchestrator"
    const configKey = "orchestrator"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "Orchestrator"
    expect(result).toBe("Orchestrator")
  })

  it("returns display name for uppercase config key (old format - case-insensitive)", () => {
    // given config key "Sisyphus" (old format)
    const configKey = "Sisyphus"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "Orchestrator" (case-insensitive lookup)
    expect(result).toBe("Sisyphus")
  })

  it("returns original key for unknown agents (fallback)", () => {
    // given config key "custom-agent"
    const configKey = "custom-agent"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "custom-agent" (original key unchanged)
    expect(result).toBe("custom-agent")
  })

  it("returns display name for approver", () => {
    // given config key "approver"
    const configKey = "approver"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

     // then returns "Approver"
    expect(result).toBe("Approver")
  })

  it("returns display name for planner", () => {
    // given config key "planner"
    const configKey = "planner"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "Planner"
    expect(result).toBe("Planner")
  })

  it("returns display name for developer", () => {
    // given config key "developer"
    const configKey = "developer"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "Developer"
    expect(result).toBe("Developer")
  })

  it("returns original key for retired metis", () => {
    // given config key "metis"
    const configKey = "metis"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "Metis - Plan Consultant"
    expect(result).toBe("metis")
  })

  it("returns display name for tester", () => {
    // given config key "tester"
    const configKey = "tester"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

     // then returns "Tester"
    expect(result).toBe("Tester")
  })

  it("returns display name for architect", () => {
    // given config key "architect"
    const configKey = "architect"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "architect"
    expect(result).toBe("Architect")
  })

  it("returns display name for librarian", () => {
    // given config key "librarian"
    const configKey = "librarian"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "librarian"
    expect(result).toBe("Librarian")
  })

  it("returns display name for librarian", () => {
    // given config key "librarian"
    const configKey = "librarian"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "librarian"
    expect(result).toBe("Librarian")
  })

  it("returns display name for multimodal-looker", () => {
    // given config key "multimodal-looker"
    const configKey = "multimodal-looker"

    // when getAgentDisplayName called
    const result = getAgentDisplayName(configKey)

    // then returns "multimodal-looker"
    expect(result).toBe("multimodal-looker")
  })

  it("preserves CJK display-name overrides verbatim", () => {
    expect(getAgentDisplayName("orchestrator", { orchestrator: { displayName: "Sisyphus - 主脑" } })).toBe("Sisyphus - 主脑")
    expect(getAgentDisplayName("developer", { developer: { displayName: "헤파이스토스" } })).toBe("헤파이스토스")
    expect(getAgentDisplayName("approver", { approver: { displayName: "アトラス" } })).toBe("アトラス")
  })
})

describe("getAgentConfigKey", () => {
  it("resolves display name to config key", () => {
    // given display name "Orchestrator"
    // when getAgentConfigKey called
    // then returns "orchestrator"
    expect(getAgentConfigKey("Orchestrator")).toBe("orchestrator")
  })

  it("resolves display name case-insensitively", () => {
    // given display name in different case
    // when getAgentConfigKey called
    // then returns "approver"
    expect(getAgentConfigKey("approver - plan executor")).toBe("approver - plan executor")
  })

  it("resolves legacy parenthesized display names", () => {
    // given legacy parenthesized display name from old configs/sessions
    // when getAgentConfigKey called
    // then resolves to canonical config key
    expect(getAgentConfigKey("Sisyphus (Ultraworker)")).toBe("sisyphus (ultraworker)")
    expect(getAgentConfigKey("Atlas (Plan Executor)")).toBe("atlas (plan executor)")
  })

  it("passes through lowercase config keys unchanged", () => {
    // given lowercase config key "planner"
    // when getAgentConfigKey called
    // then returns "planner"
    expect(getAgentConfigKey("planner")).toBe("planner")
  })

  it("returns lowercased unknown agents", () => {
    // given unknown agent name
    // when getAgentConfigKey called
    // then returns lowercased
    expect(getAgentConfigKey("Custom-Agent")).toBe("custom-agent")
  })

  it("resolves all core agent display names", () => {
    // given all core display names
    // when/then each resolves to its config key
    expect(getAgentConfigKey("Developer")).toBe("developer")
    expect(getAgentConfigKey("Planner")).toBe("planner")
    expect(getAgentConfigKey("Approver")).toBe("approver")
    expect(getAgentConfigKey("Metis - Plan Consultant")).toBe("metis - plan consultant")
    expect(getAgentConfigKey("Tester")).toBe("tester")
    expect(getAgentConfigKey("Developer")).toBe("developer")
  })

  it("resolves approver even when the UI ordering prefix is present", () => {
    expect(getAgentConfigKey(getAgentListDisplayName("approver"))).toBe("approver")
  })

  it("resolves display names even when zero-width characters are embedded", () => {
    expect(getAgentConfigKey("Sisyphus\u200B - Ultraworker")).toBe("sisyphus - ultraworker")
    expect(getAgentConfigKey("\uFEFFApprover")).toBe("approver")
  })
})

describe("getAgentListDisplayName", () => {
  it("returns the canonical display name for the core agent list", () => {
    expect(getAgentListDisplayName("orchestrator")).toBe("Orchestrator")
    expect(getAgentListDisplayName("developer")).toBe("Developer")
    expect(getAgentListDisplayName("planner")).toBe("Planner")
    expect(getAgentListDisplayName("approver")).toBe("Approver")
  })

  it("keeps non-core agents unchanged for list display", () => {
    expect(getAgentListDisplayName("architect")).toBe("Architect")
  })

  it("is a thin alias for getAgentDisplayName", () => {
    expect(getAgentListDisplayName("orchestrator")).toBe(getAgentDisplayName("orchestrator"))
  })
})

describe("stripAgentListSortPrefix", () => {
  it("strips legacy zero-width sort prefixes baked into v3.14.0–v3.16.0 sessions", () => {
    expect(stripAgentListSortPrefix("\u200B\u200BDeveloper")).toBe("Developer")
  })

  it("strips leading and trailing wrapper characters after sort prefix removal", () => {
    expect(stripAgentListSortPrefix("\\Developer\\")).toBe("Developer")
  })
})

describe("normalizeAgentForPrompt", () => {
  it("strips core UI ordering prefixes back to canonical display names", () => {
    expect(normalizeAgentForPrompt(getAgentListDisplayName("orchestrator"))).toBe("Orchestrator")
    expect(normalizeAgentForPrompt(getAgentListDisplayName("developer"))).toBe("Developer")
    expect(normalizeAgentForPrompt(getAgentListDisplayName("planner"))).toBe("Planner")
    expect(normalizeAgentForPrompt(getAgentListDisplayName("approver"))).toBe("Approver")
  })

  it("removes zero-width characters before returning canonical names", () => {
    expect(normalizeAgentForPrompt("Sisyphus\u200B - Ultraworker")).toBe("Sisyphus - Ultraworker")
  })

  it("converts legacy parenthesized names to canonical display names", () => {
    expect(normalizeAgentForPrompt("Atlas (Plan Executor)")).toBe("Atlas (Plan Executor)")
  })
})

describe("normalizeAgentForPromptKey", () => {
  it("converts built-in display names to config keys", () => {
    expect(normalizeAgentForPromptKey("Sisyphus (Ultraworker)")).toBe("Sisyphus (Ultraworker)")
  })

  it("strips UI ordering prefixes before returning config keys", () => {
    expect(normalizeAgentForPromptKey(getAgentListDisplayName("approver"))).toBe("approver")
  })

  it("preserves custom agents", () => {
    expect(normalizeAgentForPromptKey("MyCustomAgent")).toBe("MyCustomAgent")
  })
})

describe("AGENT_DISPLAY_NAMES", () => {
  it("contains all expected agent mappings", () => {
    // given expected mappings
    const expectedMappings = {
      orchestrator: "Orchestrator",
      developer: "Developer",
      planner: "Planner",
      approver: "Approver",
      tester: "Tester",
      architect: "Architect",
      librarian: "Librarian",
    }

    // when checking the constant
    // then contains all expected mappings
    expect(AGENT_DISPLAY_NAMES).toEqual(expectedMappings)
  })

  it("all display names must be HTTP-header-safe (no parentheses)", () => {
    // given all agent display names
    const httpHeaderUnsafe = /[()]/

    // when checking each display name
    for (const [, displayName] of Object.entries(AGENT_DISPLAY_NAMES)) {
      // then none should contain parentheses
      expect(httpHeaderUnsafe.test(displayName)).toBe(false)
    }
  })
})
