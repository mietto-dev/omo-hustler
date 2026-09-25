/// <reference types="bun-types" />

import { afterEach, describe, expect, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"

import {
  _resetForTesting,
  registerAgentName,
} from "../../features/opencode-session-state"
import { releaseAllPromptAsyncReservationsForTesting } from "../shared/prompt-async-gate"
import { unsafeTestValue } from "../../../../../test-support/unsafe-test-value"
import { injectContinuation } from "./continuation-injection"

describe("todo continuation registered agent resolution", () => {
  afterEach(() => {
    releaseAllPromptAsyncReservationsForTesting()
    _resetForTesting()
  })

  test("#given OpenCode registered canonical Approver display name #when continuation inherits config key #then prompt uses registered name", async () => {
    // given
    registerAgentName("Approver")
    let capturedAgent: string | undefined
    const ctx = unsafeTestValue<PluginInput>({
      directory: "/tmp/test",
      client: {
        session: {
          todo: async () => ({ data: [{ id: "1", content: "todo", status: "pending", priority: "high" }] }),
          promptAsync: async (input: { readonly body: { readonly agent?: string } }) => {
            capturedAgent = input.body.agent
            return {}
          },
        },
      },
    })
    const sessionStateStore = {
      getExistingState: () => ({ inFlight: false, lastInjectedAt: 0, consecutiveFailures: 0 }),
    }

    // when
    await injectContinuation({
      ctx,
      sessionID: "ses_todo_registered_atlas",
      resolvedInfo: {
        agent: "approver",
        model: { providerID: "openai", modelID: "gpt-5.5" },
      },
      sessionStateStore: unsafeTestValue(sessionStateStore),
    })

    // then
    expect(capturedAgent).toBe("Approver")
  })

  test("#given OpenCode registered Approver with a zero-width sort prefix #when continuation inherits config key #then prompt uses the canonical display name", async () => {
    // given
    registerAgentName("\u200BApprover")
    let capturedAgent: string | undefined
    const ctx = unsafeTestValue<PluginInput>({
      directory: "/tmp/test",
      client: {
        session: {
          todo: async () => ({ data: [{ id: "1", content: "todo", status: "pending", priority: "high" }] }),
          promptAsync: async (input: { readonly body: { readonly agent?: string } }) => {
            capturedAgent = input.body.agent
            return {}
          },
        },
      },
    })
    const sessionStateStore = {
      getExistingState: () => ({ inFlight: false, lastInjectedAt: 0, consecutiveFailures: 0 }),
    }

    // when
    await injectContinuation({
      ctx,
      sessionID: "ses_todo_registered_zwsp_atlas",
      resolvedInfo: {
        agent: "approver",
        model: { providerID: "openai", modelID: "gpt-5.5" },
      },
      sessionStateStore: unsafeTestValue(sessionStateStore),
    })

    // then
    expect(capturedAgent).toBe("\u200BApprover")
  })
})
