import { existsSync, readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { log } from "../../shared/logger"
import { transformMcpServer } from "./transformer"
import type { LoadedMcpServer, McpLoadResult, McpLoaderOptions, OpenCodeMcpConfig, OpenCodeMcpServer } from "./types"

type Source = { path: string; scope: "user" | "project" }

function getSources(options: McpLoaderOptions): Source[] {
  const cwd = options.cwd ?? process.cwd()
  const home = options.homeDir ?? process.env.HOME ?? homedir()
  return [{ path: join(home, ".mcp.json"), scope: "user" }, { path: join(cwd, ".mcp.json"), scope: "project" }]
}

function readConfig(path: string): OpenCodeMcpConfig | null {
  if (!existsSync(path)) return null
  try { return JSON.parse(readFileSync(path, "utf8")) as OpenCodeMcpConfig } catch (error) { log(`Failed to load MCP config from ${path}`, error); return null }
}

export async function loadMcpConfigs(disabledMcps: string[] = [], options: McpLoaderOptions = {}): Promise<McpLoadResult> {
  const servers: McpLoadResult["servers"] = {}
  const loadedServers: LoadedMcpServer[] = []
  const disabled = new Set(disabledMcps)
  for (const source of getSources(options)) {
    const config = readConfig(source.path)
    for (const [name, server] of Object.entries(config?.mcpServers ?? {})) {
      if (disabled.has(name)) continue
      if (server.disabled) {
        delete servers[name]
        const index = loadedServers.findIndex((loaded) => loaded.name === name)
        if (index >= 0) loadedServers.splice(index, 1)
        continue
      }
      try {
        const transformed = transformMcpServer(name, server)
        servers[name] = transformed
        const index = loadedServers.findIndex((loaded) => loaded.name === name)
        if (index >= 0) loadedServers.splice(index, 1)
        loadedServers.push({ name, scope: source.scope, config: transformed })
      } catch (error) { log(`Failed to transform MCP server "${name}"`, error) }
    }
  }
  return { servers, loadedServers }
}

export function getSystemMcpServerNames(options: McpLoaderOptions = {}): Set<string> {
  const names = new Set<string>()
  for (const source of getSources(options)) {
    const config = readConfig(source.path)
    for (const [name, server] of Object.entries(config?.mcpServers ?? {})) {
      if (server.disabled) names.delete(name)
      else names.add(name)
    }
  }
  return names
}

export function formatLoadedServersForToast(loadedServers: LoadedMcpServer[]): string {
  return loadedServers.map((server) => `${server.name} (${server.scope})`).join(", ")
}
