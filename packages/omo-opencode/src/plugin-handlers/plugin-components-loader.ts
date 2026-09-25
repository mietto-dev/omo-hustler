import type { OhMyOpenCodeConfig } from "../config";

export type PluginComponents = {
  commands: Record<string, unknown>;
  skills: Record<string, unknown>;
  agents: Record<string, unknown>;
  mcpServers: Record<string, unknown>;
  plugins: Array<{ name: string; version: string }>;
  errors: Array<{ pluginKey: string; installPath: string; error: string }>;
  retryableLoadFailure?: true;
};

const EMPTY_PLUGIN_COMPONENTS: PluginComponents = {
  commands: {},
  skills: {},
  agents: {},
  mcpServers: {},
  plugins: [],
  errors: [],
};

export async function loadPluginComponents(params: {
  pluginConfig: OhMyOpenCodeConfig;
}): Promise<PluginComponents> {
  void params;
  return EMPTY_PLUGIN_COMPONENTS;
}
