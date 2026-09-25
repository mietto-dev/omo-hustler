/// <reference types="bun-types" />

import { describe, expect, it } from "bun:test"
import type { OhMyOpenCodeConfig } from "../config"
import { OhMyOpenCodeConfigSchema } from "../config"
import { applyToolConfig } from "./tool-config-handler"

type TestAgent = {
  permission?: Record<string, unknown>
}

const TASK_DENIED_SUBAGENTS = [
  "librarian",
  "architect",
] as const

const TASK_ALLOWED_AGENT_NAMES = [
  "orchestrator",
  "approver",
  "developer",
  "planner",
] as const

function createParams(agentNames: readonly string[]): {
  readonly config: Record<string, unknown>
  readonly pluginConfig: OhMyOpenCodeConfig
  readonly agentResult: Record<string, TestAgent>
} {
  const agentResult: Record<string, TestAgent> = {}
  for (const agentName of agentNames) {
    agentResult[agentName] = { permission: {} }
  }

  return {
    config: { tools: {}, permission: {} },
    pluginConfig: OhMyOpenCodeConfigSchema.parse({}),
    agentResult,
  }
}

function requirePermission(
  agentResult: Record<string, TestAgent>,
  agentName: string,
): Record<string, unknown> {
  const permission = agentResult[agentName]?.permission
  if (!permission) {
    throw new Error(`Missing permission for ${agentName}`)
  }
  return permission
}

describe("applyToolConfig task permission hard denials", () => {
  describe("#given read-only and specialist subagents", () => {
    describe("#when applying tool config", () => {
      for (const agentName of TASK_DENIED_SUBAGENTS) {
        it(`#then should explicitly deny task for ${agentName}`, () => {
          const params = createParams([agentName])

          applyToolConfig(params)

          const permission = requirePermission(params.agentResult, agentName)
          expect(permission.task).toBe("deny")
        })
      }
    })
  })

  describe("#given librarian search permissions", () => {
    describe("#when applying tool config", () => {
      it("#then should keep grep_app allowed while task is denied", () => {
        const params = createParams(["librarian"])

        applyToolConfig(params)

        const permission = requirePermission(params.agentResult, "librarian")
        expect(permission["grep_app_*"]).toBe("allow")
        expect(permission.task).toBe("deny")
      })
    })
  })

  describe("#given primary and executor agents", () => {
    describe("#when applying tool config", () => {
      for (const agentName of TASK_ALLOWED_AGENT_NAMES) {
        it(`#then should keep task allowed for ${agentName}`, () => {
          const params = createParams([agentName])

          applyToolConfig(params)

          const permission = requirePermission(params.agentResult, agentName)
           expect(permission.task).toBe(agentName === "developer" ? undefined : agentName === "approver" ? "deny" : "allow")
        })
      }
    })
  })

  describe("#given user-configured permission.task on main agents (#6990)", () => {
    describe("#when applying tool config", () => {
      for (const agentName of TASK_ALLOWED_AGENT_NAMES) {
        it(`#then should preserve user permission.task for ${agentName}`, () => {
          // given the user explicitly configured permission.task
          const params = createParams([agentName])
          params.agentResult[agentName].permission = { task: "ask" }

          // when
          applyToolConfig(params)

          // then the user value survives instead of being clobbered to "allow"
          const permission = requirePermission(params.agentResult, agentName)
           expect(permission.task).toBe(agentName === "approver" ? "deny" : "ask")
          // sanity: the other plugin-injected rules still apply
           expect(permission.call_omo_agent).toBe(agentName === "orchestrator" ? "allow" : "deny")
        })
      }
    })
  })

  describe("#given developer (factory sets task:deny)", () => {
    describe("#when applying tool config with empty initial permission", () => {
      it("#then should NOT add task:allow to developer (regression of #5193)", () => {
        // given developer with empty permission (test isolation, not factory state)
        const params = createParams(["developer"])

        // when
        applyToolConfig(params)

        // then permission.task must NOT be "allow" — only the other keys get added
        const permission = requirePermission(params.agentResult, "developer")
        expect(permission.task).toBeUndefined()
        // sanity: the other keys ARE still added
        expect(permission["task_*"]).toBe("allow")
        expect(permission.teammate).toBe("allow")
      })
    })

    describe("#when applying tool config with permission.task=deny from factory", () => {
      it("#then should NOT clobber task:deny to allow (sub-bug of #5193)", () => {
        // given developer with task:deny set by the factory
        const params = createParams(["developer"])
        const junior = params.agentResult["developer"] as { permission: Record<string, unknown> }
        junior.permission = { task: "deny" }

        // when
        applyToolConfig(params)

        // then task remains "deny" (not overwritten to "allow")
        expect(junior.permission.task).toBe("deny")
        // other keys are still added
        expect(junior.permission["task_*"]).toBe("allow")
        expect(junior.permission.teammate).toBe("allow")
      })
    })
  })
})

describe("applyToolConfig canonical role projection", () => {
  it("applies hard denials after user permissions for every read-only role", () => {
    const params = createParams(["planner", "tester", "approver", "librarian", "architect"])
    for (const agent of Object.values(params.agentResult)) {
      agent.permission = {
        write: "allow",
        edit: "allow",
        apply_patch: "allow",
        task: "allow",
        call_omo_agent: "allow",
      }
    }

    applyToolConfig(params)

    for (const agentName of ["planner", "tester", "approver", "librarian", "architect"]) {
      const permission = requirePermission(params.agentResult, agentName)
      expect(permission.write).toBe("deny")
      expect(permission.edit).toBe("deny")
      expect(permission.apply_patch).toBe("deny")
    }
    expect(requirePermission(params.agentResult, "librarian").call_omo_agent).toBe("deny")
    expect(requirePermission(params.agentResult, "architect").call_omo_agent).toBe("allow")
  })
})
