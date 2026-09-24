import { z } from "zod"

import { MIRROR_SCHEMA_VERSION } from "./constants"
import type { AgentStatus, LoopLive } from "./state-types"
import type { BackgroundTaskStatus } from "../background-agent/types"

const HUSTLER_ROLE_VALUES = [
  "orchestrator",
  "planner",
  "developer",
  "tester",
  "approver",
  "librarian",
  "architect",
] as const

const HUSTLER_PHASE_VALUES = [
  "routing",
  "planning",
  "implementation",
  "integration",
  "review",
  "acceptance",
  "complete",
] as const

const HUSTLER_WORKER_STATUS_VALUES = ["pending", "running", "completed", "failed"] as const
const HUSTLER_REVIEW_STATE_VALUES = [
  "not-started",
  "pending",
  "approved",
  "changes_requested",
  "accepted",
  "incomplete",
] as const
const HUSTLER_PLANNER_GATE_VALUES = ["not-required", "required", "satisfied"] as const
const HUSTLER_TERMINAL_STATUS_VALUES = ["active", "completed", "cancelled", "failed"] as const

const AGENT_STATUS_VALUES = [
  "busy",
  "idle",
  "error",
  "running",
  "retry",
] as const satisfies readonly AgentStatus[]

const BACKGROUND_TASK_STATUS_VALUES = [
  "pending",
  "running",
  "completed",
  "error",
  "cancelled",
  "interrupt",
] as const satisfies readonly BackgroundTaskStatus[]

const AgentRowSchema = z.object({
  name: z.string(),
  status: z.enum(AGENT_STATUS_VALUES),
}).strict()

const JobRowSchema = z.object({
  title: z.string(),
  status: z.enum(BACKGROUND_TASK_STATUS_VALUES),
  toolCalls: z.number().int().nonnegative().nullable(),
  lastTool: z.string().nullable(),
}).strict()

const LoopLiveSchema = z.object({
  kind: z.literal("live"),
  goalsDone: z.number().int().nonnegative(),
  goalsTotal: z.number().int().nonnegative(),
  pass: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  pending: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  activeGoal: z.string().nullable(),
}).strict() satisfies z.ZodType<LoopLive>

const HustlerWorkItemSchema = z.object({
  id: z.string().trim().min(1).max(256),
  role: z.enum(HUSTLER_ROLE_VALUES),
  status: z.enum(HUSTLER_WORKER_STATUS_VALUES),
}).strict()

const HustlerWorkflowSchema = z.object({
  activeRole: z.enum(HUSTLER_ROLE_VALUES).nullable(),
  phase: z.enum(HUSTLER_PHASE_VALUES),
  plannerGate: z.enum(HUSTLER_PLANNER_GATE_VALUES),
  workItem: HustlerWorkItemSchema.nullable(),
  reviewState: z.enum(HUSTLER_REVIEW_STATE_VALUES),
  terminalStatus: z.enum(HUSTLER_TERMINAL_STATUS_VALUES),
}).strict()

export type TuiHustlerWorkflow = z.infer<typeof HustlerWorkflowSchema>

export const TuiRuntimeSnapshotSchema = z.object({
  version: z.literal(MIRROR_SCHEMA_VERSION),
  projectDir: z.string().trim().min(1),
  updatedAt: z.number().finite(),
  activeAgents: z.array(AgentRowSchema),
  jobBoard: z.array(JobRowSchema),
  loop: LoopLiveSchema.nullable(),
  hustlerWorkflow: HustlerWorkflowSchema.nullable().optional(),
}).strict()

export type TuiRuntimeSnapshot = z.infer<typeof TuiRuntimeSnapshotSchema>

export function parseSnapshot(raw: unknown): TuiRuntimeSnapshot | null {
  const parsed = TuiRuntimeSnapshotSchema.safeParse(raw)
  if (!parsed.success) {
    return null
  }
  return parsed.data
}
