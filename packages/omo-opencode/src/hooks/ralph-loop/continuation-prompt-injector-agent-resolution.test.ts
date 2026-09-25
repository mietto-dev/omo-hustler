/// <reference types="bun-types" />

import { afterEach, describe, expect, test } from "bun:test"
import type { PluginInput } from "@opencode-ai/plugin"

import {
  _resetForTesting,
  registerAgentName,
} from "../../features/opencode-session-state"
import { releaseAllPromptAsyncReservationsForTesting } from "../shared/prompt-async-gate"
import { unsafeTestValue } from "../../../../../test-support/unsafe-test-value"
import { injectContinuationPrompt } from "./continuation-prompt-injector"

describe("ralph-loop continuation prompt agent resolution", () => {
  afterEach(() => {
    releaseAllPromptAsyncReservationsForTesting()
    _resetForTesting()
  })

  test("#given OpenCode registered canonical Approver display name #when inherited agent is config key #then prompt uses registered name", async () => {
    // given
    registerAgentName("Approver")
    let capturedAgent: string | undefined
    const ctx = unsafeTestValue<PluginInput>({
      client: {
        session: {
          messages: async () => ({ data: [{ info: { agent: "approver" } }] }),
          promptAsync: async (input: { readonly body: { readonly agent?: string } }) => {
            capturedAgent = input.body.agent
            return {}
          },
        },
      },
    })

    // when
    await injectContinuationPrompt(ctx, {
      sessionID: "ses_ralph_registered_atlas",
      prompt: "continue",
      directory: "/tmp/test",
      apiTimeoutMs: 50,
    })

    // then
    expect(capturedAgent).toBe("Approver")
  })
})
