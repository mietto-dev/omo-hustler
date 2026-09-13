import type { ALLOWED_AGENTS } from "./constants"

export type AllowedAgentType = (typeof ALLOWED_AGENTS)[number]
export type LibrarianMode = "repository" | "external"

export interface CallOmoAgentArgs {
  description: string
  prompt: string
  subagent_type: string
  mode?: LibrarianMode
  run_in_background: boolean
  session_id?: string
}

export interface CallOmoAgentSyncResult {
  title: string
  metadata: {
    summary?: Array<{
      id: string
      tool: string
      state: {
        status: string
        title?: string
      }
    }>
    sessionId: string
  }
  output: string
}
export type ToolContextWithMetadata = {
  sessionID: string
  messageID: string
  agent: string
  abort: AbortSignal
  metadata?: (input: { title?: string; metadata?: Record<string, unknown> }) => void
}
