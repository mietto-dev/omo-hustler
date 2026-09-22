import type { AgentConfig } from "@opencode-ai/sdk";
import { createSisyphusJuniorAgentWithOverrides } from "../agents/sisyphus-junior";
import type { OhMyOpenCodeConfig } from "../config";
import {
  getAgentConfigKey,
  getAgentDisplayName,
  normalizeAgentForPromptKey,
} from "../shared/agent-display-names";
import { migrateAgentConfig } from "../shared/permission-compat";
import {
  createProtectedAgentNameSet,
  filterProtectedAgentOverrides,
} from "./agent-override-protection";
import type { AgentSourceMap, AgentSources } from "./agent-config-types";
import { buildPlanDemoteConfig } from "./plan-model-inheritance";
import { buildPrometheusAgentConfig } from "./prometheus-agent-config-builder";
import { applyOverrides } from "../agents/builtin-agents/agent-overrides";
import { HUSTLER_ROLE_FACTORIES, sanitizeHustlerPrompt } from "../features/hustler/roles";
import { mergeCategories } from "../shared/merge-categories";

type BuiltinAgentMap = Record<string, AgentConfig | undefined>;

type AssembleAgentConfigParams = {
  config: Record<string, unknown>;
  pluginConfig: OhMyOpenCodeConfig;
  builtinAgents: BuiltinAgentMap;
  sources: AgentSources;
  currentModel: string | undefined;
  useTaskSystem: boolean;
  disabledAgentNames: ReadonlySet<string>;
};

type AssemblyResult = {
  configuredDefaultAgent: string | undefined;
};

export function getConfiguredDefaultAgent(config: Record<string, unknown>): string | undefined {
  const defaultAgent = config.default_agent;
  if (typeof defaultAgent !== "string") return undefined;
  const trimmedDefaultAgent = defaultAgent.trim();
  return trimmedDefaultAgent.length > 0 ? trimmedDefaultAgent : undefined;
}

function filterDisabledAgents(
  agents: Record<string, unknown>,
  disabledAgentNames: ReadonlySet<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(agents).filter(([name]) => !disabledAgentNames.has(name.toLowerCase())),
  );
}

function defaultSubagentMode(agents: AgentSourceMap): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(agents).map(([key, value]) => {
      if (!value) return [key, value];
      const migrated = migrateAgentConfig(value);
      if (!migrated.mode) migrated.mode = "subagent";
      return [key, migrated];
    }),
  );
}

function filterCustomAgentSources(
  sources: AgentSources,
  protectedBuiltinAgentNames: ReadonlySet<string>,
): Omit<AgentSources, "configAgent" | "customAgentSummaries"> {
  return {
    userAgents: filterProtectedAgentOverrides(sources.userAgents, protectedBuiltinAgentNames),
    projectAgents: filterProtectedAgentOverrides(sources.projectAgents, protectedBuiltinAgentNames),
    opencodeGlobalAgents: filterProtectedAgentOverrides(
      sources.opencodeGlobalAgents,
      protectedBuiltinAgentNames,
    ),
    opencodeProjectAgents: filterProtectedAgentOverrides(
      sources.opencodeProjectAgents,
      protectedBuiltinAgentNames,
    ),
    pluginAgents: filterProtectedAgentOverrides(sources.pluginAgents, protectedBuiltinAgentNames),
    agentDefinitionAgents: filterProtectedAgentOverrides(
      sources.agentDefinitionAgents,
      protectedBuiltinAgentNames,
    ),
    opencodeConfigAgents: filterProtectedAgentOverrides(
      sources.opencodeConfigAgents,
      protectedBuiltinAgentNames,
    ),
  };
}

function orderedCustomAgentSources(
  sources: Omit<AgentSources, "configAgent" | "customAgentSummaries">,
  disabledAgentNames: ReadonlySet<string>,
): Record<string, unknown> {
  return {
    ...filterDisabledAgents(sources.pluginAgents, disabledAgentNames),
    ...filterDisabledAgents(sources.userAgents, disabledAgentNames),
    ...filterDisabledAgents(sources.opencodeGlobalAgents, disabledAgentNames),
    ...filterDisabledAgents(sources.projectAgents, disabledAgentNames),
    ...filterDisabledAgents(sources.opencodeProjectAgents, disabledAgentNames),
    ...filterDisabledAgents(sources.agentDefinitionAgents, disabledAgentNames),
    ...filterDisabledAgents(sources.opencodeConfigAgents, disabledAgentNames),
  };
}

async function createCoreAgentConfig(
  params: AssembleAgentConfigParams,
): Promise<Record<string, unknown>> {
  const { builtinAgents, pluginConfig, sources, currentModel, useTaskSystem, disabledAgentNames } = params;
  const mergedCategories = mergeCategories(pluginConfig.categories);
  const agentConfig: Record<string, unknown> = {};

  if (!disabledAgentNames.has("orchestrator") && builtinAgents.orchestrator) {
    agentConfig.orchestrator = builtinAgents.orchestrator;
  }

  if (!disabledAgentNames.has("developer") && builtinAgents.developer) {
    agentConfig.developer = builtinAgents.developer;
  }

  if ((pluginConfig.sisyphus_agent?.planner_enabled ?? true) && !disabledAgentNames.has("planner")) {
    const plannerConfig = await buildPrometheusAgentConfig({
      configAgentPlan: sources.configAgent?.plan,
      pluginPrometheusOverride: pluginConfig.agents?.planner as
        | (Record<string, unknown> & { prompt_append?: string })
        | undefined,
      userCategories: pluginConfig.categories,
      currentModel,
      disabledTools: pluginConfig.disabled_tools,
    });
    const plannerIdentity = HUSTLER_ROLE_FACTORIES.planner(currentModel ?? "hustler/metadata").config;
    const plannerIdentityConfig = {
      ...plannerConfig,
      description: plannerIdentity.description,
      mode: plannerIdentity.mode,
      prompt: sanitizeHustlerPrompt(
        typeof plannerConfig.prompt === "string" ? plannerConfig.prompt : undefined,
      ),
    };
    agentConfig.planner = applyOverrides(
      plannerIdentityConfig,
      pluginConfig.agents?.planner,
      mergedCategories,
      undefined,
    );
  }

  if (!disabledAgentNames.has("approver") && builtinAgents.approver) {
    agentConfig.approver = builtinAgents.approver;
  }

  return agentConfig;
}

