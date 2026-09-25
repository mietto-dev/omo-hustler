import type { CommandDefinition } from "@omo-hustler/skills-loader-core/command-types"

export type BuiltinCommandName = "goal" | "refactor" | "ulw-execute" | "stop-continuation" | "handoff" | "remove-ai-slops" | "hyperplan"

export interface BuiltinCommandConfig {
  disabled_commands?: BuiltinCommandName[]
}

export type BuiltinCommands = Record<string, CommandDefinition>
