import { existsSync, readFileSync } from "node:fs"
import { basename, extname } from "node:path"
import { parseFrontmatter } from "../../shared/frontmatter"
import { parseToolsConfig } from "../../shared/parse-tools-config"
import { log } from "../../shared/logger"
import { parseJsonAgentFile } from "./json-agent-loader"
import type { AgentFrontmatter, AgentScope, LoadedAgent, OpenCodeAgentConfig } from "./types"

export function parseMarkdownAgentFile(filePath: string, scope: AgentScope): LoadedAgent | null {
  if (!existsSync(filePath)) return null
  try {
    const { data, body } = parseFrontmatter<AgentFrontmatter>(readFileSync(filePath, "utf8"))
    const name = data.name || basename(filePath).replace(/\.md$/i, "")
    const config: OpenCodeAgentConfig = {
      description: `(${scope}) ${data.description || ""}`,
      mode: data.mode || "subagent",
      prompt: body.trim(),
      ...(data.model ? { model: data.model } : {}),
    }
    const tools = parseToolsConfig(data.tools)
    if (tools) config.tools = tools
    return { name, path: filePath, config, scope }
  } catch {
    return null
  }
}

export function loadAgentDefinitions(paths: string[], scope: AgentScope): Record<string, OpenCodeAgentConfig> {
  const result: Record<string, OpenCodeAgentConfig> = Object.create(null)
  for (const filePath of paths) {
    if (!existsSync(filePath)) {
      log(`[opencode-agent-loader] File not found, skipping: ${filePath}`)
      continue
    }
    const extension = extname(filePath).toLowerCase()
    const agent = extension === ".md"
      ? parseMarkdownAgentFile(filePath, scope)
      : extension === ".json" || extension === ".jsonc"
        ? parseJsonAgentFile(filePath, scope)
        : null
    if (agent) result[agent.name] = agent.config
  }
  return result
}
