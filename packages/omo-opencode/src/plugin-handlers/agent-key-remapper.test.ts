import { describe, it, expect } from "bun:test"
import { remapAgentKeysToDisplayNames } from "./agent-key-remapper"
import { getAgentDisplayName, getAgentListDisplayName } from "../shared/agent-display-names"

describe("remapAgentKeysToDisplayNames", () => {
  it("remaps known agent keys to display names", () => {
    // given agents with lowercase keys
    const agents = {
      orchestrator: { prompt: "test", mode: "primary" },
      architect: { prompt: "test", mode: "subagent" },
    }

    // when remapping
    const result = remapAgentKeysToDisplayNames(agents)

    // then known agents get display name keys only
    expect(result[getAgentListDisplayName("orchestrator")]).toBeDefined()
    expect(result[getAgentDisplayName("architect")]).toBeDefined()
    expect(result["orchestrator"]).toBeUndefined()
  })

  it("preserves unknown agent keys unchanged", () => {
    // given agents with a custom key
    const agents = {
      "custom-agent": { prompt: "custom" },
    }

    // when remapping
    const result = remapAgentKeysToDisplayNames(agents)

    // then custom key is unchanged
    expect(result["custom-agent"]).toBeDefined()
  })

  it("remaps all core agents to display names", () => {
    // given all core agents
    const agents = {
      orchestrator: {},
      developer: {},
      planner: {},
      approver: {},
      athena: {},
      tester: {},
      architect: {},
    }

    // when remapping
    const result = remapAgentKeysToDisplayNames(agents)

    // then all get display name keys
    expect(result[getAgentListDisplayName("orchestrator")]).toBeDefined()
    expect(result["orchestrator"]).toBeUndefined()
    expect(result[getAgentListDisplayName("developer")]).toBeDefined()
    expect(result["developer"]).toBeUndefined()
    expect(result[getAgentListDisplayName("planner")]).toBeDefined()
    expect(result["planner"]).toBeUndefined()
    expect(result[getAgentListDisplayName("approver")]).toBeDefined()
    expect(result["approver"]).toBeUndefined()
    expect(result[getAgentDisplayName("tester")]).toBeDefined()
    expect(result["tester"]).toBeUndefined()
    expect(result[getAgentDisplayName("architect")]).toBeDefined()
    expect(result["architect"]).toBeUndefined()
  })

  it("does not emit both config and display keys for remapped agents", () => {
    // given one remapped agent
    const agents = {
      orchestrator: { prompt: "test", mode: "primary" },
    }

    // when remapping
    const result = remapAgentKeysToDisplayNames(agents)

    // then only display key is emitted
    expect(Object.keys(result)).toEqual([getAgentListDisplayName("orchestrator")])
    expect(result[getAgentListDisplayName("orchestrator")]).toBeDefined()
    expect(result["orchestrator"]).toBeUndefined()
  })

  it("returns runtime core agent list names in canonical order", () => {
    // given
    const result = remapAgentKeysToDisplayNames({
      approver: {},
      planner: {},
      developer: {},
      orchestrator: {},
    })

    // when
    const remappedNames = Object.keys(result)

    // then
    expect(remappedNames).toEqual([
      getAgentListDisplayName("approver"),
      getAgentListDisplayName("planner"),
      getAgentListDisplayName("developer"),
      getAgentListDisplayName("orchestrator"),
    ])
  })

  it("keeps remapped core agent name fields aligned with OpenCode list ordering", () => {
    // given agents with raw config-key names
    const agents = {
      orchestrator: { name: "orchestrator", prompt: "test", mode: "primary" },
      developer: { name: "developer", prompt: "test", mode: "primary" },
      planner: { name: "planner", prompt: "test", mode: "primary" },
      approver: { name: "approver", prompt: "test", mode: "primary" },
      architect: { name: "architect", prompt: "test", mode: "subagent" },
    }

    // when remapping
    const result = remapAgentKeysToDisplayNames(agents)

    // then keys and names both use the same runtime-facing list names
    expect(Object.keys(result).slice(0, 4)).toEqual([
      getAgentListDisplayName("orchestrator"),
      getAgentListDisplayName("developer"),
      getAgentListDisplayName("planner"),
      getAgentListDisplayName("approver"),
    ])
    expect(result[getAgentListDisplayName("orchestrator")]).toEqual({
      name: getAgentListDisplayName("orchestrator"),
      prompt: "test",
      mode: "primary",
    })
    expect(result[getAgentListDisplayName("developer")]).toEqual({
      name: getAgentListDisplayName("developer"),
      prompt: "test",
      mode: "primary",
    })
    expect(result[getAgentListDisplayName("planner")]).toEqual({
      name: getAgentListDisplayName("planner"),
      prompt: "test",
      mode: "primary",
    })
    expect(result[getAgentListDisplayName("approver")]).toEqual({
      name: getAgentListDisplayName("approver"),
      prompt: "test",
      mode: "primary",
    })
    expect(result[getAgentDisplayName("architect")]).toEqual({ name: getAgentDisplayName("architect"), prompt: "test", mode: "subagent" })
  })

  it("backfills runtime names for core agents when builtin configs omit name", () => {
    // given builtin-style configs without name fields
    const agents = {
      orchestrator: { prompt: "test", mode: "primary" },
      developer: { prompt: "test", mode: "primary" },
      planner: { prompt: "test", mode: "primary" },
      approver: { prompt: "test", mode: "primary" },
    }

    // when remapping
    const result = remapAgentKeysToDisplayNames(agents)

    // then runtime-facing names stay aligned even when builtin configs omit name
    expect(result[getAgentListDisplayName("orchestrator")]).toEqual({
      name: getAgentListDisplayName("orchestrator"),
      prompt: "test",
      mode: "primary",
    })
    expect(result[getAgentListDisplayName("developer")]).toEqual({
      name: getAgentListDisplayName("developer"),
      prompt: "test",
      mode: "primary",
    })
    expect(result[getAgentListDisplayName("planner")]).toEqual({
      name: getAgentListDisplayName("planner"),
      prompt: "test",
      mode: "primary",
    })
    expect(result[getAgentListDisplayName("approver")]).toEqual({
      name: getAgentListDisplayName("approver"),
      prompt: "test",
      mode: "primary",
    })
  })

  it("emits a single literal display-name row with no ZWSP for a single core agent", () => {
    // given a single core agent input
    const agents = {
      orchestrator: { foo: "bar" },
    }

    // when remapping
    const result = remapAgentKeysToDisplayNames(agents)

    // then exactly one row is emitted under the clean literal display name
    const displayName = getAgentListDisplayName("orchestrator")
    expect(Object.keys(result)).toEqual([displayName])
    expect(result[displayName]).toEqual({
      name: displayName,
      foo: "bar",
    })
  })

  describe("displayName i18n override (#4004)", () => {
    it("uses per-agent displayName override when set", () => {
      // given orchestrator config with a Chinese displayName override
      const agents = {
        orchestrator: { prompt: "test", mode: "primary" },
      }
      const overrides = {
        orchestrator: { displayName: "总指挥" },
      }

      // when remapping with overrides
      const result = remapAgentKeysToDisplayNames(agents, overrides)

      // then the localized name is used instead of "Sisyphus - Ultraworker"
      expect(result["总指挥"]).toBeDefined()
      expect((result["总指挥"] as Record<string, unknown>).name).toBe("总指挥")
      expect(result["Orchestrator"]).toBeUndefined()
    })

    it("falls back to hardcoded English name when displayName is not set", () => {
      // given orchestrator config without displayName override
      const agents = {
        orchestrator: { prompt: "test", mode: "primary" },
      }
      const overrides = {
        orchestrator: { model: "claude-opus-4-7" },
      }

      // when remapping with overrides that have no displayName
      const result = remapAgentKeysToDisplayNames(agents, overrides)

      // then the legacy AGENT_DISPLAY_NAMES value is used
      expect(result[getAgentListDisplayName("orchestrator")]).toBeDefined()
      expect(result["总指挥"]).toBeUndefined()
    })

    it("falls back to hardcoded English name when no overrides are passed", () => {
      // given orchestrator config with no overrides at all
      const agents = {
        orchestrator: { prompt: "test", mode: "primary" },
      }

      // when remapping without overrides
      const result = remapAgentKeysToDisplayNames(agents)

      // then the legacy AGENT_DISPLAY_NAMES value is used
      expect(result[getAgentListDisplayName("orchestrator")]).toBeDefined()
    })
  })
})
