import { z } from "zod"
import {
  OrchestratorWorkflowThresholdsSchema,
  type OrchestratorWorkflowThresholds,
} from "../../config/schema/workflow"

export const WorkflowTierSchema = z.number().int().min(0).max(3)
export type WorkflowTier = z.infer<typeof WorkflowTierSchema>

export const OrchestratorTaskSignalsSchema = z.object({
  expectedFiles: z.number().int().min(0).default(0),
  layers: z.number().int().min(0).default(0),
  workstreams: z.number().int().min(0).default(0),
  securitySensitive: z.boolean().default(false),
  destructiveMigration: z.boolean().default(false),
  crossServiceArchitecture: z.boolean().default(false),
  schemaOrDatabaseChange: z.boolean().default(false),
  publicApiChange: z.boolean().default(false),
  explicitAmbiguity: z.boolean().default(false),
  localized: z.boolean().default(false),
  userRequestedReview: z.boolean().default(false),
  tierOverride: WorkflowTierSchema.optional(),
}).strict()

export type OrchestratorTaskSignals = z.input<typeof OrchestratorTaskSignalsSchema>
type NormalizedTaskSignals = z.output<typeof OrchestratorTaskSignalsSchema>

export type WorkflowClassificationErrorCode =
  | "CONTRADICTORY_SIGNALS"
  | "INVALID_TIER_OVERRIDE"

export class WorkflowClassificationError extends Error {
  readonly code: WorkflowClassificationErrorCode

  constructor(code: WorkflowClassificationErrorCode, message: string) {
    super(message)
    this.name = "WorkflowClassificationError"
    this.code = code
  }
}

export type WorkflowClassification = Readonly<{
  tier: WorkflowTier
  minimumTier: WorkflowTier
  signals: NormalizedTaskSignals
}>

const DEFAULT_THRESHOLDS = OrchestratorWorkflowThresholdsSchema.parse({})

function normalizeSignals(input: OrchestratorTaskSignals): NormalizedTaskSignals {
  return OrchestratorTaskSignalsSchema.parse(input)
}

function validateSignalConsistency(signals: NormalizedTaskSignals): void {
  const hasBroadSignal = signals.expectedFiles > 1
    || signals.layers >= 2
    || signals.workstreams >= 2
    || signals.securitySensitive
    || signals.destructiveMigration
    || signals.crossServiceArchitecture

  if (signals.localized && hasBroadSignal) {
    throw new WorkflowClassificationError(
      "CONTRADICTORY_SIGNALS",
      "Localized work cannot also be multi-file, multi-layer, multi-workstream, or high-risk",
    )
  }
}

function minimumTierFor(
  signals: NormalizedTaskSignals,
  thresholds: OrchestratorWorkflowThresholds,
): WorkflowTier {
  if (signals.securitySensitive || signals.destructiveMigration || signals.crossServiceArchitecture) return 3
  if (
    signals.layers >= thresholds.layers
    || signals.workstreams >= thresholds.workstreams
    || signals.expectedFiles >= thresholds.expected_files
  ) return 2
  if (signals.localized && signals.expectedFiles <= 1) return 0
  return 1
}

export function classifyTask(
  input: OrchestratorTaskSignals,
  thresholds: OrchestratorWorkflowThresholds = DEFAULT_THRESHOLDS,
): WorkflowClassification {
  const signals = normalizeSignals(input)
  const validatedThresholds = OrchestratorWorkflowThresholdsSchema.parse(thresholds)
  validateSignalConsistency(signals)
  const minimumTier = minimumTierFor(signals, validatedThresholds)
  const tier = signals.tierOverride ?? minimumTier

  if (tier < minimumTier) {
    throw new WorkflowClassificationError(
      "INVALID_TIER_OVERRIDE",
      `Tier override ${tier} is below the required minimum tier ${minimumTier}`,
    )
  }

  return { tier, minimumTier, signals }
}

export const ARCHITECT_REASON_CODES = [
  "architecture-conflict",
  "security",
  "data-integrity",
  "repeated-debug-failure",
  "high-blast-radius",
  "uncertain-external-contract",
] as const

export const ArchitectReasonSchema = z.enum(ARCHITECT_REASON_CODES)
export type ArchitectReasonCode = z.infer<typeof ArchitectReasonSchema>

function architectReasonFor(signals: NormalizedTaskSignals): ArchitectReasonCode | undefined {
  if (signals.securitySensitive) return "security"
  if (signals.destructiveMigration || signals.schemaOrDatabaseChange) return "data-integrity"
  if (signals.crossServiceArchitecture) return "high-blast-radius"
  if (signals.publicApiChange) return "uncertain-external-contract"
  if (signals.explicitAmbiguity) return "architecture-conflict"
  return undefined
}

export type WorkflowRouting = Readonly<{
  requiresPlanner: boolean
  requiresTester: boolean
  requiresPreflightTester: boolean
  architectReason: ArchitectReasonCode | undefined
}>

export function getWorkflowRouting(input: {
  readonly tier: WorkflowTier
  readonly signals: OrchestratorTaskSignals
}): WorkflowRouting {
  const classification = classifyTask({ ...input.signals, tierOverride: input.tier })
  const { signals, tier } = classification
  const riskRequiresTester = signals.securitySensitive
    || signals.destructiveMigration
    || signals.publicApiChange
    || signals.schemaOrDatabaseChange
    || signals.userRequestedReview

  return {
    requiresPlanner: tier >= 2,
    requiresTester: tier >= 2 || riskRequiresTester,
    requiresPreflightTester: tier === 3,
    architectReason: tier >= 3 ? architectReasonFor(signals) : undefined,
  }
}
