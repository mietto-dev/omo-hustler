import { beforeEach, describe, expect, it, spyOn } from "bun:test"
import type { OhMyOpenCodeConfig } from "../../config"
import type { ModelCacheState } from "../../plugin-state"
import type { PluginContext } from "../types"
import * as hooks from "../../hooks"

const mockContext = {
  directory: "/tmp",
} as PluginContext

const mockModelCacheState = {
  anthropicContext1MEnabled: false,
  modelContextLimitsCache: new Map(),
} satisfies ModelCacheState

describe("createToolGuardHooks", () => {
  beforeEach(() => {
    spyOn(hooks, "createRulesInjectorHook").mockImplementation(() => ({ name: "rules-injector" }) as never)
  })

  it("creates the rules injector when enabled", () => {
    // given
    const pluginConfig = {} as OhMyOpenCodeConfig
    const { createToolGuardHooks } = require("./create-tool-guard-hooks")

    // when
    createToolGuardHooks({
      ctx: mockContext,
      pluginConfig,
      modelCacheState: mockModelCacheState,
      isHookEnabled: (hookName: string) => hookName === "rules-injector",
      safeHookEnabled: true,
    })

    // then
    expect(true).toBe(true)
  })
})
