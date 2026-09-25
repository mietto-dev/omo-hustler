import type { BackgroundTaskConfig } from "../../config/schema"

export const DELEGATION_ROLES = ["orchestrator", "planner", "developer", "tester", "approver", "librarian", "architect"] as const
export type DelegationRole = (typeof DELEGATION_ROLES)[number]

const ALLOWED_EDGES: Readonly<Record<DelegationRole, readonly DelegationRole[]>> = {
  orchestrator: ["planner", "developer", "tester", "approver", "librarian", "architect"],
  planner: ["librarian", "architect"],
  developer: ["librarian", "architect"],
  tester: ["librarian", "architect"],
  approver: [],
  librarian: [],
  architect: ["librarian"],
}

const DEFAULT_ROLE_PARALLEL: Readonly<Record<DelegationRole, number>> = {
  orchestrator: 1,
  planner: 1,
  developer: 4,
  tester: 1,
  approver: 1,
  librarian: 6,
  architect: 1,
}

export type DelegationPolicyErrorCode =
  | "DELEGATION_EDGE_FORBIDDEN"
  | "DELEGATION_DEPTH_EXCEEDED"
  | "DELEGATION_PARALLEL_LIMIT"
  | "DELEGATION_LINEAGE_UNAUTHORIZED"
  | "DELEGATION_FALLBACK_FORBIDDEN"

export class DelegationPolicyError extends Error {
  readonly code: DelegationPolicyErrorCode

  constructor(code: DelegationPolicyErrorCode, message: string) {
    super(message)
    this.name = "DelegationPolicyError"
    this.code = code
  }
}

export interface DelegationRequest {
  readonly rootSessionId: string
  readonly parentSessionId: string
  readonly callerSessionId: string
  readonly callerRole: string
  readonly targetRole?: string
  readonly category?: string
  readonly depth: number
  readonly parentTaskId?: string
  readonly storedRole?: string
}

export interface DelegationLineage {
  readonly rootSessionId: string
  readonly parentSessionId: string
  readonly parentTaskId?: string
  readonly callerRole: DelegationRole
  readonly targetRole: DelegationRole
  readonly depth: number
  readonly childSessionId?: string
  readonly childTaskId?: string
  readonly reservationId: string
}

export interface ContinuationRequest {
  readonly callerSessionId: string
  readonly taskId: string
  readonly sessionId: string
}

interface DelegationPolicyOptions {
  readonly maxDepth?: number
  readonly roleParallel?: Partial<Record<DelegationRole, number>>
}

export function isDelegationRole(value: string): value is DelegationRole {
  return (DELEGATION_ROLES as readonly string[]).includes(value)
}

export function resolveDelegationRole(value: string | undefined): DelegationRole | undefined {
  if (value === undefined) return undefined
  const normalized = value.trim().toLowerCase()
  if (isDelegationRole(normalized)) return normalized
  if (normalized === "sisyphus") return "orchestrator"
  if (normalized === "atlas" || normalized === "hephaestus" || normalized === "sisyphus-junior" || normalized === "explore") return "developer"
  if (normalized === "oracle") return "architect"
  if (normalized === "plan") return "planner"
  return undefined
}

function requireRole(value: string, field: string): DelegationRole {
  if (!isDelegationRole(value)) {
    throw new DelegationPolicyError("DELEGATION_EDGE_FORBIDDEN", `Unknown ${field} role: ${value}`)
  }
  return value
}

function normalizeRole(value: string | undefined, field: string): DelegationRole {
  return requireRole(resolveDelegationRole(value) ?? "", field)
}

function requireSessionId(value: string, field: string): string {
  if (value.trim().length === 0) {
    throw new DelegationPolicyError("DELEGATION_LINEAGE_UNAUTHORIZED", `${field} session ID is required`)
  }
  return value
}

export interface DelegationPolicy {
  readonly authorize: (request: DelegationRequest) => DelegationLineage
  readonly remember: (lineage: DelegationLineage, taskId: string, sessionId?: string) => void
  readonly getLineageForSession: (sessionId: string) => DelegationLineage | undefined
  readonly authorizeContinuation: (request: ContinuationRequest) => DelegationLineage
  readonly assertFallbackTarget: (authorizedTarget: DelegationRole, fallbackTarget: string) => void
  readonly release: (lineage: DelegationLineage) => void
}

