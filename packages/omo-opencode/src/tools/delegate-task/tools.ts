import { tool, type ToolDefinition } from "@opencode-ai/plugin"
import type { DelegatedModelConfig, ToolContextWithMetadata, DelegateTaskToolOptions } from "./types"
import { log } from "../../shared/logger"
import { buildSystemContent } from "./prompt-builder"
import {
  resolveSkillContent,
  resolveParentContext,
  executeBackgroundContinuation,
  executeSyncContinuation,
  resolveCategoryExecution,
  resolveSubagentExecution,
  executeUnstableAgentTask,
  executeBackgroundTask,
  executeSyncTask,
} from "./executor"
import { prepareDelegateTaskArgs } from "./tool-argument-preparation"
import { createDelegateTaskPresentation } from "./tool-description"
import type { AvailableSkill } from "../../agents/dynamic-agent-prompt-builder"
import { mergeNativeSkillInfos, type NativeSkillEntry } from "../skill/native-skills"
import type { SkillInfo } from "../skill/types"
import { authorizeDelegation } from "../../features/background-agent/delegation-authorizer"
import { createDelegationPolicy, DelegationPolicyError } from "../../features/background-agent/delegation-policy"
import { getAgentConfigKey } from "../../shared/agent-display-names"
import {
  isHustlerRole,
  validateWorkflowContractForDelegation,
} from "../../features/opencode-tasks/workflow-contracts"

const LEGACY_ONLY_ROLE_KEYS = new Set([
  "plan",
  "sisyphus",
  "hephaestus",
  "prometheus",
  "atlas",
  "oracle",
  "sisyphus-junior",
  "explore",
])

const CONTRACT_REQUIRED_ROLE_KEYS = new Set([
  "planner",
  "developer",
  "tester",
  "approver",
])

function policyErrorResult(error: unknown): string | undefined {
  if (!(error instanceof DelegationPolicyError)) return undefined
  return `Error: ${error.code}: ${error.message}`
}

async function loadNativeSkillEntries(
  nativeSkills: DelegateTaskToolOptions["nativeSkills"] | undefined,
): Promise<NativeSkillEntry[]> {
  if (!nativeSkills) return []
  try {
    const list = await nativeSkills.all()
    return Array.isArray(list) ? list : []
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    log("[delegate-task] nativeSkills.all() failed; skipping native skills", { error: errorMessage })
    return []
  }
}

function buildPromptNativeSkillInfos(
  availableSkills: AvailableSkill[],
  nativeSkillEntries: NativeSkillEntry[],
  disabledSkills: ReadonlySet<string> | undefined,
): Array<{ name: string; description: string; location: string }> {
  if (nativeSkillEntries.length === 0) return []
  const availableSkillInfos: SkillInfo[] = availableSkills.map((skill) => ({
    name: skill.name,
    description: skill.description,
    location: undefined,
    scope: skill.location === "plugin" ? "builtin" : skill.location,
  }))
  const initialCount = availableSkillInfos.length
  mergeNativeSkillInfos(availableSkillInfos, nativeSkillEntries, disabledSkills)
  return availableSkillInfos.slice(initialCount).map((skill) => ({
    name: skill.name,
    description: skill.description,
    location: skill.location ?? "",
  }))
}

export { resolveCategoryConfig } from "./categories"
export type { SyncSessionCreatedEvent, DelegateTaskToolOptions, BuildSystemContentInput } from "./types"
export { buildSystemContent, buildTaskPrompt } from "./prompt-builder"

const delegateTaskArgsSchema = {
  load_skills: tool.schema
    .array(tool.schema.string())
    .optional()
    .describe("Skill names to inject. Optional; defaults to [] when omitted. Pass an explicit array (e.g. [\"git-master\"]) for skill-specific tasks."),
  description: tool.schema.string().optional().describe("Short task description (3-5 words). Auto-generated from prompt if omitted."),
  prompt: tool.schema.string().describe("Full detailed prompt for the agent"),
  run_in_background: tool.schema
    .boolean()
    .optional()
    .describe("true is the standard spawn: returns a background task ID `bg_...` at once; the completion notification delivers the result, which background_output reads. false blocks this response until the child finishes; use it only for a short child whose result gates your very next call. Omitted counts as false."),
  category: tool.schema.string().optional().describe("REQUIRED if subagent_type not provided. Do NOT provide both category and subagent_type."),
  subagent_type: tool.schema.string().optional().describe("REQUIRED if category not provided. Do NOT provide both category and subagent_type."),
  task_id: tool.schema
    .string()
    .optional()
    .describe("Continuation session id (`ses_...`) from task metadata; not a background task id (`bg_...`)."),
  command: tool.schema.string().optional().describe("The command that triggered this task"),
  workflow_contract: tool.schema.unknown().optional().describe("Validated HUSTLER workflow contract"),
}

