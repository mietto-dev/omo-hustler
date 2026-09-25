import * as fs from "node:fs"
import * as path from "node:path"
import { getOpenCodeConfigDirs } from "../../shared/opencode-config-dir"
import { parseJsoncSafe } from "../../shared/jsonc-parser"
import { parseToolsConfig } from "../../shared/parse-tools-config"
import { resolveAgentDefinitionPaths } from "../../shared/resolve-agent-definition-paths"
import { loadAgentDefinitions } from "./agent-definitions-loader"
import type { OpenCodeAgentConfig } from "./types"

interface OpenCodeConfigWithAgents {
  agents?: Record<string, unknown>
  agent?: Record<string, unknown>
  agent_definitions?: string | string[]
}

function configPaths(directory: string): string[] {
  return [
    path.join(directory, ".opencode", "opencode.json"),
    path.join(directory, ".opencode", "opencode.jsonc"),
    ...getOpenCodeConfigDirs({ binary: "opencode" }).flatMap((dir) => [
      path.join(dir, "opencode.json"), path.join(dir, "opencode.jsonc"),
    ]),
  ]
}

function convertInlineAgent(agentData: unknown): OpenCodeAgentConfig | null {
  if (!agentData || typeof agentData !== "object") return null
  const agent = agentData as Record<string, unknown>
  const mode = agent.mode === "primary" || agent.mode === "all" || agent.mode === "subagent"
    ? agent.mode : "subagent"
  const config: OpenCodeAgentConfig = {
    description: `(opencode-config) ${agent.description ? String(agent.description) : ""}`,
    mode,
    prompt: agent.prompt ? String(agent.prompt) : "",
    ...(agent.model ? { model: String(agent.model) } : {}),
  }
  const tools = parseToolsConfig(agent.tools)
  if (tools) config.tools = tools
  return config
}

export function readOpenCodeConfigAgents(directory: string): Record<string, OpenCodeAgentConfig> {
  const result: Record<string, OpenCodeAgentConfig> = Object.create(null)
  for (const configPath of configPaths(directory)) {
    if (!fs.existsSync(configPath)) continue
    try {
      const parsed = parseJsoncSafe<OpenCodeConfigWithAgents>(fs.readFileSync(configPath, "utf8"))
      if (!parsed.data) continue
      const data = parsed.data
      const agents = data.agents ?? data.agent
      if (agents && typeof agents === "object") {
        for (const [name, value] of Object.entries(agents)) {
          if (!Object.hasOwn(result, name)) {
            const converted = convertInlineAgent(value)
            if (converted) result[name] = converted
          }
        }
      }
      if (data.agent_definitions) {
        const definitions = typeof data.agent_definitions === "string"
          ? [data.agent_definitions] : data.agent_definitions
        const resolved = resolveAgentDefinitionPaths(definitions, path.dirname(configPath), directory)
        for (const [name, config] of Object.entries(loadAgentDefinitions(resolved, "opencode-config"))) {
          if (!Object.hasOwn(result, name)) result[name] = config
        }
      }
    } catch {
      continue
    }
  }
  return result
}
