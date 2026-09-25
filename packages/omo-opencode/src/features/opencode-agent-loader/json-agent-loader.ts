import { existsSync, readFileSync } from "node:fs"
import { parseJsoncSafe } from "../../shared/jsonc-parser"
import { parseToolsConfig } from "../../shared/parse-tools-config"
import type { AgentJsonDefinition, AgentScope, LoadedAgent, OpenCodeAgentConfig } from "./types"

export function parseJsonAgentFile(filePath: string, scope: AgentScope): LoadedAgent | null {
  if (!existsSync(filePath)) return null
  try {
    const { data } = parseJsoncSafe<AgentJsonDefinition>(readFileSync(filePath, "utf8"))
    if (!data?.name || !data.prompt) return null
    const config: OpenCodeAgentConfig = {
      description: `(${scope}) ${data.description ?? ""}`,
      mode: data.mode ?? "subagent",
      prompt: data.prompt.trim(),
      ...(data.model ? { model: data.model } : {}),
    }
    const tools = parseToolsConfig(data.tools)
    if (tools) config.tools = tools
    return { name: data.name, path: filePath, config, scope }
  } catch {
    return null
  }
}
