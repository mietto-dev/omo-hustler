import { normalizeAgentForPromptKey } from "./agent-display-names"
import { DEFAULT_AGENT_ORDER } from "./agent-ordering"

export const CANONICAL_CORE_AGENT_ORDER = DEFAULT_AGENT_ORDER

const CANONICAL_AGENT_KEYS = new Set<string>(CANONICAL_CORE_AGENT_ORDER)

export function normalizeRuntimeAgentName(agentName: string): string | undefined {
  const configKey = normalizeAgentForPromptKey(agentName)
  return configKey !== undefined && CANONICAL_AGENT_KEYS.has(configKey) ? configKey : undefined
}

export function createRuntimeAgentRank(
  agentOrder: readonly string[] | undefined,
): ReadonlyMap<string, number> {
  const configuredOrder = agentOrder
    ?.map(normalizeRuntimeAgentName)
    .filter((configKey): configKey is string => configKey !== undefined)
  const orderedKeys = [...new Set(configuredOrder ?? []), ...CANONICAL_CORE_AGENT_ORDER].filter(
    (configKey, index, keys) => keys.indexOf(configKey) === index,
  )

  return new Map(orderedKeys.map((configKey, index): [string, number] => [configKey, index + 1]))
}

export function compareAgentNames(
  leftName: string,
  rightName: string,
  agentOrder?: readonly string[],
): number {
  const rank = createRuntimeAgentRank(agentOrder)
  const leftRank = rank.get(normalizeRuntimeAgentName(leftName) ?? "")
  const rightRank = rank.get(normalizeRuntimeAgentName(rightName) ?? "")

  if (leftRank !== undefined || rightRank !== undefined) {
    return (leftRank ?? Number.MAX_SAFE_INTEGER) - (rightRank ?? Number.MAX_SAFE_INTEGER)
  }

  if (leftName < rightName) return -1
  if (leftName > rightName) return 1
  return 0
}
