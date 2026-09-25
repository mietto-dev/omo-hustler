import type { OhMyOpenCodeConfig } from "../../config/schema"
import {
  ApproverInputSchema,
  TesterReviewSchema,
  WorkflowContractSchema,
  type ApproverInput,
  type TesterReview,
  type WorkflowContract,
} from "../opencode-tasks/workflow-contracts"
import { createHustlerLifecycleAdapter, createHustlerWorkflowIdentity, type HustlerLifecycleAdapter } from "./lifecycle-state"
import type { HustlerLifecycleRecord } from "./lifecycle-state-schema"
import { resolveSessionEventID } from "../../shared/event-session-id"
import { log } from "../../shared/logger"

type Metadata = Record<string, unknown>

type WorkflowEventInput = Readonly<{
  type: string
  properties?: unknown
}>

type ToolResultInput = Readonly<{
  tool: string
  sessionID: string
  callID?: string
  output?: { metadata?: Metadata; title?: string; output?: string }
}>

type WorkflowReference = Readonly<{
  workflowId: string
  sessionId?: string
  taskId?: string
}>

function record(value: unknown): Metadata | undefined {
  return typeof value === "object" && value !== null ? value as Metadata : undefined
}

function nestedMetadata(value: unknown): Metadata | undefined {
  const candidate = record(value)
  if (!candidate) return undefined
  return record(candidate.metadata) ?? candidate
}

function sessionIDOf(properties: Metadata | undefined): string | undefined {
  return resolveSessionEventID(properties)
}

function workflowContractOf(value: unknown): WorkflowContract | undefined {
  const metadata = nestedMetadata(value)
  const candidate = metadata?.workflowContract ?? metadata?.workflow_contract
  const parsed = WorkflowContractSchema.safeParse(candidate)
  return parsed.success ? parsed.data : undefined
}

function resultCandidate(value: unknown, text?: string): unknown {
  const metadata = nestedMetadata(value)
  const structured = metadata?.workflowResult
    ?? metadata?.workflow_result
    ?? metadata?.review
    ?? metadata?.testerReview
    ?? metadata?.tester_review
    ?? metadata?.approverResult
    ?? metadata?.approver_result
    ?? metadata?.result
  if (structured !== undefined || text === undefined) return structured
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}

