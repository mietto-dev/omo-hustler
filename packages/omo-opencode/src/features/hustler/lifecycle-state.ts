import type { OhMyOpenCodeConfig } from "../../config/schema"
import { resolveRetryRoute, transitionWorkflowState, WorkflowStateSchema, type WorkflowRetryRoute } from "../claude-tasks/orchestrator-state"
import { recordApproverResult, recordTesterReview } from "../claude-tasks/orchestrator-review"
import type {
  ApproverInput,
  TesterReview,
} from "../claude-tasks/workflow-contracts"
import { resolveApproverResult } from "../claude-tasks/workflow-contracts"
import type { HustlerLifecycleRecord } from "./lifecycle-state-schema"
import type { WorkflowClassification } from "../claude-tasks/orchestrator-classification"
import {
  HustlerLifecycleError,
  acquireHustlerLock,
  assertReferenceIdentity,
  createWorkflowRecord,
  ensureDir,
  eventSignature,
  getHustlerWorkflowPath,
  prepareCreate,
  prepareApproverResult,
  prepareEvent,
  prepareWorkItem,
  readWorkflowRecord,
  sameIdentity,
  updateWorkflowRecord,
  writeJsonAtomic,
  workflowDirectory,
  workflowIdOf,
} from "./lifecycle-state-helpers"
export { HustlerLifecycleError, createHustlerWorkflowIdentity, getHustlerWorkflowPath } from "./lifecycle-state-helpers"

export type HustlerLifecycleConfig = Partial<OhMyOpenCodeConfig>

export type HustlerWorkflowReference = Readonly<{
  workflowId: string
  sessionId?: string
  taskId?: string
}> | string

export type CreateHustlerWorkflowInput = Readonly<{
  sessionId: string
  workflowId?: string
  taskId?: string
  classification: WorkflowClassification
}>

export type HustlerLifecycleEventInput = Readonly<{
  eventKey: string
  kind: "workflow_started" | "session_idle" | "session_error" | "tool_result" | "delegated_work"
  code?: string
}>

export type HustlerWorkItemInput = Readonly<{
  eventKey: string
  workerId: string
  role: "orchestrator" | "planner" | "developer" | "tester" | "approver" | "librarian" | "architect"
  status: "pending" | "running" | "completed" | "failed"
  workItemId?: string
}>

export type HustlerLifecycleAdapter = Readonly<{
  create(input: CreateHustlerWorkflowInput): HustlerLifecycleRecord
  load(reference: HustlerWorkflowReference): HustlerLifecycleRecord | null
  transition(reference: HustlerWorkflowReference, input: Readonly<{ eventKey: string; nextPhase: unknown }>): HustlerLifecycleRecord
  recordEvent(reference: HustlerWorkflowReference, input: HustlerLifecycleEventInput): HustlerLifecycleRecord
  recordWorkItem(reference: HustlerWorkflowReference, input: HustlerWorkItemInput): HustlerLifecycleRecord
  recordTesterReview(reference: HustlerWorkflowReference, input: Readonly<{ eventKey: string; review: TesterReview; workItemId?: string }>): HustlerLifecycleRecord
  recordApproverResult(reference: HustlerWorkflowReference, input: Readonly<{ eventKey: string; result: ApproverInput; workItemId?: string }>): HustlerLifecycleRecord
  retry(reference: HustlerWorkflowReference, input: Readonly<{ eventKey: string; failure: "developer" | "tester" | "approver" | "librarian" | "architect"; workItemId?: string; planInvalidated?: boolean }>): HustlerLifecycleRecord
  cancel(reference: HustlerWorkflowReference, input: Readonly<{ eventKey: string }>): HustlerLifecycleRecord
  complete(reference: HustlerWorkflowReference, input: Readonly<{ eventKey: string }>): HustlerLifecycleRecord
}>

