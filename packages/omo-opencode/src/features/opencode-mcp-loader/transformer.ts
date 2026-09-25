import { expandEnvVarsInObject } from "./env-expander"
import type { McpLocalConfig, McpRemoteConfig, McpServerConfig, OpenCodeMcpServer } from "./types"

export function transformMcpServer(name: string, server: OpenCodeMcpServer): McpServerConfig {
  const expanded = expandEnvVarsInObject(server)
  if (expanded.type === "http" || expanded.type === "sse") {
    if (!expanded.url) throw new Error(`MCP server "${name}" requires url`)
    const config: McpRemoteConfig = { type: "remote", url: expanded.url, enabled: true }
    if (expanded.headers && Object.keys(expanded.headers).length) config.headers = expanded.headers
    if (expanded.oauth && Object.keys(expanded.oauth).length) config.oauth = expanded.oauth
    return config
  }
  if (!expanded.command) throw new Error(`MCP server "${name}" requires command`)
  const config: McpLocalConfig = { type: "local", command: [expanded.command, ...(expanded.args ?? [])], enabled: true }
  if (expanded.env && Object.keys(expanded.env).length) config.environment = expanded.env
  return config
}
