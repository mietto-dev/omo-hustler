import { afterEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { unsafeTestValue } from "../../../../../test-support/unsafe-test-value"
import type { OhMyOpenCodeConfig } from "../../config"
import { _resetForTesting, getSessionAgent } from "../../features/claude-code-session-state"
import { createHustlerChatWorkflowAdapter } from "./hustler-workflow"
import { createChatMessageHandler } from "../chat-message"
import type { PluginContext } from "../types"

const fixtures = new Set<string>()

function createFixture() {
  const storagePath = mkdtempSync(join(tmpdir(), "hustler-chat-"))
  fixtures.add(storagePath)
  const pluginConfig = unsafeTestValue<OhMyOpenCodeConfig>({
    sisyphus: { tasks: { storage_path: storagePath, claude_code_compat: false } },
  })
  const args = {
    ctx: unsafeTestValue<PluginContext>({ client: { tui: { showToast: async () => {} } } }),
    pluginConfig,
    firstMessageVariantGate: {
      shouldOverride: () => false,
      markApplied: () => {},
    },
    hooks: unsafeTestValue<Parameters<typeof createChatMessageHandler>[0]["hooks"]>({
      stopContinuationGuard: null,
      backgroundNotificationHook: null,
      runtimeFallback: null,
      keywordDetector: null,
      claudeCodeHooks: null,
      autoSlashCommand: null,
      noSisyphusGpt: null,
      noHephaestusNonGpt: null,
      hephaestusAgentsMdInjector: null,
      thinkMode: null,
      modelFallback: null,
    }),
    hustlerWorkflow: undefined,
  }
  return { storagePath, args }
}

function input(sessionID: string) {
  return { sessionID, agent: undefined }
}

function output(text: string) {
  return { message: {}, parts: [{ type: "text", text }] }
}

afterEach(() => {
  _resetForTesting()
  for (const fixture of fixtures) rmSync(fixture, { recursive: true, force: true })
  fixtures.clear()
})

describe("live HUSTLER workflow chat boundary", () => {
  test("starts a Tier 0 workflow and records the orchestrator role", async () => {
    // #given
    const { storagePath, args } = createFixture()
    args.hustlerWorkflow = createHustlerChatWorkflowAdapter(args.pluginConfig)
    const handler = createChatMessageHandler(args)
    const message = output("rename one local variable")

    // #when
    await handler(input("ses-tier-0"), message)

    // #then
    const records = readdirSync(join(storagePath, "hustler-workflows"))
    expect(records).toHaveLength(1)
    expect(message.message["metadata"]).toMatchObject({
      omoHustlerWorkflow: { tier: 0, phase: "implementation", status: "active" },
    })
    expect(getSessionAgent("ses-tier-0")).toBe("orchestrator")
  })

  test("starts a Planner-gated Tier 2 workflow", async () => {
    // #given
    const { args } = createFixture()
    args.hustlerWorkflow = createHustlerChatWorkflowAdapter(args.pluginConfig)
    const handler = createChatMessageHandler(args)
    const message = output("build a full stack feature across frontend and backend files")

    // #when
    await handler(input("ses-tier-2"), message)

    // #then
    expect(message.message["metadata"]).toMatchObject({
      omoHustlerWorkflow: { tier: 2, phase: "planning" },
    })
  })

  test("reuses one workflow across subsequent and concurrent user messages", async () => {
    // #given
    const { storagePath, args } = createFixture()
    args.hustlerWorkflow = createHustlerChatWorkflowAdapter(args.pluginConfig)
    const handler = createChatMessageHandler(args)

    // #when
    const first = output("rename one local variable")
    await handler(input("ses-reuse"), first)
    const subsequent = output("keep going with this work")
    await handler(input("ses-reuse"), subsequent)
    const concurrent = [output("continue"), output("continue")]
    await Promise.all(concurrent.map(message => handler(input("ses-reuse"), message)))

    // #then
    const workflowID = (first.message["metadata"] as { omoHustlerWorkflow: { workflowId: string } }).omoHustlerWorkflow.workflowId
    expect((subsequent.message["metadata"] as { omoHustlerWorkflow: { workflowId: string } }).omoHustlerWorkflow.workflowId).toBe(workflowID)
    expect(readdirSync(join(storagePath, "hustler-workflows"))).toHaveLength(1)
  })

  test("does not start a workflow for synthetic or runtime-fallback messages", async () => {
    // #given
    const { storagePath, args } = createFixture()
    const fallbackCalls: string[] = []
    args.hustlerWorkflow = createHustlerChatWorkflowAdapter(args.pluginConfig)
    args.hooks.runtimeFallback = { "chat.message": async input => { fallbackCalls.push(input.sessionID) } }
    const handler = createChatMessageHandler(args)

    // #when
    await handler(input("ses-internal"), {
      message: {},
      parts: [{ type: "text", text: "retry <!-- OMO_INTERNAL_INITIATOR --> <!-- OMO_RUNTIME_FALLBACK_RETRY -->", synthetic: true }],
    })

    // #then
    expect(fallbackCalls).toEqual(["ses-internal"])
    expect(readdirSync(storagePath)).toHaveLength(0)
    expect(getSessionAgent("ses-internal")).toBeUndefined()
  })
})
