import { z } from "zod"

const TierSchema = z.number().int().min(0).max(3)

export const OrchestratorWorkflowThresholdsSchema = z.object({
  layers: z.number().int().min(2).max(1000).default(2),
  workstreams: z.number().int().min(2).max(1000).default(2),
  expected_files: z.number().int().min(2).max(1000).default(5),
}).strict()

export const OrchestratorWorkflowConfigSchema = z.object({
  default_tier: z.union([z.literal("auto"), TierSchema]).default("auto"),
  thresholds: OrchestratorWorkflowThresholdsSchema.default({
    layers: 2,
    workstreams: 2,
    expected_files: 5,
  }),
  architect: z.object({
    max_calls_per_task: z.number().int().min(0).max(16).default(2),
  }).strict().default({ max_calls_per_task: 2 }),
}).strict()

export type OrchestratorWorkflowThresholds = z.output<typeof OrchestratorWorkflowThresholdsSchema>
export type OrchestratorWorkflowConfig = z.output<typeof OrchestratorWorkflowConfigSchema>
