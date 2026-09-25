export type { CommandDefinition, CommandScope } from "@omo-hustler/skills-loader-core/command-types"

import type { CommandDefinition } from "@omo-hustler/skills-loader-core/command-types"

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
