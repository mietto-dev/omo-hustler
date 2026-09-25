import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { createPluginInterface } from "./plugin-interface"
import { createAutoSlashCommandHook } from "./hooks/auto-slash-command"
import { createUlwExecuteHook } from "./hooks/ulw-execute"
import { readBoulderState } from "./features/boulder-state"
import {
  _resetForTesting,
  getSessionAgent,
  registerAgentName,
  updateSessionAgent,
} from "./features/opencode-session-state"


describe("createPluginInterface - command.execute.before", () => {
  let testDir = ""

  beforeEach(() => {
    testDir = join(tmpdir(), `plugin-interface-ulw-execute-${randomUUID()}`)
    mkdirSync(join(testDir, ".omo", "plans"), { recursive: true })
    writeFileSync(join(testDir, ".omo", "plans", "worker-plan.md"), "# Plan\n- [ ] Task 1")
    _resetForTesting()
    registerAgentName("planner")
    registerAgentName("orchestrator")
  })

  afterEach(() => {
    _resetForTesting()
    rmSync(testDir, { recursive: true, force: true })
  })

  test("executes ulw-execute side effects for native command execution", async () => {
    // given
    updateSessionAgent("ses-command-before", "planner")
    const pluginInterface = createPluginInterface({
      ctx: {
        directory: testDir,
        client: { tui: { showToast: async () => {} } },
      } as never,
      pluginConfig: {} as never,
      firstMessageVariantGate: {
        shouldOverride: () => false,
        markApplied: () => {},
        markSessionCreated: () => {},
        clear: () => {},
      },
      managers: {} as never,
      hooks: {
        autoSlashCommand: createAutoSlashCommandHook({ skills: [] }),
        ulwExecute: createUlwExecuteHook({
          directory: testDir,
          client: { tui: { showToast: async () => {} } },
        } as never),
      } as never,
      tools: {},
    })
    const output = {
      parts: [{ type: "text", text: "original" }],
    }

    // when
    await pluginInterface["command.execute.before"]?.(
      {
        command: "ulw-execute",
        sessionID: "ses-command-before",
        arguments: "",
      },
      output as never
    )

    // then
    expect(pluginInterface["command.execute.before"]).toBeDefined()
    expect(output.parts[0]?.text).toContain("<!-- omo-ulw-execute-context -->")
    expect(getSessionAgent("ses-command-before")).toBe("orchestrator")
    expect(readBoulderState(testDir)?.agent).toBe("orchestrator")
    expect(readBoulderState(testDir)?.plan_name).toBe("worker-plan")
  })

  test("does not run ulw-execute side effects for other native commands with session context", async () => {
    // given
    updateSessionAgent("ses-handoff", "planner")
    const pluginInterface = createPluginInterface({
      ctx: {
        directory: testDir,
        client: { tui: { showToast: async () => {} } },
      } as never,
      pluginConfig: {} as never,
      firstMessageVariantGate: {
        shouldOverride: () => false,
        markApplied: () => {},
        markSessionCreated: () => {},
        clear: () => {},
      },
      managers: {} as never,
      hooks: {
        autoSlashCommand: createAutoSlashCommandHook({ skills: [] }),
        ulwExecute: createUlwExecuteHook({
          directory: testDir,
          client: { tui: { showToast: async () => {} } },
        } as never),
      } as never,
      tools: {},
    })
    const output = {
      parts: [{ type: "text", text: "original" }],
    }

    // when
    await pluginInterface["command.execute.before"]?.(
      {
        command: "handoff",
        sessionID: "ses-handoff",
        arguments: "",
      },
      output as never
    )

    // then
    expect(readBoulderState(testDir)).toBeNull()
    expect(getSessionAgent("ses-handoff")).toBe("planner")
  })

  test("switches native ulw-execute to Atlas when Atlas is registered in config", async () => {
    // given
    registerAgentName("approver")
    updateSessionAgent("ses-command-atlas", "planner")
    const pluginInterface = createPluginInterface({
      ctx: {
        directory: testDir,
        client: { tui: { showToast: async () => {} } },
      } as never,
      pluginConfig: {} as never,
      firstMessageVariantGate: {
        shouldOverride: () => false,
        markApplied: () => {},
        markSessionCreated: () => {},
        clear: () => {},
      },
      managers: {} as never,
      hooks: {
        autoSlashCommand: createAutoSlashCommandHook({ skills: [] }),
        ulwExecute: createUlwExecuteHook({
          directory: testDir,
          client: { tui: { showToast: async () => {} } },
        } as never),
      } as never,
      tools: {},
    })
    const output = {
      message: {} as Record<string, unknown>,
      parts: [{ type: "text", text: "/ulw-execute" }],
    }

    // when
    await pluginInterface["chat.message"]?.(
      {
        sessionID: "ses-command-atlas",
        agent: "planner",
      } as never,
      output as never
    )

    // then
    expect(output.message.agent).toBe("approver")
    expect(getSessionAgent("ses-command-atlas")).toBe("approver")
    expect(readBoulderState(testDir)?.agent).toBe("approver")
  })
})

