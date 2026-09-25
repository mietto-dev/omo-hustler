import { describe, expect, it, mock } from "bun:test"

import {
  createCompactionAutocontinueHandler,
  createSessionCompactingHandler,
} from "./plugin/session-compacting"

describe("experimental.session.compacting handler", () => {
  it("captures and injects context and todos in order", async () => {
    const callOrder: string[] = []
    const handler = createSessionCompactingHandler({
      compactionContextInjector: {
        capture: mock(async () => callOrder.push("context-capture")),
        inject: mock((sessionID: string) => {
          callOrder.push("context-inject")
          return `context-for-${sessionID}`
        }),
      },
      compactionTodoPreserver: {
        capture: mock(async () => callOrder.push("todo-capture")),
      },
    })

    const output = { context: [] as string[], prompt: undefined as string | undefined }
    await handler({ sessionID: "ses_test" }, output)

    expect(callOrder).toEqual(["context-capture", "todo-capture", "context-inject"])
    expect(output.context).toEqual(["context-for-ses_test"])
  })

  it("continues when an internal preservation hook throws", async () => {
    const handler = createSessionCompactingHandler({
      compactionContextInjector: {
        capture: mock(async () => {
          throw new Error("checkpoint api down")
        }),
        inject: mock(() => "injected-context"),
      },
      compactionTodoPreserver: { capture: mock(async () => {}) },
    })

    const output = { context: [] as string[], prompt: undefined as string | undefined }
    await expect(handler({ sessionID: "ses_test" }, output)).resolves.toBeUndefined()
    expect(output.context).toContain("injected-context")
  })
})

describe("experimental.compaction.autocontinue handler", () => {
  it("disables autocontinue for the compaction agent", async () => {
    const handler = createCompactionAutocontinueHandler({
      compactionContextInjector: { restore: mock(async () => true) },
      compactionTodoPreserver: { restore: mock(async () => {}) },
    })
    const output = { enabled: true }

    await handler({ sessionID: "ses_compaction_loop", agent: "compaction" }, output)

    expect(output.enabled).toBe(false)
  })

  it("restores context and todos before continuing", async () => {
    const restoreContext = mock(async () => true)
    const restoreTodos = mock(async () => {})
    const handler = createCompactionAutocontinueHandler({
      compactionContextInjector: { restore: restoreContext },
      compactionTodoPreserver: { restore: restoreTodos },
    })
    const output = { enabled: true }

    await handler({ sessionID: "ses_autocontinue" }, output)

    expect(restoreContext).toHaveBeenCalledWith("ses_autocontinue")
    expect(restoreTodos).toHaveBeenCalledWith("ses_autocontinue")
    expect(output.enabled).toBe(true)
  })
})
