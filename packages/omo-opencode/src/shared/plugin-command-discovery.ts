import type { CommandDefinition } from "@omo-hustler/skills-loader-core/command-types"

export interface PluginCommandDiscoveryOptions {
  pluginsEnabled?: boolean
  enabledPluginsOverride?: Record<string, boolean>
}

export function discoverPluginCommandDefinitions(
  options?: PluginCommandDiscoveryOptions,
): Record<string, CommandDefinition> {
  void options
  return {}
}
