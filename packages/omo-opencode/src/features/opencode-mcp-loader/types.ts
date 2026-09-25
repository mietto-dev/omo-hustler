import type {
  McpLocalConfig,
  McpOAuthConfig,
  McpRemoteConfig,
  McpServerConfig,
  LoadedMcpServer,
  McpLoadResult,
} from "@oh-my-opencode/mcp-client-core/skill-mcp-manager/mcp-types"

export type { McpLocalConfig, McpOAuthConfig, McpRemoteConfig, McpServerConfig, LoadedMcpServer, McpLoadResult }

export interface OpenCodeMcpServer {
  type?: "http" | "sse" | "stdio"
  url?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  headers?: Record<string, string>
  oauth?: McpOAuthConfig
  disabled?: boolean
}

export interface OpenCodeMcpConfig {
  mcpServers?: Record<string, OpenCodeMcpServer>
}

export type McpLoaderOptions = { readonly cwd?: string; readonly homeDir?: string }
