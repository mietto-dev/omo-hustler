import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, test } from "bun:test"

import { classifyTask } from "../opencode-tasks/orchestrator-classification"
import { createHustlerEventLifecycle } from "./event-lifecycle"
import { createHustlerLifecycleAdapter } from "./lifecycle-state"

const fixtures: string[] = []

function createFixture() {
  const storagePath = mkdtempSync(join(tmpdir(), "hustler-event-lifecycle-"))
  fixtures.push(storagePath)
  const config = { sisyphus: { tasks: { storage_path: storagePath } } }
  const adapter = createHustlerLifecycleAdapter(config)
  const record = adapter.create({
    sessionId: "ses_nested_event",
    classification: classifyTask({ localized: true, expectedFiles: 1 }),
  })
  return { adapter, config, record, storagePath }
}

afterEach(() => {
  for (const fixture of fixtures.splice(0)) {
    rmSync(fixture, { force: true, recursive: true })
  }
})

describe("HUSTLER event lifecycle", () => {
  test("#given an OpenCode event with a nested session info id #when recording a session error #then fails the matching workflow", () => {
    // given
    const { adapter, config, record } = createFixture()
    const lifecycle = createHustlerEventLifecycle(config, adapter)

    // when
    lifecycle.event({
      type: "session.error",
      properties: {
        info: { id: record.identity.sessionId },
        error: { name: "ProviderError", message: "fixture failure" },
      },
    })

    // then
    expect(adapter.load(record.identity.workflowId)).toMatchObject({ status: "failed" })
  })

  test("#given an errored OpenCode message update #when recording the event #then fails the matching workflow", () => {
    // given
    const { adapter, config, record } = createFixture()
    const lifecycle = createHustlerEventLifecycle(config, adapter)

    // when
    lifecycle.event({
      type: "message.updated",
      properties: {
        sessionID: record.identity.sessionId,
        info: { error: { name: "ProviderError", message: "fixture failure" } },
      },
    })

    // then
    expect(adapter.load(record.identity.workflowId)).toMatchObject({ status: "failed" })
  })

  test("#given a nonzero native bash exit #when recording the tool result #then fails the matching workflow", () => {
    // given
    const { adapter, config, record } = createFixture()
    const lifecycle = createHustlerEventLifecycle(config, adapter)

    // when
    lifecycle.toolResult({
      tool: "bash",
      sessionID: record.identity.sessionId,
      output: { metadata: { exit: 1 }, title: "false", output: "(no output)" },
    })

    // then
    expect(adapter.load(record.identity.workflowId)).toMatchObject({ status: "failed" })
  })

  test("#given an aborted OpenCode message update #when recording the event #then cancels the matching workflow", () => {
    // given
    const { adapter, config, record } = createFixture()
    const lifecycle = createHustlerEventLifecycle(config, adapter)

    // when
    lifecycle.event({
      type: "message.updated",
      properties: {
        sessionID: record.identity.sessionId,
        info: { error: { name: "MessageAbortedError", message: "Aborted" } },
      },
    })

    // then
    expect(adapter.load(record.identity.workflowId)).toMatchObject({ status: "cancelled" })
  })
})
