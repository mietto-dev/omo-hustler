import { createHash } from "crypto"
import { existsSync } from "fs"
import { join } from "path"
import {
  acquireLock,
  ensureDir,
  getTaskDir,
  readJsonSafe,
  sanitizePathSegment,
  writeJsonAtomic,
} from "../claude-tasks/storage"
import {
  createWorkflowState,
  WorkflowStateSchema,
  type WorkflowState,
} from "../claude-tasks/orchestrator-state"
import type { WorkflowClassification } from "../claude-tasks/orchestrator-classification"
import {
  HUSTLER_LIFECYCLE_RECORD_VERSION,
  HustlerLifecycleRecordSchema,
  HustlerWorkflowIdentitySchema,
  parseHustlerWorkflowClassification,
  type HustlerLifecycleEvent,
  type HustlerLifecycleOperation,
  type HustlerLifecycleRecord,
  type HustlerLifecycleStatus,
  type HustlerWorkflowClassification,
  type HustlerWorkflowIdentity,
} from "./lifecycle-state-schema"
import type {
  CreateHustlerWorkflowInput,
  HustlerLifecycleConfig,
  HustlerLifecycleEventInput,
  HustlerWorkItemInput,
  HustlerWorkflowReference,
} from "./lifecycle-state"

const WORKFLOW_DIRECTORY = "hustler-workflows"
const HASH_LENGTH = 24

export type HustlerLifecycleErrorCode =
  | "INVALID_IDENTITY"
  | "MALFORMED_RECORD"
  | "CONFLICTING_RECORD"
  | "LOCK_UNAVAILABLE"
  | "UNKNOWN_WORKFLOW"
  | "DUPLICATE_EVENT_CONFLICT"
  | "TERMINAL_IMMUTABLE"

export class HustlerLifecycleError extends Error {
  readonly code: HustlerLifecycleErrorCode

  constructor(code: HustlerLifecycleErrorCode, message: string) {
    super(message)
    this.name = "HustlerLifecycleError"
    this.code = code
  }
}

