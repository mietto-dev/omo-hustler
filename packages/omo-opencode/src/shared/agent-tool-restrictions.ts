import { stripInvisibleAgentCharacters } from "./agent-display-names"
import type { PermissionValue } from "./permission-compat"

/**
 * Agent tool restrictions for session.prompt calls.
 * OpenCode SDK's session.prompt `tools` parameter expects boolean values.
 * true = tool allowed, false = tool denied.
 */

const TEAM_TOOL_DENYLIST: Record<string, boolean> = {
  team_create: false,
  team_delete: false,
  team_shutdown_request: false,
  team_approve_shutdown: false,
  team_reject_shutdown: false,
  team_send_message: false,
  team_task_create: false,
  team_task_list: false,
  team_task_update: false,
  team_task_get: false,
  team_status: false,
  team_list: false,
}

const READ_ONLY_DENYLIST: Record<string, boolean> = {
  write: false,
  edit: false,
  apply_patch: false,
}

const AGENT_RESTRICTIONS: Record<string, Record<string, boolean>> = {
  librarian: {
    ...READ_ONLY_DENYLIST,
    task: false,
    call_omo_agent: false,
    teammate: false,
  },

  architect: {
    ...READ_ONLY_DENYLIST,
    task: false,
    teammate: false,
  },

  planner: {
    ...READ_ONLY_DENYLIST,
    bash: false,
    interactive_bash: false,
    teammate: false,
  },

  tester: {
    ...READ_ONLY_DENYLIST,
    task: false,
    call_omo_agent: false,
    teammate: false,
  },

  approver: {
    ...READ_ONLY_DENYLIST,
    task: false,
    call_omo_agent: false,
    teammate: false,
  },

  developer: {
    call_omo_agent: false,
  },

  orchestrator: {},

  "sisyphus-junior": {
    task: false,
  },
}

const AGENT_DEFAULT_PERMISSIONS: Record<string, Record<string, PermissionValue>> = {
  orchestrator: { task: "allow", "task_*": "allow", teammate: "allow", call_omo_agent: "allow" },
  planner: { task: "allow", "task_*": "allow", teammate: "allow", call_omo_agent: "deny" },
  developer: { "task_*": "allow", teammate: "allow", call_omo_agent: "deny" },
  tester: { "task_*": "allow", teammate: "allow" },
  approver: { task: "allow", "task_*": "allow", teammate: "allow", call_omo_agent: "deny" },
  librarian: { "grep_app_*": "allow" },
  architect: { call_omo_agent: "allow" },
}

type AgentToolRestrictionsOptions = {
  includeTeamToolDenylist?: boolean
}

export function getAgentToolRestrictions(agentName: string, options: AgentToolRestrictionsOptions = {}): Record<string, boolean> {
  const stripped = stripInvisibleAgentCharacters(agentName)
  const agentRestrictions = AGENT_RESTRICTIONS[stripped]
    ?? Object.entries(AGENT_RESTRICTIONS).find(([key]) => key.toLowerCase() === stripped.toLowerCase())?.[1]
    ?? {}

  return {
    ...(options.includeTeamToolDenylist === false ? {} : TEAM_TOOL_DENYLIST),
    ...agentRestrictions,
  }
}

export function projectAgentPermissions(
  agentName: string,
  userPermission: Record<string, PermissionValue> = {},
): Record<string, PermissionValue> {
  const stripped = stripInvisibleAgentCharacters(agentName).toLowerCase()
  const defaults = AGENT_DEFAULT_PERMISSIONS[stripped] ?? {}
  const hardDenials = getAgentToolRestrictions(agentName, { includeTeamToolDenylist: false })
  const projected: Record<string, PermissionValue> = { ...defaults, ...userPermission }

  for (const [tool, denied] of Object.entries(hardDenials)) {
    if (denied === false) projected[tool] = "deny"
  }

  return projected
}

export function buildAgentPromptTools(
  agentName: string,
  options: {
    readonly includeTeamToolDenylist?: boolean
    readonly taskAllowed?: boolean
    readonly userPermission?: Record<string, PermissionValue>
  } = {},
): Record<string, boolean> {
  const projected = projectAgentPermissions(agentName, options.userPermission)
  const tools: Record<string, boolean> = {
    task: options.taskAllowed ?? false,
    call_omo_agent: true,
    question: false,
  }
  for (const [tool, value] of Object.entries(projected)) {
    tools[tool] = value !== "deny"
  }
  if (options.includeTeamToolDenylist !== false) {
    for (const [tool, value] of Object.entries(TEAM_TOOL_DENYLIST)) {
      tools[tool] = value
    }
  }
  return tools
}

export function canAgentCallOmoAgent(caller: string, target: string): boolean {
  const normalizedCaller = stripInvisibleAgentCharacters(caller).toLowerCase()
  const normalizedTarget = stripInvisibleAgentCharacters(target).toLowerCase()
  if (normalizedCaller === "architect") return normalizedTarget === "librarian"
  return projectAgentPermissions(caller).call_omo_agent !== "deny"
}
