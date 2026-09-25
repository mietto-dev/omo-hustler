import { buildAgentPromptTools, createInternalAgentTextPart } from "../../../shared"
import type { LaunchInput } from "../types"
import type { WorkflowContract } from "../../opencode-tasks/workflow-contracts"

type PromptModel = LaunchInput["model"]

type TaskPromptBodyOptions =
  | {
      readonly kind: "launch"
      readonly agent: string
      readonly model: PromptModel
      readonly system: LaunchInput["skillContent"]
      readonly prompt: string
      readonly includeTeamToolDenylist: boolean
      readonly workflowContract?: WorkflowContract
    }
  | {
      readonly kind: "resume"
      readonly agent: string
      readonly model: PromptModel
      readonly prompt: string
      readonly includeTeamToolDenylist: boolean
      readonly workflowContract?: WorkflowContract
    }

export type TaskPromptBody = {
  readonly agent: string
  readonly model?: {
    readonly providerID: string
    readonly modelID: string
  }
  readonly variant?: string
  readonly system?: string | undefined
  readonly tools: Record<string, boolean>
  readonly metadata?: {
    readonly workflowContract: WorkflowContract
  }
  readonly parts: Array<{
    readonly type: "text"
    readonly text: string
    readonly synthetic?: boolean
  }>
}

export function buildTaskPromptBody(options: TaskPromptBodyOptions): TaskPromptBody {
  const promptModel = options.model
    ? {
        providerID: options.model.providerID,
        modelID: options.model.modelID,
      }
    : undefined
  const promptVariant = options.model?.variant

  return {
    agent: options.agent,
    ...(promptModel ? { model: promptModel } : {}),
    ...(promptVariant ? { variant: promptVariant } : {}),
    ...(options.kind === "launch" ? { system: options.system } : {}),
    tools: buildAgentPromptTools(options.agent, {
      includeTeamToolDenylist: options.includeTeamToolDenylist,
    }),
    ...(options.workflowContract ? { metadata: { workflowContract: options.workflowContract } } : {}),
    parts: [createInternalAgentTextPart(options.prompt)],
  }
}