function stableId(prefix: string, value: string): string {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, HASH_LENGTH)}`
}

function requireId(value: string | undefined, field: string): string | undefined {
  if (value === undefined) return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0 || trimmed.length > 256) {
    throw new HustlerLifecycleError("INVALID_IDENTITY", `${field} must be a non-empty bounded identifier`)
  }
  return trimmed
}

export function createHustlerWorkflowIdentity(input: Readonly<{
  sessionId: string
  workflowId?: string
  taskId?: string
}>): HustlerWorkflowIdentity {
  const sessionId = requireId(input.sessionId, "sessionId")
  if (sessionId === undefined) throw new HustlerLifecycleError("INVALID_IDENTITY", "sessionId is required")
  return HustlerWorkflowIdentitySchema.parse({
    sessionId,
    workflowId: requireId(input.workflowId, "workflowId") ?? stableId("W", `workflow:${sessionId}`),
    taskId: requireId(input.taskId, "taskId") ?? stableId("T", `task:${sessionId}`),
  })
}

export function getHustlerWorkflowPath(config: HustlerLifecycleConfig, workflowId: string): string {
  return join(getTaskDir(config), WORKFLOW_DIRECTORY, `${sanitizePathSegment(workflowId)}.json`)
}

export function readWorkflowRecord(filePath: string): HustlerLifecycleRecord | null {
  if (!existsSync(filePath)) return null
  const record = readJsonSafe(filePath, HustlerLifecycleRecordSchema)
  if (record === null) throw new HustlerLifecycleError("MALFORMED_RECORD", `Malformed workflow record: ${filePath}`)
  return record
}

export function redactState(state: WorkflowState): WorkflowState {
  const review = state.review === undefined
    ? undefined
    : {
        ...state.review,
        reviewSummary: state.review.reviewSummary === undefined ? undefined : "redacted",
        issues: state.review.issues?.map(issue => ({ ...issue, description: "redacted", requiredFix: "redacted" })),
      }
  return WorkflowStateSchema.parse({ ...state, review })
}

export function eventSignature(parts: readonly (string | number | boolean | undefined)[]): string {
  return parts.map(value => value === undefined ? "-" : String(value)).join("|")
}

export function workflowIdOf(reference: HustlerWorkflowReference): string {
  return typeof reference === "string" ? reference : reference.workflowId
}

export function sameIdentity(left: HustlerWorkflowIdentity, right: HustlerWorkflowIdentity): boolean {
  return left.sessionId === right.sessionId && left.workflowId === right.workflowId && left.taskId === right.taskId
}

export function createWorkflowRecord(
  identity: HustlerWorkflowIdentity,
  classification: HustlerWorkflowClassification,
): HustlerLifecycleRecord {
  const now = new Date().toISOString()
  return HustlerLifecycleRecordSchema.parse({
    version: HUSTLER_LIFECYCLE_RECORD_VERSION,
    kind: "hustler-workflow",
    identity,
    classification,
    state: createWorkflowState(identity.taskId, classification.tier),
    status: "active",
    revision: 0,
    events: [],
    createdAt: now,
    updatedAt: now,
  })
}

export function prepareCreate(
  input: CreateHustlerWorkflowInput,
): Readonly<{ identity: HustlerWorkflowIdentity; classification: HustlerWorkflowClassification }> {
  return {
    identity: createHustlerWorkflowIdentity(input),
    classification: parseHustlerWorkflowClassification(input.classification),
  }
}

export function prepareWorkItem(input: HustlerWorkItemInput): string {
  return eventSignature([input.workerId, input.role, input.status, input.workItemId])
}

export function prepareEvent(input: HustlerLifecycleEventInput): string {
  return eventSignature([input.kind, input.code])
}

export function terminalStatus(status: HustlerLifecycleStatus): boolean {
  return status !== "active"
}

export function buildEvent(
  eventKey: string,
  operation: HustlerLifecycleOperation,
  eventSignatureValue: string,
  state: WorkflowState,
  revision: number,
  nextPhase?: string,
  reviewStatus?: HustlerLifecycleEvent["reviewStatus"],
): HustlerLifecycleEvent {
  return {
    eventKey,
    operation,
    signature: eventSignatureValue,
    revision,
    fromPhase: state.phase,
    ...(nextPhase === undefined ? {} : { toPhase: nextPhase }),
    ...(reviewStatus === undefined ? {} : { reviewStatus }),
  }
}

export function workflowDirectory(config: HustlerLifecycleConfig): string {
  return join(getTaskDir(config), WORKFLOW_DIRECTORY)
}

export function updateWorkflowRecord(
  config: HustlerLifecycleConfig,
  reference: HustlerWorkflowReference,
  eventKey: string,
  operation: HustlerLifecycleOperation,
  eventSignatureValue: string,
  mutate: (record: HustlerLifecycleRecord) => Readonly<{
    state: WorkflowState
    status?: HustlerLifecycleStatus
    toPhase?: string
    reviewStatus?: HustlerLifecycleEvent["reviewStatus"]
  }>,
): HustlerLifecycleRecord {
  const directory = workflowDirectory(config)
  const workflowId = workflowIdOf(reference)
  const filePath = getHustlerWorkflowPath(config, workflowId)
  const lock = acquireLock(directory)
  if (!lock.acquired) throw new HustlerLifecycleError("LOCK_UNAVAILABLE", `Workflow storage is locked: ${directory}`)
  try {
    const current = readWorkflowRecord(filePath)
    if (current === null) throw new HustlerLifecycleError("UNKNOWN_WORKFLOW", `Unknown workflow: ${workflowId}`)
    const existingEvent = current.events.find(event => event.eventKey === eventKey)
    if (existingEvent !== undefined) {
      if (existingEvent.operation !== operation || existingEvent.signature !== eventSignatureValue) {
        throw new HustlerLifecycleError("DUPLICATE_EVENT_CONFLICT", `Event key already represents another transition: ${eventKey}`)
      }
      return current
    }
    if (terminalStatus(current.status)) {
      throw new HustlerLifecycleError("TERMINAL_IMMUTABLE", `Terminal workflow cannot accept event: ${eventKey}`)
    }
    const mutation = mutate(current)
    const nextEvent = buildEvent(
      eventKey,
      operation,
      eventSignatureValue,
      current.state,
      current.revision + 1,
      mutation.toPhase,
      mutation.reviewStatus,
    )
    const next = HustlerLifecycleRecordSchema.parse({
      ...current,
      state: redactState(mutation.state),
      status: mutation.status ?? current.status,
      revision: current.revision + 1,
      events: [...current.events, nextEvent],
      updatedAt: new Date().toISOString(),
    })
    writeJsonAtomic(filePath, next)
    return next
  } finally {
    lock.release()
  }
}

export { acquireLock, ensureDir, writeJsonAtomic }
