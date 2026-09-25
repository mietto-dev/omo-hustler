import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, test } from "bun:test"
import { loadMcpConfigs } from "./loader"
import { resetAdditionalAllowedMcpEnvVars, setAdditionalAllowedMcpEnvVars } from "@oh-my-opencode/mcp-client-core/skill-mcp-manager/configure-allowed-env-vars"

describe("OpenCode MCP loader", () => {
  test("#given user and project .mcp.json files #when loaded #then project overrides user and expands allowed env", async () => {
    const root = await mkdtemp(join(tmpdir(), "opencode-mcp-loader-"))
    const home = await mkdtemp(join(tmpdir(), "opencode-mcp-home-"))
    process.env.TASK3_MCP_TOKEN = "secret-token"
    await writeFile(join(home, ".mcp.json"), JSON.stringify({ mcpServers: {
      shared: { type: "stdio", command: "user-server" },
      userOnly: { type: "stdio", command: "user-only" },
    } }))
    await writeFile(join(root, ".mcp.json"), JSON.stringify({ mcpServers: {
      shared: { type: "stdio", command: "project-server", env: { TOKEN: "${TASK3_MCP_TOKEN}" } },
    } }))

    setAdditionalAllowedMcpEnvVars(["TASK3_MCP_TOKEN"])
    const result = await loadMcpConfigs([], { cwd: root, homeDir: home })
    resetAdditionalAllowedMcpEnvVars()

    expect(result.servers.shared).toMatchObject({ type: "local", command: ["project-server"], environment: { TOKEN: "secret-token" } })
    expect(result.servers.userOnly).toMatchObject({ type: "local", command: ["user-only"] })
  })

  test("#given disabled and malformed MCP entries #when loaded #then skips them without failing", async () => {
    const root = await mkdtemp(join(tmpdir(), "opencode-mcp-loader-"))
    const home = await mkdtemp(join(tmpdir(), "opencode-mcp-home-"))
    await mkdir(root, { recursive: true })
    await writeFile(join(root, ".mcp.json"), JSON.stringify({ mcpServers: {
      disabled: { type: "stdio", command: "ignored", disabled: true },
      malformed: { type: "http" },
    } }))

    const result = await loadMcpConfigs([], { cwd: root, homeDir: home })

    expect(result.servers).toEqual({})
  })
})
