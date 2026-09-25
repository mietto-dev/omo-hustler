import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import { isMarkdownFile } from "../../shared/file-utils"
import { getOpenCodeConfigDirs } from "../../shared/opencode-config-dir"
import { parseMarkdownAgentFile } from "./agent-definitions-loader"
import type { AgentScope, OpenCodeAgentConfig, LoadedAgent } from "./types"

function loadAgentsFromDir(agentsDir: string, scope: AgentScope): LoadedAgent[] {
  if (!existsSync(agentsDir)) return []
  const agents: LoadedAgent[] = []
  for (const entry of readdirSync(agentsDir, { withFileTypes: true })) {
    if (!isMarkdownFile(entry)) continue
    const agent = parseMarkdownAgentFile(join(agentsDir, entry.name), scope)
    if (agent) agents.push(agent)
  }
  return agents
}

function toRecord(agents: LoadedAgent[]): Record<string, OpenCodeAgentConfig> {
  const result: Record<string, OpenCodeAgentConfig> = Object.create(null)
  for (const agent of agents) result[agent.name] = agent.config
  return result
}

export function loadOpenCodeGlobalAgents(): Record<string, OpenCodeAgentConfig> {
  const result: Record<string, OpenCodeAgentConfig> = Object.create(null)
  for (const configDir of getOpenCodeConfigDirs({ binary: "opencode" })) {
    for (const agent of loadAgentsFromDir(join(configDir, "agents"), "opencode")) {
      if (!(agent.name in result)) result[agent.name] = agent.config
    }
  }
  return result
}

export function loadOpenCodeProjectAgents(directory?: string): Record<string, OpenCodeAgentConfig> {
  return toRecord(loadAgentsFromDir(join(directory ?? process.cwd(), ".opencode", "agents"), "opencode-project"))
}