function reviewOf(value: unknown): TesterReview | undefined {
  const parsed = TesterReviewSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function approverInputOf(value: unknown): ApproverInput | undefined {
  const parsed = ApproverInputSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

function referenceOf(sessionId: string, contract?: WorkflowContract): WorkflowReference {
  if (contract) return contract.metadata
  const identity = createHustlerWorkflowIdentity({ sessionId })
  return identity
}

function workItemOf(contract: WorkflowContract | undefined): string | undefined {
  return contract?.metadata.workItemId
}

function operationError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function hasActiveWorkers(record: HustlerLifecycleRecord): boolean {
  return record.state.workers.some(worker => worker.status === "pending" || worker.status === "running")
}

function isToolError(input: ToolResultInput): boolean {
  const metadata = input.output?.metadata
  const status = metadata?.status
  const exitCode = metadata?.exit
  return metadata?.error !== undefined
    || status === "error"
    || status === "failed"
    || (typeof exitCode === "number" && exitCode !== 0)
    || /^error$/i.test(input.output?.title ?? "")
}

export type HustlerEventLifecycle = Readonly<{
  event: (input: WorkflowEventInput) => void
  toolResult: (input: ToolResultInput) => void
}>

export function createHustlerEventLifecycle(
  config: Partial<OhMyOpenCodeConfig> = {},
  lifecycle: HustlerLifecycleAdapter = createHustlerLifecycleAdapter(config),
): HustlerEventLifecycle {
  const apply = (eventKey: string, action: () => HustlerLifecycleRecord): void => {
    try {
      action()
    } catch (error) {
      log("[hustler] lifecycle event ignored", { eventKey, error: operationError(error) })
    }
  }

  const event = (input: WorkflowEventInput): void => {
    const properties = record(input.properties)
    const sessionId = sessionIDOf(properties)
    if (!sessionId) return
    const contract = workflowContractOf(properties?.info) ?? workflowContractOf(properties)
    const reference = referenceOf(sessionId, contract)
    const status = record(properties?.status)
    const statusType = typeof status?.type === "string" ? status.type : undefined
    const eventKey = `opencode:${input.type}:${sessionId}:${String(properties?.callID ?? properties?.messageID ?? statusType ?? "event")}`

    if (input.type === "session.stop" || input.type === "session.cancel") {
      apply(eventKey, () => lifecycle.cancel(reference, { eventKey }))
      return
    }
    if (input.type === "session.error") {
      const error = record(properties?.error)
      const errorName = typeof error?.name === "string" ? error.name : "session_error"
      const isAbort = /abort|cancel|interrupt/i.test(`${errorName} ${String(error?.message ?? "")}`)
      apply(eventKey, () => isAbort
        ? lifecycle.cancel(reference, { eventKey })
        : lifecycle.fail(reference, { eventKey, code: errorName }))
      return
    }
    if (input.type === "session.status") {
      if (/cancel|abort|interrupt/i.test(statusType ?? "")) {
        apply(eventKey, () => lifecycle.cancel(reference, { eventKey }))
      } else if (/error|fail/i.test(statusType ?? "")) {
        apply(eventKey, () => lifecycle.fail(reference, { eventKey, code: statusType }))
      }
      return
    }
    if (input.type === "message.updated") {
      const info = record(properties?.info)
      const error = record(info?.error ?? properties?.error)
      if (error) {
        const errorName = typeof error.name === "string" ? error.name : "message_error"
        const isAbort = /abort|cancel|interrupt/i.test(`${errorName} ${String(error.message ?? "")}`)
        apply(eventKey, () => isAbort
          ? lifecycle.cancel(reference, { eventKey })
          : lifecycle.fail(reference, { eventKey, code: errorName }))
      }
      return
    }
    if (input.type !== "session.idle") return

    apply(eventKey, () => lifecycle.recordEvent(reference, {
      eventKey,
      kind: "session_idle",
      code: contract?.kind,
    }))
    if (contract) {
      apply(`${eventKey}:worker`, () => lifecycle.recordWorkItem(reference, {
        eventKey: `${eventKey}:worker`,
        workerId: contract.metadata.workItemId ?? contract.metadata.role,
        role: contract.metadata.role,
        status: "completed",
        workItemId: contract.metadata.workItemId,
      }))
    }

    let current: HustlerLifecycleRecord | null
    try {
      current = lifecycle.load(reference)
    } catch (error) {
      log("[hustler] lifecycle state unavailable", { eventKey, error: operationError(error) })
      return
    }
    if (!current || hasActiveWorkers(current)) return
    if (current.state.phase === "implementation" || current.state.phase === "integration") {
      apply(`${eventKey}:review`, () => lifecycle.transition(reference, {
        eventKey: `${eventKey}:review`,
        nextPhase: "review",
      }))
    } else if (current.state.phase === "acceptance" && current.state.acceptance?.status === "accepted") {
      apply(`${eventKey}:complete`, () => lifecycle.complete(reference, {
        eventKey: `${eventKey}:complete`,
      }))
    }
  }

  const toolResult = (input: ToolResultInput): void => {
    const contract = workflowContractOf(input.output?.metadata)
    const reference = referenceOf(input.sessionID, contract)
    const eventKey = `opencode:tool-result:${input.sessionID}:${input.callID ?? input.tool}`
    const result = resultCandidate(input.output?.metadata, input.output?.output)
    const review = contract?.kind === "tester" ? reviewOf(result) : undefined
    const approval = contract?.kind === "approver" ? approverInputOf(result) : undefined

    if (review) {
      apply(eventKey, () => lifecycle.recordTesterReview(reference, {
        eventKey,
        review,
        workItemId: workItemOf(contract),
      }))
      return
    }
    if (approval) {
      apply(eventKey, () => lifecycle.recordApproverResult(reference, {
        eventKey,
        result: approval,
        workItemId: workItemOf(contract),
      }))
      return
    }
    if (isToolError(input)) {
      apply(eventKey, () => lifecycle.fail(reference, { eventKey, code: "tool_error" }))
      return
    }
    if (contract?.kind === "developer" || contract?.kind === "planner") {
      apply(eventKey, () => lifecycle.recordWorkItem(reference, {
        eventKey,
        workerId: contract.metadata.workItemId ?? contract.metadata.role,
        role: contract.metadata.role,
        status: "completed",
        workItemId: contract.metadata.workItemId,
      }))
      return
    }
    apply(eventKey, () => lifecycle.recordEvent(reference, {
      eventKey,
      kind: "tool_result",
      code: input.tool,
    }))
  }

  return { event, toolResult }
}