export function createHustlerLifecycleAdapter(config: HustlerLifecycleConfig = {}): HustlerLifecycleAdapter {
  return {
    create(input) {
      const { identity, classification } = prepareCreate(input)
      const directory = workflowDirectory(config)
      const filePath = getHustlerWorkflowPath(config, identity.workflowId)
      ensureDir(directory)
      const lock = acquireHustlerLock(directory)
      try {
        const existing = readWorkflowRecord(filePath)
        if (existing !== null) {
          if (!sameIdentity(existing.identity, identity)) {
            throw new HustlerLifecycleError("CONFLICTING_RECORD", `Workflow identity conflicts: ${identity.workflowId}`)
          }
          return existing
        }
        const record = createWorkflowRecord(identity, classification)
        writeJsonAtomic(filePath, record)
        return record
      } finally {
        lock.release()
      }
    },
    load(reference) {
      const record = readWorkflowRecord(getHustlerWorkflowPath(config, workflowIdOf(reference)))
      if (record !== null) assertReferenceIdentity(record, reference)
      return record
    },
    transition(reference, input) {
      const nextPhase = String(input.nextPhase)
      return updateWorkflowRecord(config, reference, input.eventKey, "transition", eventSignature([nextPhase]), current => {
        const state = transitionWorkflowState(current.state, input.nextPhase)
        return { state, toPhase: state.phase }
      })
    },
    recordEvent(reference, input) {
      return updateWorkflowRecord(config, reference, input.eventKey, "event", prepareEvent(input), current => ({ state: current.state }))
    },
    recordWorkItem(reference, input) {
      const workflowId = workflowIdOf(reference)
      const workItemId = input.workItemId ?? `WI-${eventSignature([workflowId, input.workerId])}`
      const normalizedInput = { ...input, workItemId }
      return updateWorkflowRecord(config, reference, input.eventKey, "event", prepareWorkItem(normalizedInput), current => {
        const workers = current.state.workers.filter(worker => worker.id !== input.workerId)
        const state = WorkflowStateSchema.parse({
          ...current.state,
          workers: [...workers, {
            id: input.workerId,
            role: input.role,
            status: input.status,
            workItemId,
          }],
        })
        return { state }
      })
    },
    recordTesterReview(reference, input) {
      const reviewStatus = input.review.status
      return updateWorkflowRecord(config, reference, input.eventKey, "tester_review", eventSignature([reviewStatus, input.workItemId, JSON.stringify(input.review)]), current => {
        const state = recordTesterReview(current.state, input.review, input.workItemId)
        return { state, toPhase: state.phase, reviewStatus }
      })
    },
    recordApproverResult(reference, input) {
      const resultStatus = resolveApproverResult(input.result).status
      return updateWorkflowRecord(config, reference, input.eventKey, "approver_result", eventSignature([resultStatus, input.workItemId, prepareApproverResult(input.result)]), current => {
        const state = recordApproverResult(current.state, input.result, input.workItemId)
        return { state, toPhase: state.phase, reviewStatus: resultStatus }
      })
    },
    retry(reference, input) {
      const planInvalidated = input.planInvalidated ?? false
      return updateWorkflowRecord(config, reference, input.eventKey, "retry", eventSignature([input.failure, input.workItemId, planInvalidated]), current => {
        const route: WorkflowRetryRoute = resolveRetryRoute({
          failure: input.failure,
          workItemId: input.workItemId,
          planInvalidated,
        })
        const state = WorkflowStateSchema.parse({
          ...current.state,
          phase: route.phase,
          retryCount: current.state.retryCount + 1,
          lastRetry: route,
        })
        return { state, toPhase: state.phase }
      })
    },
    cancel(reference, input) {
      return updateWorkflowRecord(config, reference, input.eventKey, "cancel", "cancel", current => ({
        state: WorkflowStateSchema.parse({
          ...current.state,
          workers: current.state.workers.map(worker => worker.status === "pending" || worker.status === "running"
            ? { ...worker, status: "failed" }
            : worker),
        }),
        status: "cancelled",
      }))
    },
    complete(reference, input) {
      return updateWorkflowRecord(config, reference, input.eventKey, "complete", "complete", current => {
        const state = transitionWorkflowState(current.state, "complete")
        return { state, status: "completed", toPhase: state.phase }
      })
    },
  }
}

export type { HustlerLifecycleEvent, HustlerWorkflowClassification, HustlerWorkflowIdentity } from "./lifecycle-state-schema"