export function createDelegateTask(options: DelegateTaskToolOptions): ToolDefinition {
  const { availableCategories, availableSkills, categoryExamples, description } = createDelegateTaskPresentation(options)
  const delegationPolicy = options.delegationPolicy ?? createDelegationPolicy()

  return tool({
    description,
    args: delegateTaskArgsSchema,
    async execute(args, toolContext) {
      const ctx = toolContext as ToolContextWithMetadata
      const delegateTaskArgs = await prepareDelegateTaskArgs(args, ctx)

      const requestedRoleKey = delegateTaskArgs.subagent_type
        ? getAgentConfigKey(delegateTaskArgs.subagent_type)
        : undefined
      if (delegateTaskArgs.category === undefined && requestedRoleKey && LEGACY_ONLY_ROLE_KEYS.has(requestedRoleKey)) {
        return `Invalid arguments: legacy-only role "${delegateTaskArgs.subagent_type}" is not an active HUSTLER role.`
      }

      const runInBackground = delegateTaskArgs.run_in_background === true

      const { content: skillContent, contents: skillContents, error: skillError } = await resolveSkillContent(delegateTaskArgs.load_skills, {
        gitMasterConfig: options.gitMasterConfig,
        browserProvider: options.browserProvider,
        disabledSkills: options.disabledSkills,
        teamModeEnabled: options.teamModeEnabled,
        directory: options.directory,
        targetAgent: delegateTaskArgs.subagent_type,
        nativeSkills: options.nativeSkills,
        getLoadedSkills: options.getLoadedSkills,
      })
      if (skillError) {
        return skillError
      }
      const nativeSkillEntries = await loadNativeSkillEntries(options.nativeSkills)
      const nativeSkillInfos = buildPromptNativeSkillInfos(
        availableSkills,
        nativeSkillEntries,
        options.disabledSkills,
      )

      const continuationSystemContent = buildSystemContent({
        skillContent,
        skillContents,
        availableCategories,
        availableSkills,
        nativeSkillInfos,
      })

      const parentContext = await resolveParentContext(ctx, options.client)

      if (delegateTaskArgs.task_id) {
        try {
          const lineage = delegationPolicy.authorizeContinuation({
            callerSessionId: ctx.sessionID,
            taskId: delegateTaskArgs.task_id,
            sessionId: delegateTaskArgs.task_id,
          })
          const continuationArgs = lineage.childSessionId && lineage.childSessionId !== delegateTaskArgs.task_id
            ? { ...delegateTaskArgs, task_id: lineage.childSessionId }
            : delegateTaskArgs
          if (runInBackground) {
            return executeBackgroundContinuation(continuationArgs, ctx, options, parentContext, continuationSystemContent)
          }
          return executeSyncContinuation(continuationArgs, ctx, options, parentContext, undefined, continuationSystemContent)
        } catch (error) {
          return policyErrorResult(error) ?? `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      }

      if (!delegateTaskArgs.category && !delegateTaskArgs.subagent_type) {
        return `Invalid arguments: Must provide either category or subagent_type.`
      }

      let systemDefaultModel: string | undefined
      try {
        const openCodeConfig = await options.client.config.get()
        systemDefaultModel = (openCodeConfig as { data?: { model?: string } })?.data?.model
      } catch (error) {
        if (!(error instanceof Error)) throw error
        systemDefaultModel = undefined
      }

      const inheritedModel = parentContext.model
        ? `${parentContext.model.providerID}/${parentContext.model.modelID}`
        : undefined

      const currentModelConfig = options.loadCurrentModelConfig?.()
      const modelOptions = currentModelConfig === undefined
        ? options
        : { ...options, userCategories: currentModelConfig.categories, agentOverrides: currentModelConfig.agents }

      let agentToUse: string
      let categoryModel: DelegatedModelConfig | undefined
      let categoryPromptAppend: string | undefined
      let modelInfo: import("../../features/task-toast-manager/types").ModelFallbackInfo | undefined
      let actualModel: string | undefined
      let isUnstableAgent = false
      let fallbackChain: import("../../shared/model-requirements").FallbackEntry[] | undefined
      let maxPromptTokens: number | undefined

      if (delegateTaskArgs.category) {
        const resolution = await resolveCategoryExecution(delegateTaskArgs, modelOptions, inheritedModel, systemDefaultModel)
        if (resolution.error) {
          return resolution.error
        }
        agentToUse = resolution.agentToUse
        categoryModel = resolution.categoryModel
        categoryPromptAppend = resolution.categoryPromptAppend
        modelInfo = resolution.modelInfo
        actualModel = resolution.actualModel
        isUnstableAgent = resolution.isUnstableAgent
        fallbackChain = resolution.fallbackChain
        maxPromptTokens = resolution.maxPromptTokens

        const isRunInBackgroundExplicitlyFalse = isExplicitSyncRun(delegateTaskArgs.run_in_background)

        log("[task] unstable agent detection", {
          category: delegateTaskArgs.category,
          actualModel,
          isUnstableAgent,
          run_in_background_value: delegateTaskArgs.run_in_background,
          run_in_background_type: typeof delegateTaskArgs.run_in_background,
          isRunInBackgroundExplicitlyFalse,
          willForceBackground: isUnstableAgent && isRunInBackgroundExplicitlyFalse,
        })

      } else {
        const resolution = await resolveSubagentExecution(
          delegateTaskArgs,
          modelOptions,
          parentContext.agent,
          categoryExamples,
          { allowPrimaryAgentDelegation: delegateTaskArgs.workflow_contract !== undefined },
        )
        if (resolution.error) {
          return resolution.error
        }
        agentToUse = resolution.agentToUse
        categoryModel = resolution.categoryModel
        fallbackChain = resolution.fallbackChain
      }

      const targetRole = getAgentConfigKey(agentToUse)
      if (delegateTaskArgs.workflow_contract !== undefined && !isHustlerRole(targetRole)) {
        return `Invalid workflow contract: target role "${targetRole}" is not a canonical HUSTLER role.`
      }
      if (delegateTaskArgs.workflow_contract !== undefined) {
        try {
          delegateTaskArgs.workflow_contract = validateWorkflowContractForDelegation(delegateTaskArgs.workflow_contract, targetRole)
        } catch (error) {
          return `Invalid workflow contract: ${error instanceof Error ? error.message : String(error)}`
        }
      } else if (CONTRACT_REQUIRED_ROLE_KEYS.has(targetRole) && !delegateTaskArgs.category) {
        return `Invalid arguments: HUSTLER role "${targetRole}" requires a workflow contract.`
      }

      let delegationLineage
      try {
        delegationLineage = authorizeDelegation({ rootSessionId: parentContext.sessionID, parentSessionId: parentContext.sessionID, callerSessionId: ctx.sessionID, callerRole: parentContext.agent, targetRole: agentToUse, category: delegateTaskArgs.category }, delegationPolicy)
      } catch (error) {
        return policyErrorResult(error) ?? `Error: ${error instanceof Error ? error.message : String(error)}`
      }
      const authorizedDelegateTaskArgs = { ...delegateTaskArgs, delegationLineage }

      if (isUnstableAgent && isExplicitSyncRun(delegateTaskArgs.run_in_background)) {
        const systemContent = buildSystemContent({
          skillContent,
          skillContents,
          categoryPromptAppend,
          agentName: agentToUse,
          maxPromptTokens,
          model: categoryModel,
          availableCategories,
          availableSkills,
          nativeSkillInfos,
        })
        return executeUnstableAgentTask(authorizedDelegateTaskArgs, ctx, options, parentContext, agentToUse, categoryModel, systemContent, actualModel)
      }

      const systemContent = buildSystemContent({
        skillContent,
        skillContents,
        categoryPromptAppend,
        agentName: agentToUse,
        maxPromptTokens,
        model: categoryModel,
        availableCategories,
        availableSkills,
        nativeSkillInfos,
      })

      if (runInBackground) {
        return executeBackgroundTask(authorizedDelegateTaskArgs, ctx, options, parentContext, agentToUse, categoryModel, systemContent, fallbackChain)
      }

      return executeSyncTask(authorizedDelegateTaskArgs, ctx, options, parentContext, agentToUse, categoryModel, systemContent, modelInfo, fallbackChain)
    },
  })
}

function isExplicitSyncRun(runInBackground: unknown): boolean {
  return runInBackground === false || runInBackground === "false"
}