export function createDelegationPolicy(config?: Pick<BackgroundTaskConfig, "maxDepth" | "roleParallel">): DelegationPolicy {
  const maxDepth = config?.maxDepth ?? 2
  const roleParallel = { ...DEFAULT_ROLE_PARALLEL, ...config?.roleParallel }
  const lineagesByTask = new Map<string, DelegationLineage>()
  const activeByRootAndRole = new Map<string, number>()
  const reservations = new Map<string, string>()
  let nextReservationId = 0

  function authorize(request: DelegationRequest): DelegationLineage {
    const storedLineage = lineagesByTask.get(request.callerSessionId)
    const callerSessionId = requireSessionId(request.callerSessionId, "caller")
    const parentSessionId = requireSessionId(request.parentSessionId, "parent")
    const rootSessionId = requireSessionId(request.rootSessionId, "root")
    const callerRole = normalizeRole(request.callerRole, "caller")
    const targetRole = request.category !== undefined
      ? "developer"
      : normalizeRole(request.targetRole, "target")
    if (storedLineage && (storedLineage.childSessionId !== callerSessionId || storedLineage.childSessionId !== parentSessionId)) {
      throw new DelegationPolicyError("DELEGATION_LINEAGE_UNAUTHORIZED", "Calling session is outside the stored delegation lineage")
    }
    if (!storedLineage && callerSessionId !== parentSessionId) {
      throw new DelegationPolicyError("DELEGATION_LINEAGE_UNAUTHORIZED", "Stored caller role does not match the calling session")
    }
    if (storedLineage && callerRole !== storedLineage.targetRole) {
      throw new DelegationPolicyError("DELEGATION_LINEAGE_UNAUTHORIZED", "Caller role does not match the stored delegation lineage")
    }
    if (request.storedRole !== undefined && normalizeRole(request.storedRole, "stored") !== callerRole) {
      throw new DelegationPolicyError("DELEGATION_LINEAGE_UNAUTHORIZED", "Stored caller role does not match the calling session")
    }
    if (!ALLOWED_EDGES[callerRole].includes(targetRole)) {
      throw new DelegationPolicyError("DELEGATION_EDGE_FORBIDDEN", `${callerRole} may not delegate to ${targetRole}`)
    }
    if (!Number.isSafeInteger(request.depth) || request.depth < 0) {
      throw new DelegationPolicyError("DELEGATION_DEPTH_EXCEEDED", "Delegation depth must be a non-negative integer")
    }
    const childDepth = storedLineage?.depth !== undefined ? storedLineage.depth + 1 : request.depth + 1
    if (childDepth > maxDepth) {
      throw new DelegationPolicyError("DELEGATION_DEPTH_EXCEEDED", `Child depth ${childDepth} exceeds max depth ${maxDepth}`)
    }
    const lineageRootSessionId = storedLineage?.rootSessionId ?? rootSessionId
    const lineageParentSessionId = storedLineage?.childSessionId ?? parentSessionId
    const countKey = `${lineageRootSessionId}:${targetRole}`
    const activeCount = activeByRootAndRole.get(countKey) ?? 0
    const limit = roleParallel[targetRole] ?? DEFAULT_ROLE_PARALLEL[targetRole]
    if (activeCount >= limit) {
      throw new DelegationPolicyError("DELEGATION_PARALLEL_LIMIT", `${targetRole} parallel limit ${limit} reached`)
    }
    const reservationId = `delegation-${nextReservationId++}`
    activeByRootAndRole.set(countKey, activeCount + 1)
    reservations.set(reservationId, countKey)
    return {
      rootSessionId: lineageRootSessionId,
      parentSessionId: lineageParentSessionId,
      parentTaskId: storedLineage?.childTaskId ?? request.parentTaskId,
      callerRole,
      targetRole,
      depth: childDepth,
      reservationId,
    }
  }

  function remember(lineage: DelegationLineage, taskId: string, sessionId?: string): void {
    const stored = { ...lineage, childTaskId: taskId, ...(sessionId ? { childSessionId: sessionId } : {}) }
    lineagesByTask.set(taskId, stored)
    if (sessionId) lineagesByTask.set(sessionId, stored)
  }

  function getLineageForSession(sessionId: string): DelegationLineage | undefined {
    return lineagesByTask.get(sessionId)
  }

  function authorizeContinuation(request: ContinuationRequest): DelegationLineage {
    const lineage = lineagesByTask.get(request.taskId)
    if (!lineage || lineage.parentSessionId !== request.callerSessionId) {
      throw new DelegationPolicyError("DELEGATION_LINEAGE_UNAUTHORIZED", "Continuation is not owned by the calling lineage")
    }
    const expectedSessionIds = [lineage.childSessionId, lineage.childTaskId].filter(
      (value): value is string => value !== undefined,
    )
    if (!expectedSessionIds.includes(request.sessionId)) {
      throw new DelegationPolicyError("DELEGATION_LINEAGE_UNAUTHORIZED", "Continuation session does not match stored lineage")
    }
    return lineage
  }

  function assertFallbackTarget(authorizedTarget: DelegationRole, fallbackTarget: string): void {
    if (!isDelegationRole(fallbackTarget.trim().toLowerCase()) || fallbackTarget.trim().toLowerCase() !== authorizedTarget) {
      throw new DelegationPolicyError("DELEGATION_FALLBACK_FORBIDDEN", `Fallback target ${fallbackTarget} escapes authorized ${authorizedTarget} lineage`)
    }
  }

  function release(lineage: DelegationLineage): void {
    const key = reservations.get(lineage.reservationId)
    if (key === undefined) return
    reservations.delete(lineage.reservationId)
    const targetRole = normalizeRole(lineage.targetRole, "target")
    const count = activeByRootAndRole.get(key) ?? 0
    if (count <= 1) activeByRootAndRole.delete(key)
    else activeByRootAndRole.set(key, count - 1)
  }

  return { authorize, remember, getLineageForSession, authorizeContinuation, assertFallbackTarget, release }
}

export const defaultDelegationPolicy = createDelegationPolicy()
