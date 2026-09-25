export type { CommandDefinition, CommandScope } from "@oh-my-opencode/skills-loader-core/command-types"

import type { CommandDefinition } from "@oh-my-opencode/skills-loader-core/command-types"

export interface CommandFrontmatter {
  description?: string
  agent?: string
  model?: string
  subtask?: boolean
  "argument-hint"?: string
  handoffs?: CommandDefinition["handoffs"]
}

export interface LoadedCommand {
  name: string
  path: string
  definition: CommandDefinition
  scope: "opencode" | "opencode-project"
}
