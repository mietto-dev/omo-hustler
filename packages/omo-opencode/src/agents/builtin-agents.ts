import type { AgentConfig } from "@opencode-ai/sdk"
import type { BuiltinAgentName, AgentOverrides, AgentFactory, AgentPromptMetadata } from "./types"
import type { CategoriesConfig, CategoryConfig, GitMasterConfig } from "../config/schema"
import type { LoadedSkill } from "../features/opencode-skill-loader/types"
import type { BrowserAutomationProvider } from "../config/schema"
import { createSisyphusAgent } from "./sisyphus"
import { createOracleAgent } from "./oracle"
import { createLibrarianAgent } from "./librarian"
import { createAtlasAgent, atlasPromptMetadata } from "./atlas"
import { createMomusAgent } from "./momus"
import { createHephaestusAgent } from "./hephaestus"
import type { AvailableCategory } from "./dynamic-agent-prompt-builder"
import {
  fetchAvailableModels,
  readConnectedProvidersCache,
  readProviderModelsCache,
} from "../shared"
import { CATEGORY_DESCRIPTIONS } from "../tools/delegate-task/constants"
import { mergeCategories } from "../shared/merge-categories"
import { buildAvailableSkills } from "./builtin-agents/available-skills"
import { collectPendingBuiltinAgents } from "./builtin-agents/general-agents"
import { applyOverrides } from "./builtin-agents/agent-overrides"
import { resolveAgentSkills } from "./agent-skill-resolution"
import { maybeCreateSisyphusConfig } from "./builtin-agents/sisyphus-agent"
import { maybeCreateHephaestusConfig } from "./builtin-agents/hephaestus-agent"
import { maybeCreateAtlasConfig } from "./builtin-agents/atlas-agent"
import { HUSTLER_ROLE_FACTORIES, sanitizeHustlerPrompt } from "../features/hustler/roles"
import { HUSTLER_ROLES, type HustlerRole } from "../features/hustler/role-constants"

type AgentSource = AgentFactory | AgentConfig

const createTesterAgent: AgentFactory = (model) => createMomusAgent(model)
createTesterAgent.mode = "subagent"

const createArchitectAgent: AgentFactory = (model) => createOracleAgent(model)
createArchitectAgent.mode = "subagent"

const agentSources: Partial<Record<BuiltinAgentName, AgentSource>> = {
  architect: createArchitectAgent,
  librarian: createLibrarianAgent,
  tester: createTesterAgent,
}

/**
 * Metadata for each agent, used to build Sisyphus's dynamic prompt sections
 * (Delegation Table, Tool Selection, Key Triggers, etc.)
 */
const agentMetadata: Partial<Record<BuiltinAgentName, AgentPromptMetadata>> = {
  ...Object.fromEntries(
    HUSTLER_ROLES.map((role) => [role, HUSTLER_ROLE_FACTORIES[role]("hustler/metadata").metadata.promptMetadata]),
  ),
}

function applyHustlerRoleIdentity(
  config: AgentConfig,
  role: HustlerRole,
  override: AgentOverrides[BuiltinAgentName],
  mergedCategories: Record<string, CategoryConfig>,
  gitMasterConfig: GitMasterConfig | undefined,
  browserProvider: BrowserAutomationProvider | undefined,
  disabledSkills: Set<string> | undefined,
  teamModeEnabled: boolean,
  directory?: string,
): AgentConfig {
  const roleConfig = HUSTLER_ROLE_FACTORIES[role](config.model ?? "hustler/metadata").config
  const identityConfig: AgentConfig = {
    ...config,
    description: roleConfig.description,
    mode: roleConfig.mode,
    prompt: sanitizeHustlerPrompt(config.prompt),
  }
  const overriddenConfig = applyOverrides(identityConfig, override, mergedCategories, directory)
  return resolveAgentSkills(overriddenConfig, {
    gitMasterConfig,
    browserProvider,
    disabledSkills,
    teamModeEnabled,
  })
}

