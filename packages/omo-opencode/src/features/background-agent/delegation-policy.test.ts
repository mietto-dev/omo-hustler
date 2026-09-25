import { describe, expect, test } from "bun:test"
import {
  DelegationPolicyError,
  createDelegationPolicy,
  type DelegationRole,
} from "./delegation-policy"

const roles: readonly DelegationRole[] = ["orchestrator", "planner", "developer", "tester", "approver", "librarian", "architect"]

function lineage(callerRole: DelegationRole, targetRole: DelegationRole, overrides: Record<string, unknown> = {}) {
  return {
    rootSessionId: "root",
    parentSessionId: "parent",
    callerSessionId: "parent",
    callerRole,
    targetRole,
    depth: 0,
    ...overrides,
  }
}

describe("delegation policy", () => {
  test("#given canonical roles #when authorizing edges #then only the HUSTLER matrix is accepted", () => {
    const policy = createDelegationPolicy()
    const allowed = new Map<DelegationRole, readonly DelegationRole[]>([
      ["orchestrator", ["planner", "developer", "tester", "approver", "librarian", "architect"]],
      ["planner", ["librarian", "architect"]],
      ["developer", ["librarian", "architect"]],
      ["tester", ["librarian", "architect"]],
      ["approver", []],
      ["librarian", []],
      ["architect", ["librarian"]],
    ])

    for (const caller of roles) {
      for (const target of roles) {
        const shouldAllow = allowed.get(caller)?.includes(target) ?? false
        if (shouldAllow) {
          const child = policy.authorize(lineage(caller, target))
          expect(child.targetRole).toBe(target)
          policy.release(child)
        } else {
          expect(() => policy.authorize(lineage(caller, target))).toThrowError(
            expect.objectContaining({ code: "DELEGATION_EDGE_FORBIDDEN" }),
          )
        }
      }
    }
  })

  test("#given category delegation #when target is resolved as developer #then developer self-spawn is rejected", () => {
    const policy = createDelegationPolicy()
    expect(() => policy.authorize(lineage("developer", "developer"))).toThrowError(
      expect.objectContaining({ code: "DELEGATION_EDGE_FORBIDDEN" }),
    )
  })

  test("#given a depth-two child #when it delegates #then depth overflow is typed", () => {
    const policy = createDelegationPolicy({ maxDepth: 2 })
    expect(() => policy.authorize(lineage("orchestrator", "developer", { depth: 2 }))).toThrowError(
      expect.objectContaining({ code: "DELEGATION_DEPTH_EXCEEDED" }),
    )
  })

  test("#given an invalid depth #when authorization is attempted #then malformed depth is rejected", () => {
    const policy = createDelegationPolicy()
    expect(() => policy.authorize(lineage("orchestrator", "developer", { depth: -1 }))).toThrowError(
      expect.objectContaining({ code: "DELEGATION_DEPTH_EXCEEDED" }),
    )
  })

  test("#given four live developers #when another developer is authorized #then the role cap is typed", () => {
    const policy = createDelegationPolicy({ roleParallel: { developer: 4 } })
    for (let index = 0; index < 4; index += 1) {
      policy.authorize(lineage("orchestrator", "developer"))
    }
    expect(() => policy.authorize(lineage("orchestrator", "developer"))).toThrowError(
      expect.objectContaining({ code: "DELEGATION_PARALLEL_LIMIT" }),
    )
  })

  test("#given an unknown reservation #when release is attempted #then active capacity is unchanged", () => {
    const policy = createDelegationPolicy({ roleParallel: { developer: 1 } })
    const first = policy.authorize(lineage("orchestrator", "developer"))
    policy.release({ ...first, reservationId: "forged-reservation" })
    expect(() => policy.authorize(lineage("orchestrator", "developer"))).toThrowError(
      expect.objectContaining({ code: "DELEGATION_PARALLEL_LIMIT" }),
    )
    policy.release(first)
  })

  test("#given stored lineage #when a continuation names another session #then ownership is rejected", () => {
    const policy = createDelegationPolicy()
    const authorized = policy.authorize(lineage("orchestrator", "developer"))
    policy.remember(authorized, "child-task")
    expect(() => policy.authorizeContinuation({
      callerSessionId: "parent",
      taskId: "child-task",
      sessionId: "other-session",
    })).toThrowError(expect.objectContaining({ code: "DELEGATION_LINEAGE_UNAUTHORIZED" }))
  })

  test("#given a child lineage #when a team member delegates #then it cannot replace its caller identity", () => {
    const policy = createDelegationPolicy()
    const child = policy.authorize(lineage("orchestrator", "developer"))
    policy.remember(child, "child-task")
    expect(() => policy.authorize(lineage("orchestrator", "approver", {
      callerSessionId: "child-session",
      parentSessionId: "child-session",
      storedRole: "developer",
    }))).toThrowError(expect.objectContaining({ code: "DELEGATION_LINEAGE_UNAUTHORIZED" }))
  })

  test("#given an unknown session #when it claims an orchestrator role #then the caller identity is rejected", () => {
    const policy = createDelegationPolicy()
    expect(() => policy.authorize(lineage("orchestrator", "developer", {
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "spoofed",
    }))).toThrowError(expect.objectContaining({ code: "DELEGATION_LINEAGE_UNAUTHORIZED" }))
  })

  test("#given a remembered developer session #when it claims another role #then the stored role wins", () => {
    const policy = createDelegationPolicy()
    const child = policy.authorize(lineage("orchestrator", "developer"))
    policy.remember(child, "child-task", "child-session")
    expect(() => policy.authorize(lineage("orchestrator", "approver", {
      callerSessionId: "child-session",
      parentSessionId: "child-session",
      rootSessionId: "root",
    }))).toThrowError(expect.objectContaining({ code: "DELEGATION_LINEAGE_UNAUTHORIZED" }))
  })

  test("#given an authorized target #when fallback changes agent #then general is rejected", () => {
    const policy = createDelegationPolicy()
    expect(() => policy.assertFallbackTarget("developer", "general")).toThrowError(
      expect.objectContaining({ code: "DELEGATION_FALLBACK_FORBIDDEN" }),
    )
    expect(() => policy.assertFallbackTarget("developer", "architect")).toThrowError(
      expect.objectContaining({ code: "DELEGATION_FALLBACK_FORBIDDEN" }),
    )
  })

  test("#given a category launch #when the category is supplied #then policy maps it to developer", () => {
    const policy = createDelegationPolicy()
    const child = policy.authorize({
      rootSessionId: "root",
      parentSessionId: "parent",
      callerSessionId: "parent",
      callerRole: " ORCHESTRATOR ",
      category: "deep",
      depth: 0,
    })
    expect(child.targetRole).toBe("developer")
    policy.release(child)
  })
})

test("policy failures expose stable typed codes", () => {
  const policy = createDelegationPolicy()
  try {
    policy.authorize(lineage("librarian", "architect"))
  } catch (error) {
    if (!(error instanceof DelegationPolicyError)) throw error
    expect(error.code).toBe("DELEGATION_EDGE_FORBIDDEN")
  }
})
