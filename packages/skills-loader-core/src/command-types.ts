export type CommandScope = "user" | "project" | "opencode" | "opencode-project"

export interface HandoffDefinition {
  label: string
  agent: string
  prompt: string
  send?: boolean
}

export interface CommandDefinition {
  name: string
  description?: string
  template: string
  agent?: string
  model?: string
  subtask?: boolean
  argumentHint?: string
  handoffs?: HandoffDefinition[]
}
