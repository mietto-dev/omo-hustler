import { tool, type PluginInput, type ToolDefinition } from "@opencode-ai/plugin"
import { ALLOWED_AGENTS, CALL_OMO_AGENT_DESCRIPTION } from "./constants"
import type { CallOmoAgentArgs, ToolContextWithMetadata } from "./types"
import type { BackgroundManager } from "../../features/background-agent"
import type { ModelFallbackControllerAccessor } from "../../hooks/model-fallback"
import type { CategoriesConfig, AgentOverrides } from "../../config/schema"
import type { FallbackEntry } from "../../shared/model-requirements"
import { log } from "../../shared/logger"
import { stripInvisibleAgentCharacters } from "../../shared/agent-display-names"
import { authorizeNamedDelegation } from "../../features/background-agent/delegation-authorizer"
import { createDelegationPolicy, DelegationPolicyError, type DelegationPolicy } from "../../features/background-agent/delegation-policy"
import { executeBackground } from "./background-executor"
import { executeSync } from "./sync-executor"
import { resolveCallableAgents } from "./agent-resolver"
import { createOrGetSession } from "./session-creator"
import { processMessages } from "./message-processor"
import { waitForCompletion } from "./completion-poller"
import { resolveCallOmoAgentModel } from "./model-resolution"

function policyErrorResult(error: unknown): string | undefined {
  if (!(error instanceof DelegationPolicyError)) return undefined
  return `Error: ${error.code}: ${error.message}`
}

function createSyncExecutorDeps(modelFallbackControllerAccessor?: ModelFallbackControllerAccessor) {
  return {
    createOrGetSession,
    waitForCompletion,
    processMessages,
    setSessionFallbackChain: (sessionID: string, fallbackChain: FallbackEntry[] | undefined) => {
      modelFallbackControllerAccessor?.setSessionFallbackChain(sessionID, fallbackChain)
    },
    clearSessionFallbackChain: (sessionID: string) => {
      modelFallbackControllerAccessor?.clearSessionFallbackChain(sessionID)
    },
  }
}

export function createCallOmoAgent(
  ctx: PluginInput,
  backgroundManager: BackgroundManager,
  disabledAgents: string[] = [],
  agentOverrides?: AgentOverrides,
  userCategories?: CategoriesConfig,
  modelFallbackControllerAccessor?: ModelFallbackControllerAccessor,
  delegationPolicy?: DelegationPolicy,
): ToolDefinition {
  const sharedDelegationPolicy = delegationPolicy ?? createDelegationPolicy()
  const agentDescriptions = ALLOWED_AGENTS.map(
    (name) => `- ${name}: Specialized agent for ${name} tasks`,
  ).join("\n");
  const description = CALL_OMO_AGENT_DESCRIPTION.replace(
    "{agents}",
    agentDescriptions,
  );

  return tool({
    description,
    args: {
      description: tool.schema
        .string()
        .describe("A short (3-5 words) description of the task"),
      prompt: tool.schema
        .string()
        .describe("The task for the agent to perform"),
      subagent_type: tool.schema
        .string()
        .describe(
          "The agent to invoke. Only librarian is allowed.",
        ),
      mode: tool.schema
        .enum(["repository", "external"])
        .describe("Librarian search mode: repository for this codebase, external for docs and OSS")
        .optional(),
      run_in_background: tool.schema
        .boolean()
        .describe(
          "REQUIRED. true: run asynchronously (use background_output to get results), false: run synchronously and wait for completion",
        ),
      session_id: tool.schema
        .string()
        .describe("Existing Task session to continue")
        .optional(),
    },
    async execute(args: CallOmoAgentArgs, toolContext) {
      const toolCtx = toolContext as ToolContextWithMetadata;
      log(
        `[call_omo_agent] Starting with agent: ${args.subagent_type}, background: ${args.run_in_background}`,
      );

      if (typeof args.subagent_type !== "string" || args.subagent_type.trim() === "") {
        return "Error: subagent_type is required."
      }

      const callableAgents = await resolveCallableAgents(ctx.client);

      const strippedAgentType = stripInvisibleAgentCharacters(args.subagent_type)
      if (
        !callableAgents.some(
          (name) => name.toLowerCase() === strippedAgentType.toLowerCase(),
        )
      ) {
        return `Error: Invalid agent type "${args.subagent_type}". Only ${callableAgents.join(", ")} are allowed.`;
      }

      const normalizedAgent = strippedAgentType.toLowerCase()
      if (args.run_in_background && args.session_id) {
        return `Error: session_id is not supported in background mode. Use run_in_background=false to continue an existing session.`
      }
      let delegationLineage
      try {
        delegationLineage = args.session_id
          ? sharedDelegationPolicy.authorizeContinuation({ callerSessionId: toolCtx.sessionID, taskId: args.session_id, sessionId: args.session_id })
          : authorizeNamedDelegation({ rootSessionId: toolCtx.sessionID, parentSessionId: toolCtx.sessionID, callerSessionId: toolCtx.sessionID, callerRole: toolCtx.agent, targetRole: normalizedAgent }, sharedDelegationPolicy)
      } catch (error) {
        return policyErrorResult(error) ?? `Error: ${error instanceof Error ? error.message : String(error)}`
      }
      const authorizedArgs = {
         ...args,
         subagent_type: normalizedAgent,
         delegationLineage,
         ...(normalizedAgent === "librarian"
         ? { prompt: `<librarian-mode>${args.mode ?? "external"}</librarian-mode>\n${args.prompt}` }
         : {}),
      }

      // Check if agent is disabled
      if (disabledAgents.some((disabled) => stripInvisibleAgentCharacters(disabled).toLowerCase() === normalizedAgent)) {
        return `Error: Agent "${normalizedAgent}" is disabled via disabled_agents configuration. Remove it from disabled_agents in your .omo/omo.jsonc to use it.`
      }

       const { model: resolvedModel, fallbackChain } = resolveCallOmoAgentModel({
        subagentType: args.subagent_type,
        agentOverrides,
        userCategories,
      })

      if (args.run_in_background) {
        return await executeBackground(authorizedArgs, toolCtx, backgroundManager, ctx.client, fallbackChain, resolvedModel, sharedDelegationPolicy)
      }

      if (!args.session_id) {
        let spawnReservation: Awaited<ReturnType<BackgroundManager["reserveSubagentSpawn"]>> | undefined
        try {
          spawnReservation = await backgroundManager.reserveSubagentSpawn(toolCtx.sessionID)
          return await executeSync(
            authorizedArgs,
            toolCtx,
            ctx,
            createSyncExecutorDeps(modelFallbackControllerAccessor),
            fallbackChain,
            spawnReservation,
            resolvedModel,
            sharedDelegationPolicy,
          )
        } catch (error) {
          spawnReservation?.rollback()
          return `Error: ${error instanceof Error ? error.message : String(error)}`
        }
      }

      return await executeSync(
        authorizedArgs,
        toolCtx,
        ctx,
        createSyncExecutorDeps(modelFallbackControllerAccessor),
        fallbackChain,
        undefined,
        resolvedModel,
        sharedDelegationPolicy,
      )
    },
  });
}
