import type { CategoriesConfig, AgentOverrides } from "../../config/schema"
import type { DelegatedModelConfig } from "../../shared/model-resolution-types"
import type { FallbackEntry } from "../../shared/model-requirements"
import { AGENT_MODEL_REQUIREMENTS } from "../../shared/model-requirements"
import { getAgentConfigKey } from "../../shared/agent-display-names"
import { normalizeFallbackModels } from "../../shared/model-resolver"
import { buildFallbackChainFromModels } from "../../shared/fallback-chain-from-models"
import { log, parseModelString } from "../../shared"
import { getFirstFallbackModel } from "../../agents/builtin-agents/model-resolution"

export function resolveCallOmoAgentModel(args: {
  subagentType: string
  agentOverrides?: AgentOverrides
  userCategories?: CategoriesConfig
}): { model: DelegatedModelConfig | undefined; fallbackChain: FallbackEntry[] | undefined } {
  const { subagentType, agentOverrides, userCategories } = args
  const normalizedAgentConfigKey = getAgentConfigKey(subagentType)
  const agentRequirement = AGENT_MODEL_REQUIREMENTS[normalizedAgentConfigKey]
  const agentOverride = agentOverrides?.[normalizedAgentConfigKey as keyof AgentOverrides]
    ?? (agentOverrides ? Object.entries(agentOverrides).find(([key]) => key.toLowerCase() === normalizedAgentConfigKey)?.[1] : undefined)
  const agentCategoryModel = agentOverride?.category ? userCategories?.[agentOverride.category]?.model : undefined
  const agentCategoryVariant = agentOverride?.category ? userCategories?.[agentOverride.category]?.variant : undefined
  const firstFallback = getFirstFallbackModel(agentRequirement)

  let model: DelegatedModelConfig | undefined
  const selectedModel = agentOverride?.model ?? agentCategoryModel ?? firstFallback?.model
  const parsedModel = selectedModel ? parseModelString(selectedModel) : undefined
  if (parsedModel) {
    const variant = agentOverride?.variant ?? parsedModel.variant ?? (agentOverride?.model ? undefined : agentOverride?.category ? agentCategoryVariant : firstFallback?.variant)
    model = variant ? { ...parsedModel, variant } : parsedModel
    log("[call_omo_agent] Resolved model", { agent: subagentType, model: selectedModel, variant })
  }

  const fallbackModels = normalizeFallbackModels(
    agentOverride?.fallback_models
      ?? (agentOverride?.category ? userCategories?.[agentOverride.category]?.fallback_models : undefined),
  )
  const defaultProviderID = model?.providerID ?? agentRequirement?.fallbackChain?.[0]?.providers?.[0] ?? "opencode"
  return { model, fallbackChain: buildFallbackChainFromModels(fallbackModels, defaultProviderID) ?? agentRequirement?.fallbackChain }
}
