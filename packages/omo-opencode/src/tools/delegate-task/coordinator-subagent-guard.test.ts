/**
 * Regression test for issue #4027: coordinator agents must not be selectable as
 * subagent targets via task(). Symmetric guard to PR #4065 (team_create caller
 * eligibility) — this covers the TARGET side of delegation.
 */
const { describe, test, expect } = require("bun:test")

import { resolveSubagentExecution } from "./subagent-resolver"
import { COORDINATOR_AGENT_NAMES } from "./constants"
import type { ExecutorContext } from "./executor-types"

function makeCtx(): ExecutorContext {
  return {
    client: {
      app: { agents: async () => ({ data: [] }) },
      config: { get: async () => ({ data: {} }) },
    } as unknown as ExecutorContext["client"],
    manager: {} as unknown as ExecutorContext["manager"],
    directory: "/tmp/test",
  }
}

describe("coordinator subagent guard (#4027)", () => {
  for (const coordinatorName of COORDINATOR_AGENT_NAMES) {
    test(`#given subagent_type="${coordinatorName}" #when resolveSubagentExecution is called #then it is rejected before spawning`, async () => {
      //#given
      const ctx = makeCtx()
      const args = {
        subagent_type: coordinatorName,
        prompt: "do something",
        load_skills: [],
        run_in_background: false,
        description: "test delegation",
      }

      //#when
      const result = await resolveSubagentExecution(args, ctx, "orchestrator", "")

      //#then
      expect(result.error).toBeDefined()
      expect(result.agentToUse).toBe("")
      expect(result.error).toContain(coordinatorName)
      expect(result.error).toContain("coordinator agent")
    })
  }

  test("#given subagent_type=planner #when resolveSubagentExecution is called #then error names the agent and explains the conflict", async () => {
    //#given
    const ctx = makeCtx()
    const args = {
      subagent_type: "planner",
      prompt: "plan something",
      load_skills: [],
      run_in_background: false,
      description: "test delegation",
    }

    //#when
    const result = await resolveSubagentExecution(args, ctx, "orchestrator", "")

    //#then
    expect(result.error).toContain("planner")
    expect(result.error).toContain("coordinator")
    expect(result.error).toContain("duplicate")
    expect(result.agentToUse).toBe("")
    expect(result.categoryModel).toBeUndefined()
  })

  test("#given subagent_type=developer #when resolveSubagentExecution is called #then it is not blocked by coordinator guard", async () => {
    //#given
    const ctx = makeCtx()
    const args = {
      subagent_type: "developer",
      prompt: "write some code",
      load_skills: [],
      run_in_background: false,
      description: "test delegation",
    }

    //#when
    const result = await resolveSubagentExecution(args, ctx, "orchestrator", "")

    //#then — developer may fail for other reasons (API call), but NOT the coordinator guard
    expect(result.error).not.toContain("coordinator agent")
  })

  test("#given subagent_type=orchestrator #when resolveSubagentExecution is called #then orchestrator is NOT blocked by coordinator guard (registry: eligible)", async () => {
    //#given — orchestrator is verdict:'eligible' in AGENT_ELIGIBILITY_REGISTRY; it must not be rejected by the coordinator guard
    const ctx = makeCtx()
    const args = {
      subagent_type: "orchestrator",
      prompt: "do team-mode work",
      load_skills: [],
      run_in_background: false,
      description: "test delegation",
    }

    //#when
    const result = await resolveSubagentExecution(args, ctx, "orchestrator", "")

    //#then — orchestrator may fail for primary-agent reasons (separate guard), but NOT the coordinator guard
    expect(result.error).not.toContain("coordinator agent")
  })

  test("#given subagent_type=approver #when resolveSubagentExecution is called #then approver is NOT blocked by coordinator guard (registry: eligible)", async () => {
    //#given — approver is verdict:'eligible' in AGENT_ELIGIBILITY_REGISTRY; it must not be rejected by the coordinator guard
    const ctx = makeCtx()
    const args = {
      subagent_type: "approver",
      prompt: "do team-mode work",
      load_skills: [],
      run_in_background: false,
      description: "test delegation",
    }

    //#when
    const result = await resolveSubagentExecution(args, ctx, "orchestrator", "")

    //#then — approver may fail for primary-agent reasons (separate guard), but NOT the coordinator guard
    expect(result.error).not.toContain("coordinator agent")
  })

  test("#given subagent_type=planner AND allowPrimaryAgentDelegation=true #when resolveSubagentExecution is called #then planner is STILL rejected (registry hard-reject is authoritative)", async () => {
    //#given — planner is verdict:'hard-reject' in AGENT_ELIGIBILITY_REGISTRY; the coordinator guard must fire even when the team-mode resolver opts into primary-agent delegation
    const ctx = makeCtx()
    const args = {
      subagent_type: "planner",
      prompt: "plan something",
      load_skills: [],
      run_in_background: false,
      description: "test delegation",
    }

    //#when
    const result = await resolveSubagentExecution(args, ctx, "orchestrator", "", { allowPrimaryAgentDelegation: true })

    //#then
    expect(result.error).toContain("planner")
    expect(result.error).toContain("coordinator agent")
    expect(result.agentToUse).toBe("")
  })
})

export {}
