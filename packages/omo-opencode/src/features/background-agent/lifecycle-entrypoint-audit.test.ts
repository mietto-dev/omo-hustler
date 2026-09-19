import { describe, expect, test } from "bun:test"

import { createDelegationPolicy } from "./delegation-policy"

describe("background delegation lifecycle entrypoints", () => {
  test("#given a released role reservation #when a later child is authorized #then the slot is reusable", () => {
    const policy = createDelegationPolicy({ roleParallel: { developer: 1 } })
    const first = policy.authorize({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      targetRole: "developer",
      depth: 0,
    })

    policy.release(first)

    expect(() => policy.authorize({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      targetRole: "developer",
      depth: 0,
    })).not.toThrow()
  })

  test("#given a remembered child lineage #when its parent resumes the child session #then continuation ownership is accepted", () => {
    const policy = createDelegationPolicy()
    const child = policy.authorize({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      targetRole: "developer",
      depth: 0,
    })
    policy.remember(child, "task-child", "session-child")

    expect(policy.authorizeContinuation({
      callerSessionId: "parent",
      taskId: "task-child",
      sessionId: "session-child",
    })).toMatchObject({
      childTaskId: "task-child",
      childSessionId: "session-child",
      targetRole: "developer",
    })
  })

  test("#given a released reservation #when release is repeated #then a later reservation still has capacity", () => {
    const policy = createDelegationPolicy({ roleParallel: { developer: 1 } })
    const first = policy.authorize({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      targetRole: "developer",
      depth: 0,
    })

    policy.release(first)
    policy.release(first)

    const second = policy.authorize({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      targetRole: "developer",
      depth: 0,
    })
    expect(second.reservationId).not.toBe(first.reservationId)
  })

  test("#given a developer lineage #when fallback targets the authorized role #then fallback remains within the lineage", () => {
    const policy = createDelegationPolicy()
    expect(() => policy.assertFallbackTarget("developer", "developer")).not.toThrow()
    expect(() => policy.assertFallbackTarget("developer", "general")).toThrow(
      expect.objectContaining({ code: "DELEGATION_FALLBACK_FORBIDDEN" }),
    )
  })

  test("#given a task-id alias #when its stored child session continues #then the lineage is accepted", () => {
    const policy = createDelegationPolicy()
    const child = policy.authorize({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      targetRole: "developer",
      depth: 0,
    })
    policy.remember(child, "task-child", "session-child")

    expect(policy.authorizeContinuation({
      callerSessionId: "parent",
      taskId: "task-child",
      sessionId: "task-child",
    })).toMatchObject({ childSessionId: "session-child" })
  })

  test("#given a remembered child #when another caller uses the task alias #then continuation is rejected", () => {
    const policy = createDelegationPolicy()
    const child = policy.authorize({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      targetRole: "developer",
      depth: 0,
    })
    policy.remember(child, "task-child", "session-child")

    expect(() => policy.authorizeContinuation({
      callerSessionId: "other-parent",
      taskId: "task-child",
      sessionId: "task-child",
    })).toThrow(expect.objectContaining({ code: "DELEGATION_LINEAGE_UNAUTHORIZED" }))
  })
})
