import { z } from "zod"
import {
  OrchestratorTaskSignalsSchema,
  WorkflowTierSchema,
  type WorkflowClassification,
} from "../opencode-tasks/orchestrator-classification"
import { WorkflowStateSchema } from "../opencode-tasks/orchestrator-state"

export const HUSTLER_LIFECYCLE_RECORD_VERSION = 1 as const

const nonEmptyId = z.string().trim().min(1).max(256)

export const HustlerWorkflowIdentitySchema = z.object({
  sessionId: nonEmptyId,
  workflowId: nonEmptyId,
  taskId: nonEmptyId,
}).strict()
export type HustlerWorkflowIdentity = z.infer<typeof HustlerWorkflowIdentitySchema>

export const HustlerWorkflowClassificationSchema = z.object({
  tier: WorkflowTierSchema,
  minimumTier: WorkflowTierSchema,
  signals: OrchestratorTaskSignalsSchema,
}).strict()

export type HustlerWorkflowClassification = z.infer<typeof HustlerWorkflowClassificationSchema>

export const HustlerLifecycleStatusSchema = z.enum(["active", "completed", "cancelled", "failed"])
export type HustlerLifecycleStatus = z.infer<typeof HustlerLifecycleStatusSchema>

export const HustlerLifecycleOperationSchema = z.enum([
  "transition",
  "event",
  "tester_review",
  "approver_result",
  "retry",
  "cancel",
  "fail",
  "complete",
])
export type HustlerLifecycleOperation = z.infer<typeof HustlerLifecycleOperationSchema>

export const HustlerLifecycleEventSchema = z.object({
  eventKey: nonEmptyId,
  operation: HustlerLifecycleOperationSchema,
  signature: nonEmptyId,
  revision: z.number().int().nonnegative(),
  fromPhase: z.string().trim().min(1).max(64),
  toPhase: z.string().trim().min(1).max(64).optional(),
  reviewStatus: z.enum(["approved", "changes_requested", "accepted", "incomplete"]).optional(),
}).strict()
export type HustlerLifecycleEvent = z.infer<typeof HustlerLifecycleEventSchema>

export const HustlerLifecycleRecordSchema = z.object({
  version: z.literal(HUSTLER_LIFECYCLE_RECORD_VERSION),
  kind: z.literal("hustler-workflow"),
  identity: HustlerWorkflowIdentitySchema,
  classification: HustlerWorkflowClassificationSchema,
  state: WorkflowStateSchema,
  status: HustlerLifecycleStatusSchema,
  revision: z.number().int().nonnegative(),
  events: z.array(HustlerLifecycleEventSchema).max(2048),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
}).strict()

export type HustlerLifecycleRecord = z.infer<typeof HustlerLifecycleRecordSchema>

export function parseHustlerWorkflowClassification(
  classification: WorkflowClassification,
): HustlerWorkflowClassification {
  return HustlerWorkflowClassificationSchema.parse(classification)
}
