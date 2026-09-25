import type { AgentConfig } from "@opencode-ai/sdk"
import type { AgentMode, AgentPromptMetadata } from "../../agents/types"
import { HUSTLER_ROLES, type HustlerRole } from "./role-constants"
import { AGENT_MODEL_REQUIREMENTS, type ModelRequirement } from "../../shared/model-requirements"

export const HUSTLER_ROLE_MODES: Record<HustlerRole, AgentMode> = {
  orchestrator: "primary",
  planner: "primary",
  developer: "primary",
  tester: "subagent",
  approver: "subagent",
  librarian: "subagent",
  architect: "subagent",
}

export type HustlerCapability =
  | "classify"
  | "coordinate"
  | "delegate"
  | "decompose"
  | "plan"
  | "implement"
  | "edit"
  | "test"
  | "inspect"
  | "review"
  | "verify"
  | "research"
  | "analyze"
  | "propose"
  | "report"

export type HustlerRoleMetadata = Readonly<{
  identity: string
  capabilities: readonly HustlerCapability[]
  promptMetadata: AgentPromptMetadata
}>

export type HustlerRoleDefinition = Readonly<{
  key: HustlerRole
  config: AgentConfig
  metadata: HustlerRoleMetadata
  modelRequirement: ModelRequirement
}>

const LEGACY_ROLE_NAMES = ["Sisyphus", "Hephaestus", "Prometheus", "Atlas"] as const

export function sanitizeHustlerPrompt(prompt: string | undefined): string | undefined {
  if (prompt === undefined) return undefined
  return LEGACY_ROLE_NAMES.reduce(
    (current, legacyName) => current.replace(new RegExp(`\\b${legacyName}\\b`, "gi"), "HUSTLER"),
    prompt,
  )
}

type RoleSpec = Readonly<{
  mode: AgentMode
  capabilities: readonly HustlerCapability[]
  category: AgentPromptMetadata["category"]
  cost: AgentPromptMetadata["cost"]
  domain: string
}>

const ROLE_SPECS: Record<HustlerRole, RoleSpec> = {
  orchestrator: {
    mode: "primary",
    capabilities: ["classify", "coordinate", "delegate", "verify"],
    category: "specialist",
    cost: "EXPENSIVE",
    domain: "Workflow coordination",
  },
  planner: {
    mode: "primary",
    capabilities: ["decompose", "plan", "analyze", "propose"],
    category: "specialist",
    cost: "EXPENSIVE",
    domain: "Task planning",
  },
  developer: {
    mode: "primary",
    capabilities: ["implement", "edit", "test", "inspect"],
    category: "specialist",
    cost: "EXPENSIVE",
    domain: "Software implementation",
  },
  tester: {
    mode: "subagent",
    capabilities: ["test", "inspect", "verify", "report"],
    category: "utility",
    cost: "CHEAP",
    domain: "Validation and regression testing",
  },
  approver: {
    mode: "subagent",
    capabilities: ["review", "verify", "analyze"],
    category: "advisor",
    cost: "EXPENSIVE",
    domain: "Acceptance review",
  },
  librarian: {
    mode: "subagent",
    capabilities: ["research", "inspect", "analyze"],
    category: "exploration",
    cost: "CHEAP",
    domain: "Repository and external research",
  },
  architect: {
    mode: "subagent",
    capabilities: ["analyze", "inspect", "propose", "verify"],
    category: "advisor",
    cost: "EXPENSIVE",
    domain: "Architecture review",
  },
}

function createRoleDefinition(role: HustlerRole, model: string): HustlerRoleDefinition {
  const spec = ROLE_SPECS[role]
  const identity = `hustler.${role}`
  const promptMetadata: AgentPromptMetadata = {
    category: spec.category,
    cost: spec.cost,
    promptAlias: identity,
    triggers: [{ domain: spec.domain, trigger: `Use ${identity} for ${spec.domain.toLowerCase()}` }],
  }

  return {
    key: role,
    config: {
      description: `${identity} role for ${spec.domain.toLowerCase()}`,
      mode: spec.mode,
      model,
      prompt: `<hustler-role identity="${identity}" />`,
    },
    metadata: {
      identity,
      capabilities: spec.capabilities,
      promptMetadata,
    },
    modelRequirement: AGENT_MODEL_REQUIREMENTS[role],
  }
}

export type HustlerRoleFactory = ((model: string) => HustlerRoleDefinition) & {
  mode: AgentMode
}

function createRoleFactory(role: HustlerRole): HustlerRoleFactory {
  const factory = ((model: string) => createRoleDefinition(role, model)) as HustlerRoleFactory
  factory.mode = ROLE_SPECS[role].mode
  return factory
}

export const HUSTLER_ROLE_FACTORIES: Record<HustlerRole, HustlerRoleFactory> = Object.fromEntries(
  HUSTLER_ROLES.map((role) => [role, createRoleFactory(role)]),
) as Record<HustlerRole, HustlerRoleFactory>
