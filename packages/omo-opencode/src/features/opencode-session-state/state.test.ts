/// <reference path="../../../../../bun-test.d.ts" />

import { describe, it as test, expect, beforeEach, afterEach } from "bun:test"
import {
  setSessionAgent,
  getSessionAgent,
  clearSessionAgent,
  updateSessionAgent,
  setMainSession,
  getMainSessionID,
  registerAgentName,
  clearRegisteredAgentNames,
  isAgentRegistered,
  resolveRegisteredAgentName,
  _resetForTesting,
} from "./state"

describe("opencode-session-state", () => {
  beforeEach(() => {
    // given - clean state before each test
    _resetForTesting()
  })

  afterEach(() => {
    // then - cleanup after each test to prevent pollution
    _resetForTesting()
  })

  describe("setSessionAgent", () => {
    test("should store agent for session", () => {
      // given
      const sessionID = "test-session-1"
      const agent = "Planner"

      // when
      setSessionAgent(sessionID, agent)

      // then
      expect(getSessionAgent(sessionID)).toBe(agent)
    })

    test("should strip zero-width ordering prefixes before storing agent for session", () => {
      // given
      const sessionID = "test-session-prefixed"
      const agent = "\u200B\u200B\u200BPlanner"

      // when
      setSessionAgent(sessionID, agent)

      // then
      expect(getSessionAgent(sessionID)).toBe("Planner")
    })

    test("should NOT overwrite existing agent (first-write wins)", () => {
      // given
      const sessionID = "test-session-1"
      setSessionAgent(sessionID, "Planner")

      // when - try to overwrite
      setSessionAgent(sessionID, "orchestrator")

      // then - first agent preserved
      expect(getSessionAgent(sessionID)).toBe("Planner")
    })

    test("should return undefined for unknown session", () => {
      // given - no session set

      // when / then
      expect(getSessionAgent("unknown-session")).toBe(undefined)
    })
  })

  describe("updateSessionAgent", () => {
    test("should overwrite existing agent", () => {
      // given
      const sessionID = "test-session-1"
      setSessionAgent(sessionID, "Planner")

      // when - force update
      updateSessionAgent(sessionID, "orchestrator")

      // then
      expect(getSessionAgent(sessionID)).toBe("orchestrator")
    })

    test("should strip zero-width ordering prefixes when overwriting existing agent", () => {
      // given
      const sessionID = "test-session-prefixed-update"
      setSessionAgent(sessionID, "orchestrator")

      // when
      updateSessionAgent(sessionID, "\u200B\u200BDeveloper")

      // then
      expect(getSessionAgent(sessionID)).toBe("Developer")
    })
  })

  describe("clearSessionAgent", () => {
    test("should remove agent from session", () => {
      // given
      const sessionID = "test-session-1"
      setSessionAgent(sessionID, "Planner")
      expect(getSessionAgent(sessionID)).toBe("Planner")

      // when
      clearSessionAgent(sessionID)

      // then
      expect(getSessionAgent(sessionID)).toBe(undefined)
    })
  })

  describe("mainSessionID", () => {
    test("should store and retrieve main session ID", () => {
      // given
      const mainID = "main-session-123"

      // when
      setMainSession(mainID)

      // then
      expect(getMainSessionID()).toBe(mainID)
    })

    test("should return undefined when not set", () => {
      // given - explicit reset to ensure clean state (parallel test isolation)
      _resetForTesting()
      // then
      expect(getMainSessionID()).toBe(undefined)
    })
  })

  describe("agent registration", () => {
    test("should register config-key lookup when given a display name", () => {
      // given
      registerAgentName("Approver")

      // when / then
      expect(isAgentRegistered("approver")).toBe(true)
      expect(isAgentRegistered("Approver")).toBe(true)
    })

    test("should resolve config keys back to the registered raw agent name", () => {
      // given
      registerAgentName("\u200BApprover")

      // when / then
      expect(resolveRegisteredAgentName("approver")).toBe("\u200BApprover")
      expect(resolveRegisteredAgentName("Approver")).toBe("\u200BApprover")
    })

    test("should not alias retired parenthesized names to a registered agent", () => {
      // given - canonical agent is registered
      registerAgentName("Orchestrator")

      // when - historical session has a retired parenthesized format
      const resolved = resolveRegisteredAgentName("Sisyphus (Ultraworker)")

      // then - retired name remains unregistered and is not aliased
      expect(isAgentRegistered("Sisyphus (Ultraworker)")).toBe(false)
      expect(resolved).toBe("Sisyphus (Ultraworker)")
    })

    test("should resolve bare lowercase name from historical session", () => {
      // given - agent registered with new display name
      registerAgentName("Planner")

      // when - old session stored just "planner"
      const resolved = resolveRegisteredAgentName("planner")

      // then
      expect(resolved).toBe("Planner")
    })

    test("should clear registered agent names without clearing session ownership", () => {
      // given
      const sessionID = "test-session-preserved"
      registerAgentName("Planner")
       setSessionAgent(sessionID, "Planner")

      // when
      clearRegisteredAgentNames()

      // then
      expect(isAgentRegistered("planner")).toBe(false)
      expect(resolveRegisteredAgentName("planner")).toBe("planner")
       expect(getSessionAgent(sessionID)).toBe("Planner")
    })

    describe("#given approver display name with zero-width prefix", () => {
      describe("#when checking registration without the zero-width prefix", () => {
        test("#then it treats the display name as registered", () => {
          // given
          registerAgentName("\u200BApprover")

          // when
          const isRegistered = isAgentRegistered("Approver")

          // then
          expect(isRegistered).toBe(true)
        })
      })
    })
  })

  describe("prometheus-md-only integration scenario", () => {
    test("should correctly identify Approver agent for permission checks", () => {
      // given - Approver session
      const sessionID = "test-approver-session"
      const approverAgent = "Approver"

      // when - agent is set (simulating chat.message hook)
      setSessionAgent(sessionID, approverAgent)

      // then - getSessionAgent returns the canonical agent for permission checks
      const agent = getSessionAgent(sessionID)
      expect(agent).toBe("Approver")
      expect(["Approver"].includes(agent!)).toBe(true)
    })

    test("should return undefined when agent not set (bug scenario)", () => {
      // given - session exists but no agent set (the bug)
      const sessionID = "test-prometheus-session"

      // when / then - this is the bug: agent is undefined
      expect(getSessionAgent(sessionID)).toBe(undefined)
    })
  })

  describe("issue #893: custom agent switch reset", () => {
    test("should preserve custom agent when default agent is sent on subsequent messages", () => {
      // given - user switches to custom agent "MyCustomAgent"
      const sessionID = "test-session-custom"
      const customAgent = "MyCustomAgent"
      const defaultAgent = "orchestrator"

      // User switches to custom agent (via UI)
      setSessionAgent(sessionID, customAgent)
      expect(getSessionAgent(sessionID)).toBe(customAgent)

      // when - first message after switch sends default agent
      // This simulates the bug: input.agent = "Sisyphus" on first message
      // Using setSessionAgent (first-write wins) should preserve custom agent
      setSessionAgent(sessionID, defaultAgent)

      // then - custom agent should be preserved, NOT overwritten
      expect(getSessionAgent(sessionID)).toBe(customAgent)
    })

    test("should allow explicit agent update via updateSessionAgent", () => {
      // given - custom agent is set
      const sessionID = "test-session-explicit"
      const customAgent = "MyCustomAgent"
      const newAgent = "AnotherAgent"

      setSessionAgent(sessionID, customAgent)

      // when - explicit update (user intentionally switches)
      updateSessionAgent(sessionID, newAgent)

      // then - should be updated
      expect(getSessionAgent(sessionID)).toBe(newAgent)
    })
  })

  describe("backward compatibility", () => {
    test("strips legacy ZWSP-prefixed agent names from persisted session state (GH-3259)", () => {
      // given - persisted session payload from v3.14.0-v3.16.0 with ZWSP prefix
      const sessionID = "test-session-legacy-zwsp"
       const legacyAgent = "\u200B\u200BDeveloper"

      // when
      setSessionAgent(sessionID, legacyAgent)

      // then
       expect(getSessionAgent(sessionID)).toBe("Developer")
    })
  })
})