describe("createPluginInterface - goal native command smoke", () => {
  let testDir = ""

  beforeEach(() => {
    testDir = join(tmpdir(), `plugin-interface-goal-${randomUUID()}`)
    mkdirSync(testDir, { recursive: true })
    _resetForTesting()
    registerAgentName("orchestrator")
  })

  afterEach(() => {
    _resetForTesting()
    rmSync(testDir, { recursive: true, force: true })
  })

  test("starts the goal from the native command flow with parsed arguments intact", async () => {
    // given
    const setGoalCalls: Array<{ sessionID: string; objective: string }> = []
    const pluginInterface = createPluginInterface({
      ctx: {
        directory: testDir,
        client: { tui: { showToast: async () => {} } },
      } as never,
      pluginConfig: {} as never,
      firstMessageVariantGate: {
        shouldOverride: () => false,
        markApplied: () => {},
        markSessionCreated: () => {},
        clear: () => {},
      },
      managers: {} as never,
      hooks: {
        autoSlashCommand: createAutoSlashCommandHook({ skills: [] }),
        goal: {
          setGoal: (sessionID: string, objective: string) => {
            setGoalCalls.push({ sessionID, objective })
            return { id: "goal-1", sessionID, objective, status: "active" } as never
          },
          getGoal: () => null,
          pauseGoal: () => null,
          resumeGoal: () => null,
          clearGoal: () => false,
          markComplete: () => null,
          event: async () => {},
        },
      } as never,
      tools: {},
    })
    const output = {
      message: {} as Record<string, unknown>,
      parts: [{ type: "text", text: "original" }],
    }

    // when
    await pluginInterface["command.execute.before"]?.(
      {
        command: "goal",
        sessionID: "ses-goal-native",
        arguments: "Ship feature",
      },
      output as never,
    )
    await pluginInterface["chat.message"]?.(
      {
        sessionID: "ses-goal-native",
        agent: "orchestrator",
      } as never,
      output as never,
    )

    // then
    expect(setGoalCalls).toEqual([
      {
        sessionID: "ses-goal-native",
        objective: "Ship feature",
      },
    ])
  })
})

describe("createPluginInterface - backward compatibility", () => {
  beforeEach(() => {
    _resetForTesting()
    registerAgentName("developer")
  })

  afterEach(() => {
    _resetForTesting()
  })

  test("strips legacy ZWSP-prefixed agent names from persisted chat.message session state (GH-3259)", async () => {
    // given - persisted session payload from v3.14.0-v3.16.0 with ZWSP prefix
    const pluginInterface = createPluginInterface({
      ctx: {
        directory: tmpdir(),
        client: { tui: { showToast: async () => {} } },
      } as never,
      pluginConfig: {} as never,
      firstMessageVariantGate: {
        shouldOverride: () => false,
        markApplied: () => {},
        markSessionCreated: () => {},
        clear: () => {},
      },
      managers: {} as never,
      hooks: {} as never,
      tools: {},
    })
    const output = {
      message: {} as Record<string, unknown>,
      parts: [{ type: "text", text: "hello" }],
    }

    // when
    await pluginInterface["chat.message"]?.(
      {
        sessionID: "ses-legacy-zwsp",
        agent: "\u200B\u200BDeveloper",
      } as never,
      output as never,
    )

    // then
    expect(getSessionAgent("ses-legacy-zwsp")).toBe("Developer")
  })
})

describe("createPluginInterface - chat.params variant injection", () => {
  test("injects variant from agent config into chat.params message", async () => {
    // given
    const pluginInterface = createPluginInterface({
      ctx: { client: {} } as never,
      pluginConfig: {
        agents: {
          orchestrator: { variant: "max" },
        },
      } as never,
      firstMessageVariantGate: {
        shouldOverride: () => false,
        markApplied: () => {},
        markSessionCreated: () => {},
        clear: () => {},
      },
      managers: {} as never,
      hooks: {} as never,
      tools: {},
    })
    const input = {
      sessionID: "ses-variant-inject",
      agent: "orchestrator",
      model: { providerID: "anthropic", modelID: "claude-opus-4-6" },
      provider: { id: "anthropic" },
      message: {} as { variant?: string },
    }
    const output = { options: {} }

    // when
    await pluginInterface["chat.params"]?.(input as never, output as never)

    // then
    expect(input.message.variant).toBe("max")
  })

  test("does not overwrite existing variant in chat.params message", async () => {
    // given
    const pluginInterface = createPluginInterface({
      ctx: { client: {} } as never,
      pluginConfig: {
        agents: {
          orchestrator: { variant: "max" },
        },
      } as never,
      firstMessageVariantGate: {
        shouldOverride: () => false,
        markApplied: () => {},
        markSessionCreated: () => {},
        clear: () => {},
      },
      managers: {} as never,
      hooks: {} as never,
      tools: {},
    })
    const input = {
      sessionID: "ses-variant-keep",
      agent: "orchestrator",
      model: { providerID: "anthropic", modelID: "claude-opus-4-6" },
      provider: { id: "anthropic" },
      message: { variant: "high" } as { variant?: string },
    }
    const output = { options: {} }

    // when
    await pluginInterface["chat.params"]?.(input as never, output as never)

    // then
    expect(input.message.variant).toBe("high")
  })
})
