import { describe, expect, test } from "bun:test"

import {
  authorizeDelegation,
  authorizeNamedDelegation,
} from "./delegation-authorizer"
import { createDelegationPolicy } from "./delegation-policy"

describe("direct launch authorization contracts", () => {
  test("#given a category launch #when it is authorized #then it is recorded as a developer child", () => {
    const policy = createDelegationPolicy()

    const lineage = authorizeDelegation({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      category: "deep",
    }, policy)

    expect(lineage).toMatchObject({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerRole: "orchestrator",
      targetRole: "developer",
      depth: 1,
    })
    policy.release(lineage)
  })

  test("#given a named launch #when its edge is forbidden #then authorization fails before a child can start", () => {
    const policy = createDelegationPolicy()

    expect(() => authorizeNamedDelegation({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "librarian",
      targetRole: "developer",
    }, policy)).toThrowError(expect.objectContaining({ code: "DELEGATION_EDGE_FORBIDDEN" }))
  })

  test("#given a remembered child #when a direct continuation names another session #then ownership is rejected", () => {
    const policy = createDelegationPolicy()
    const lineage = authorizeNamedDelegation({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      targetRole: "developer",
    }, policy)
    policy.remember(lineage, "child-task", "child-session")

    expect(() => policy.authorizeContinuation({
      callerSessionId: "parent",
      taskId: "child-task",
      sessionId: "other-session",
    })).toThrowError(expect.objectContaining({ code: "DELEGATION_LINEAGE_UNAUTHORIZED" }))
  })

  test("#given a released direct launch #when another launch uses the same role #then the reservation is reusable", () => {
    const policy = createDelegationPolicy({ roleParallel: { developer: 1 } })
    const first = authorizeDelegation({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      category: "quick",
    }, policy)

    expect(() => authorizeDelegation({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      category: "deep",
    }, policy)).toThrowError(expect.objectContaining({ code: "DELEGATION_PARALLEL_LIMIT" }))

    policy.release(first)
    expect(authorizeDelegation({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: "orchestrator",
      category: "deep",
    }, policy).targetRole).toBe("developer")
  })
})
