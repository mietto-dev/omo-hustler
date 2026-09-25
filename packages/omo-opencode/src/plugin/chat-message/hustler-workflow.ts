import { OrchestratorWorkflowConfigSchema } from "../../config/schema/workflow"
import {
  classifyTask,
  type OrchestratorTaskSignals,
} from "../../features/opencode-tasks/orchestrator-classification"
import {
  createHustlerLifecycleAdapter,
  type HustlerLifecycleAdapter,
  type HustlerLifecycleConfig,
} from "../../features/hustler/lifecycle-state"
import type { HustlerLifecycleRecord } from "../../features/hustler/lifecycle-state-schema"

export type HustlerChatWorkflowMetadata = Readonly<{
  workflowId: string
  taskId: string
  tier: number
  phase: string
  status: string
  classificationEvent: string
}>

export type HustlerChatWorkflowAdapter = Readonly<{
  startOrReuse: (input: Readonly<{ sessionID: string; text: string }>) => HustlerChatWorkflowMetadata
}>

function hasAny(text: string, terms: readonly string[]): boolean {
  return terms.some(term => text.includes(term))
}

export function deriveTaskSignals(text: string): OrchestratorTaskSignals {
  const normalized = text.toLowerCase()
  const broadScope = hasAny(normalized, [
    "multi-file",
    "multi file",
    "across the frontend and backend",
    "across frontend and backend",
    "full stack",
    "cross-layer",
  ])
  const layers = ["frontend", "backend", "api", "database", "schema", "storage"]
    .filter(layer => normalized.includes(layer)).length
  const workstreams = hasAny(normalized, ["parallel", "independent work", "workstreams"]) ? 2 : 0
  const expectedFiles = broadScope ? 5 : hasAny(normalized, ["files", "components", "modules"]) ? 2 : 1
  const securitySensitive = hasAny(normalized, ["authentication", "authorization", "security", "permission"])
  const destructiveMigration = hasAny(normalized, ["drop table", "destructive migration", "delete production data"])
  const crossServiceArchitecture = hasAny(normalized, ["cross-service", "microservice", "distributed system"])
  const schemaOrDatabaseChange = hasAny(normalized, ["schema", "database", "migration"])
  const publicApiChange = hasAny(normalized, ["public api", "breaking api", "api contract"])
  const explicitAmbiguity = hasAny(normalized, ["which approach", "architecture options", "uncertain design"])
  const localized = !broadScope && layers <= 1 && expectedFiles <= 1 && text.trim().length <= 160

  return {
    expectedFiles,
    layers,
    workstreams,
    securitySensitive,
    destructiveMigration,
    crossServiceArchitecture,
    schemaOrDatabaseChange,
    publicApiChange,
    explicitAmbiguity,
    localized,
  }
}

function metadataFromRecord(record: HustlerLifecycleRecord): HustlerChatWorkflowMetadata {
  return {
    workflowId: record.identity.workflowId,
    taskId: record.identity.taskId,
    tier: record.classification.tier,
    phase: record.state.phase,
    status: record.status,
    classificationEvent: `workflow_started:tier-${record.classification.tier}:${record.state.phase}`,
  }
}

export function createHustlerChatWorkflowAdapter(
  config: HustlerLifecycleConfig = {},
): HustlerChatWorkflowAdapter {
  const lifecycle = createHustlerLifecycleAdapter(config)
  const workflowConfig = OrchestratorWorkflowConfigSchema.parse(config.workflow ?? {})
  return createHustlerChatWorkflowAdapterFromLifecycle(lifecycle, workflowConfig)
}

export function createHustlerChatWorkflowAdapterFromLifecycle(
  lifecycle: HustlerLifecycleAdapter,
  workflowConfig = OrchestratorWorkflowConfigSchema.parse({}),
): HustlerChatWorkflowAdapter {
  return {
    startOrReuse(input) {
      const signals = deriveTaskSignals(input.text)
      const classification = classifyTask(
        workflowConfig.default_tier === "auto"
          ? signals
          : { ...signals, tierOverride: workflowConfig.default_tier },
        workflowConfig.thresholds,
      )
      const created = lifecycle.create({ sessionId: input.sessionID, classification })
      const workflowId = created.identity.workflowId
      const eventKey = `chat-message:${input.sessionID}:workflow-started`
      lifecycle.recordEvent(workflowId, {
        eventKey,
        kind: "workflow_started",
        code: `tier-${classification.tier}`,
      })
      const nextPhase = classification.tier >= 2 ? "planning" : "implementation"
      const transitioned = lifecycle.transition(workflowId, {
        eventKey: `chat-message:${input.sessionID}:initial-phase`,
        nextPhase,
      })
      return metadataFromRecord(transitioned)
    },
  }
}
