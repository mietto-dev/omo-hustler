import { z } from "zod"
import { PlannerPlanSchema, type PlannerPlan } from "./workflow-contracts"
import type { WorkflowTier } from "./orchestrator-classification"

export const WorkflowPhaseSchema = z.enum([
  "routing",
  "planning",
  "implementation",
  "integration",
  "review",
  "acceptance",
  "complete",
])
export type WorkflowPhase = z.infer<typeof WorkflowPhaseSchema>

const WorkflowWorkerStateSchema = z.object({
  id: z.string().trim().min(1),
  role: z.enum(["orchestrator", "planner", "developer", "tester", "approver", "librarian", "architect"]),
  status: z.enum(["pending", "running", "completed", "failed"]),
  workItemId: z.string().trim().min(1).optional(),
}).strict()

const WorkflowRetryRouteSchema = z.object({
  role: z.enum(["planner", "developer", "librarian", "orchestrator"]),
  workItemId: z.string().trim().min(1).optional(),
  phase: WorkflowPhaseSchema,
}).strict()

export const WorkflowStateSchema = z.object({
  taskId: z.string().trim().min(1),
  tier: z.number().int().min(0).max(3),
  phase: WorkflowPhaseSchema,
  plan: PlannerPlanSchema.optional(),
  workers: z.array(WorkflowWorkerStateSchema).default([]),
  review: z.object({ status: z.enum(["pending", "approved", "changes_requested"]) }).strict().optional(),
  acceptance: z.object({ status: z.enum(["pending", "accepted", "incomplete"]) }).strict().optional(),
  architectCalls: z.number().int().min(0).default(0),
  retryCount: z.number().int().min(0).default(0),
  lastRetry: WorkflowRetryRouteSchema.optional(),
}).strict()

export type WorkflowState = z.output<typeof WorkflowStateSchema>

export type WorkflowStateErrorCode =
  | "INVALID_PHASE_TRANSITION"
  | "PLANNER_REQUIRED"
  | "INVALID_PLANNER_EVIDENCE"
  | "MISSING_WORK_ITEM"
  | "INVALID_METADATA"

export class WorkflowStateError extends Error {
  readonly code: WorkflowStateErrorCode

  constructor(code: WorkflowStateErrorCode, message: string) {
    super(message)
    this.name = "WorkflowStateError"
    this.code = code
  }
}

const ALLOWED_PHASE_TRANSITIONS: Readonly<Record<WorkflowPhase, readonly WorkflowPhase[]>> = {
  routing: ["planning", "implementation"],
  planning: ["implementation"],
  implementation: ["integration", "review", "acceptance"],
  integration: ["review"],
  review: ["acceptance"],
  acceptance: ["complete"],
  complete: [],
}

export function createWorkflowState(taskId: string, tier: WorkflowTier): WorkflowState {
  return WorkflowStateSchema.parse({ taskId, tier, phase: "routing" })
}

export function attachPlannerPlan(state: WorkflowState, plan: PlannerPlan): WorkflowState {
  if (state.phase !== "planning") {
    throw new WorkflowStateError("INVALID_PHASE_TRANSITION", "Planner evidence can only be attached during planning")
  }
  const parsedPlan = PlannerPlanSchema.safeParse(plan)
  if (!parsedPlan.success) {
    throw new WorkflowStateError("INVALID_PLANNER_EVIDENCE", "Planner evidence does not satisfy the Planner contract")
  }
  return WorkflowStateSchema.parse({ ...state, plan: parsedPlan.data })
}

export function transitionWorkflowState(state: WorkflowState, nextPhase: unknown): WorkflowState {
  const parsedNextPhase = WorkflowPhaseSchema.safeParse(nextPhase)
  if (!parsedNextPhase.success || !ALLOWED_PHASE_TRANSITIONS[state.phase].includes(parsedNextPhase.data)) {
    throw new WorkflowStateError(
      "INVALID_PHASE_TRANSITION",
      `Cannot transition workflow from ${state.phase} to ${String(nextPhase)}`,
    )
  }

  if (state.tier >= 2 && parsedNextPhase.data === "implementation" && state.plan === undefined) {
    throw new WorkflowStateError("PLANNER_REQUIRED", "Planner evidence is required before Tier 2 implementation")
  }

  if (state.tier >= 2 && state.phase === "implementation" && parsedNextPhase.data !== "integration") {
    throw new WorkflowStateError("INVALID_PHASE_TRANSITION", "Tier 2 and Tier 3 implementation must enter integration")
  }

  return WorkflowStateSchema.parse({ ...state, phase: parsedNextPhase.data })
}

const RetryFailureSchema = z.enum(["developer", "librarian", "architect", "tester", "approver"])
const RetryRoutingInputSchema = z.object({
  failure: RetryFailureSchema,
  workItemId: z.string().trim().min(1).optional(),
  planInvalidated: z.boolean().default(false),
}).strict()
export type RetryRoutingInput = z.input<typeof RetryRoutingInputSchema>
export type WorkflowRetryRoute = z.output<typeof WorkflowRetryRouteSchema>

function requiredWorkItemId(input: z.output<typeof RetryRoutingInputSchema>): string {
  if (input.workItemId === undefined) {
    throw new WorkflowStateError("MISSING_WORK_ITEM", `${input.failure} retry requires a work item ID`)
  }
  return input.workItemId
}

export function resolveRetryRoute(input: RetryRoutingInput): WorkflowRetryRoute {
  const parsed = RetryRoutingInputSchema.parse(input)
  switch (parsed.failure) {
    case "developer":
      return parsed.planInvalidated
        ? { role: "planner", phase: "planning" }
        : { role: "developer", workItemId: requiredWorkItemId(parsed), phase: "implementation" }
    case "tester":
    case "approver":
      return { role: "developer", workItemId: requiredWorkItemId(parsed), phase: "implementation" }
    case "librarian":
      return { role: "librarian", phase: "planning" }
    case "architect":
      return { role: "orchestrator", phase: "routing" }
    default:
      return assertNever(parsed.failure)
  }
}

function assertNever(value: never): never {
  throw new WorkflowStateError("INVALID_PHASE_TRANSITION", `Unsupported retry failure: ${String(value)}`)
}

export const WORKFLOW_STATE_METADATA_KEY = "omoWorkflowState"

export function writeWorkflowStateMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
  state: WorkflowState,
): Record<string, unknown> {
  return { ...(metadata ?? {}), [WORKFLOW_STATE_METADATA_KEY]: state }
}

export function readWorkflowStateMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): WorkflowState | undefined {
  const candidate = metadata?.[WORKFLOW_STATE_METADATA_KEY]
  if (candidate === undefined) return undefined
  const result = WorkflowStateSchema.safeParse(candidate)
  if (!result.success) {
    throw new WorkflowStateError("INVALID_METADATA", "Stored workflow metadata is invalid")
  }
  return result.data
}