function applyDefaultAgent(
  config: Record<string, unknown>,
  configuredDefaultAgent: string | undefined,
  pluginConfig?: OhMyOpenCodeConfig,
): void {
  if (configuredDefaultAgent) {
    const configKey = getAgentConfigKey(configuredDefaultAgent);
    const runtimeConfigKey = normalizeAgentForPromptKey(configuredDefaultAgent) ?? configKey;
    config.default_agent = getAgentDisplayName(runtimeConfigKey, pluginConfig?.agents);
    return;
  }

  config.default_agent = getAgentDisplayName("orchestrator", pluginConfig?.agents);
}

async function assembleSisyphusEnabledConfig(params: AssembleAgentConfigParams): Promise<void> {
  const configuredDefaultAgent = getConfiguredDefaultAgent(params.config);
  applyDefaultAgent(params.config, configuredDefaultAgent, params.pluginConfig);

  const agentConfig = await createCoreAgentConfig(params);
  const { configAgent } = params.sources;
  const plannerEnabled = params.pluginConfig.sisyphus_agent?.planner_enabled ?? true;
  const replacePlan = params.pluginConfig.sisyphus_agent?.replace_plan ?? true;
  const shouldDemotePlan = plannerEnabled && replacePlan;

  if (params.pluginConfig.sisyphus_agent?.default_builder_enabled ?? false) {
    const { name: _buildName, ...buildConfigWithoutName } = configAgent?.build ?? {};
    const migratedBuildConfig = migrateAgentConfig(buildConfigWithoutName);
    const override = params.pluginConfig.agents?.["OpenCode-Builder"];
    const base = {
      ...migratedBuildConfig,
      description: `${(configAgent?.build?.description as string) ?? "Build agent"} (OpenCode default)`,
    };
    agentConfig["OpenCode-Builder"] = override ? { ...base, ...override } : base;
  }

  const migratedBuild = configAgent?.build ? migrateAgentConfig(configAgent.build) : {};
  const planDemoteConfig = shouldDemotePlan
    ? buildPlanDemoteConfig(
        agentConfig.planner as Record<string, unknown> | undefined,
        params.pluginConfig.agents?.plan as Record<string, unknown> | undefined,
      )
    : undefined;
  const protectedBuiltinAgentNames = createProtectedAgentNameSet([
    ...Object.keys(agentConfig),
    ...Object.keys(params.builtinAgents),
  ]);
  const filteredSources = filterCustomAgentSources(params.sources, protectedBuiltinAgentNames);
  const filteredConfigAgents = configAgent
    ? defaultSubagentMode(
        filterProtectedAgentOverrides(
          Object.fromEntries(
            Object.entries(configAgent).filter(([key]) => {
              if (key === "build") return false;
              if (key === "plan" && shouldDemotePlan) return false;
              return true;
            }),
          ),
          protectedBuiltinAgentNames,
        ),
      )
    : {};

  const activeBuiltinAgents = Object.fromEntries(
    Object.entries(params.builtinAgents).filter(([key]) => !params.disabledAgentNames.has(key.toLowerCase())),
  );

  params.config.agent = {
    ...agentConfig,
    ...Object.fromEntries(
      Object.entries(activeBuiltinAgents).filter(
        ([key]) => !["orchestrator", "developer", "approver", "planner"].includes(key),
      ),
    ),
    ...orderedCustomAgentSources(filteredSources, params.disabledAgentNames),
    ...filteredConfigAgents,
    build: { ...migratedBuild, mode: "subagent", hidden: true },
    ...(planDemoteConfig ? { plan: planDemoteConfig } : {}),
  };
}

function assembleSisyphusDisabledConfig(params: AssembleAgentConfigParams): void {
  const protectedBuiltinAgentNames = createProtectedAgentNameSet(Object.keys(params.builtinAgents));
  const filteredSources = filterCustomAgentSources(params.sources, protectedBuiltinAgentNames);
  const filteredConfigAgents = params.sources.configAgent
    ? defaultSubagentMode(
        filterProtectedAgentOverrides(params.sources.configAgent, protectedBuiltinAgentNames),
      )
    : {};

  const activeBuiltinAgents = Object.fromEntries(
    Object.entries(params.builtinAgents).filter(([key]) => !params.disabledAgentNames.has(key.toLowerCase())),
  );

  params.config.agent = {
    ...activeBuiltinAgents,
    ...orderedCustomAgentSources(filteredSources, params.disabledAgentNames),
    ...filteredConfigAgents,
  };
}

export async function assembleAgentConfig(params: AssembleAgentConfigParams): Promise<AssemblyResult> {
  const configuredDefaultAgent = getConfiguredDefaultAgent(params.config);
  const isSisyphusEnabled = params.pluginConfig.sisyphus_agent?.disabled !== true;

  if (isSisyphusEnabled && params.builtinAgents.orchestrator) {
    await assembleSisyphusEnabledConfig(params);
  } else {
    assembleSisyphusDisabledConfig(params);
  }

  return { configuredDefaultAgent };
}
