import type { OhMyOpenCodeConfig } from "../config";
import { getAgentDisplayName, getAgentListDisplayName } from "../shared/agent-display-names";
import { isTaskSystemEnabled } from "../shared";
import { projectAgentPermissions } from "../shared/agent-tool-restrictions";
import type { PermissionValue } from "../shared/permission-compat";

type AgentWithPermission = { permission?: Record<string, unknown> };

function getConfigQuestionPermission(): string | null {
  const configContent = process.env.OPENCODE_CONFIG_CONTENT;
  if (!configContent) return null;
  try {
    const parsed = JSON.parse(configContent);
    return parsed?.permission?.question ?? null;
  } catch (error) {
    if (error instanceof Error) return null;
    return null;
  }
}

function agentByKey(
  agentResult: Record<string, unknown>,
  key: string,
  pluginConfig?: OhMyOpenCodeConfig,
): AgentWithPermission | undefined {
  return (agentResult[getAgentListDisplayName(key, pluginConfig?.agents)] ?? agentResult[getAgentDisplayName(key, pluginConfig?.agents)] ?? agentResult[key]) as
    | AgentWithPermission
    | undefined;
}

export function applyToolConfig(params: {
  config: Record<string, unknown>;
  pluginConfig: OhMyOpenCodeConfig;
  agentResult: Record<string, unknown>;
}): void {
  const taskSystemEnabled = isTaskSystemEnabled(params.pluginConfig)
  const denyTodoTools = taskSystemEnabled
    ? { todowrite: "deny", todoread: "deny" }
    : {}

  const existingPermission = params.config.permission as Record<string, unknown> | undefined;
  const skillDeniedByHost = existingPermission?.skill === "deny";

  params.config.tools = {
    ...(params.config.tools as Record<string, unknown>),
    "grep_app_*": false,
    LspHover: false,
    LspCodeActions: false,
    LspCodeActionResolve: false,
    "task_*": false,
    teammate: false,
    ...(taskSystemEnabled
      ? { todowrite: false, todoread: false }
      : {}),
    ...(skillDeniedByHost
      ? { skill: false, skill_mcp: false }
      : {}),
  };

  const isCliRunMode = process.env.OPENCODE_CLI_RUN_MODE === "true";
  const configQuestionPermission = getConfigQuestionPermission();
  const isQuestionDisabledByPlugin = params.pluginConfig.disabled_tools?.includes("question") ?? false;
  const questionPermission =
    isQuestionDisabledByPlugin ? "deny" :
    configQuestionPermission === "deny" ? "deny" :
    isCliRunMode ? "deny" :
    "allow";

  const roleNames = ["orchestrator", "planner", "developer", "tester", "approver", "librarian", "architect"] as const;
  for (const roleName of roleNames) {
    const agent = agentByKey(params.agentResult, roleName, params.pluginConfig);
    if (!agent) continue;
    const existingPermission: Record<string, PermissionValue> = {};
    for (const [tool, value] of Object.entries(agent.permission ?? {})) {
      if (value === "ask" || value === "allow" || value === "deny") {
        existingPermission[tool] = value;
      }
    }
    const permission = projectAgentPermissions(roleName, existingPermission);
    if (roleName === "orchestrator" || roleName === "developer" || roleName === "planner") {
      permission.question = questionPermission;
    }
    for (const [tool, value] of Object.entries(denyTodoTools)) {
      permission[tool] = value === "deny" ? "deny" : "allow";
    }
    agent.permission = permission;
  }

  params.config.permission = {
    webfetch: "allow",
    external_directory: "allow",
    ...(params.config.permission as Record<string, unknown>),
    task: "deny",
  };
}