export async function createBuiltinAgents(
  disabledAgents: string[] = [],
  agentOverrides: AgentOverrides = {},
  directory?: string,
  systemDefaultModel?: string,
  categories?: CategoriesConfig,
  gitMasterConfig?: GitMasterConfig,
  discoveredSkills: LoadedSkill[] = [],
  _customAgentSummaries?: unknown,
  browserProvider?: BrowserAutomationProvider,
  uiSelectedModel?: string,
  disabledSkills?: Set<string>,
  useTaskSystem = false,
  disableOmoEnv = false,
  teamModeEnabled = false,
): Promise<Record<string, AgentConfig>> {

  const normalizedDisabledAgents = disabledAgents.map((agent) => agent.toLowerCase())

  const connectedProviders = readConnectedProvidersCache()
  const providerModelsConnected = connectedProviders
    ? (readProviderModelsCache()?.connected ?? [])
    : []
  const mergedConnectedProviders = Array.from(
    new Set([...(connectedProviders ?? []), ...providerModelsConnected])
  )
  // IMPORTANT: Do NOT call OpenCode client APIs during plugin initialization.
  // This function is called from config handler, and calling client API causes deadlock.
  // See: https://github.com/code-yeongyu/oh-my-openagent/issues/1301
  const availableModels = await fetchAvailableModels(undefined, {
    connectedProviders: mergedConnectedProviders.length > 0 ? mergedConnectedProviders : undefined,
  })
  const isFirstRunNoCache =
    availableModels.size === 0 && mergedConnectedProviders.length === 0

  const result: Record<string, AgentConfig> = {}

  const mergedCategories = mergeCategories(categories)

  const availableCategories: AvailableCategory[] = Object.entries(mergedCategories).map(([name]) => ({
    name,
    description: categories?.[name]?.description ?? CATEGORY_DESCRIPTIONS[name] ?? "General tasks",
  }))

  // Collect general agents first (for availableAgents), but don't add to result yet
  const { pendingAgentConfigs, availableAgents } = collectPendingBuiltinAgents({
    agentSources,
    agentMetadata,
    disabledAgents: normalizedDisabledAgents,
    agentOverrides,
    directory,
    systemDefaultModel,
    mergedCategories,
    gitMasterConfig,
    browserProvider,
    uiSelectedModel,
    availableModels,
    isFirstRunNoCache,
    disabledSkills,
    teamModeEnabled,
    disableOmoEnv,
  })

  const sisyphusConfig = maybeCreateSisyphusConfig({
    disabledAgents: normalizedDisabledAgents,
    agentOverrides,
    uiSelectedModel,
    availableModels,
    systemDefaultModel,
    isFirstRunNoCache,
    availableAgents,
    availableSkills: buildAvailableSkills(discoveredSkills, browserProvider, disabledSkills, teamModeEnabled, "orchestrator"),
    availableCategories,
    mergedCategories,
    directory,
    userCategories: categories,
    useTaskSystem,
    disableOmoEnv,
  })
  if (sisyphusConfig) {
    result["orchestrator"] = sisyphusConfig
  }

  const hephaestusConfig = maybeCreateHephaestusConfig({
    disabledAgents: normalizedDisabledAgents,
    agentOverrides,
    availableModels,
    systemDefaultModel,
    isFirstRunNoCache,
    availableAgents,
    availableSkills: buildAvailableSkills(discoveredSkills, browserProvider, disabledSkills, teamModeEnabled, "developer"),
    availableCategories,
    mergedCategories,
    directory,
    useTaskSystem,
    disableOmoEnv,
  })
  if (hephaestusConfig) {
    result["developer"] = hephaestusConfig
  }

  for (const [name, config] of pendingAgentConfigs) {
    result[name] = config
  }

  const atlasConfig = maybeCreateAtlasConfig({
    disabledAgents: normalizedDisabledAgents,
    agentOverrides,
    uiSelectedModel,
    availableModels,
    systemDefaultModel,
    availableAgents,
    availableSkills: buildAvailableSkills(discoveredSkills, browserProvider, disabledSkills, teamModeEnabled, "approver"),
    mergedCategories,
    directory,
    userCategories: categories,
  })
  if (atlasConfig) {
    result["approver"] = atlasConfig
  }

  return Object.fromEntries(
    Object.entries(result).map(([role, config]) => {
      if (!HUSTLER_ROLES.includes(role as HustlerRole)) return [role, config]
      const roleName = role as HustlerRole
      const override = agentOverrides[roleName]
        ?? Object.entries(agentOverrides).find(([key]) => key.toLowerCase() === roleName.toLowerCase())?.[1]
      return [
        role,
        applyHustlerRoleIdentity(
          config,
          roleName,
          override,
          mergedCategories,
          gitMasterConfig,
          browserProvider,
          disabledSkills,
          teamModeEnabled,
          directory,
        ),
      ]
    }),
  )
}
