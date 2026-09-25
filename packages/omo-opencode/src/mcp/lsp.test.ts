import { afterEach, describe, expect, it } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { delimiter, join } from "node:path"
import { pathToFileURL } from "node:url"
import { createLspMcpConfig } from "./lsp"
import type { RuntimeExecutable } from "./runtime-executable"

const temporaryDirectories: string[] = []

function createTemporaryDirectory(prefix: string): string {
  const directory = mkdtempSync(join(tmpdir(), prefix))
  temporaryDirectories.push(directory)
  return directory
}

function createResolver(executables: Partial<Record<RuntimeExecutable["name"], string>>) {
  return (name: RuntimeExecutable["name"]): RuntimeExecutable => ({
    name,
    command: executables[name] ?? name,
    available: executables[name] !== undefined,
  })
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe("createLspMcpConfig", () => {
  it("resolves the bundled lsp-tools dist cli from the module root", () => {
    const packageRoot = createTemporaryDirectory("omo-lsp-package-root-")
    const moduleFilePath = join(packageRoot, "dist", "index.js")
    const cliPath = join(packageRoot, "packages", "lsp-tools-mcp", "dist", "cli.js")
    const nodePath = join(packageRoot, "bin", "node")
    mkdirSync(join(packageRoot, "dist"), { recursive: true })
    mkdirSync(join(packageRoot, "packages", "lsp-tools-mcp", "dist"), { recursive: true })
    writeFileSync(cliPath, "#!/usr/bin/env node\n", "utf-8")

    const config = createLspMcpConfig({
      cwd: createTemporaryDirectory("omo-lsp-unrelated-cwd-"),
      moduleUrl: pathToFileURL(moduleFilePath).href,
      resolveExecutable: createResolver({ node: nodePath }),
    })

    expect(config.enabled).toBe(true)
    expect(config.command).toEqual([nodePath, cliPath, "mcp"])
  })

  it("resolves the standalone source cli with bun", () => {
    const packageRoot = createTemporaryDirectory("omo-lsp-source-root-")
    const moduleFilePath = join(packageRoot, "src", "mcp", "lsp.ts")
    const sourceCliPath = join(packageRoot, "packages", "lsp-tools-mcp", "src", "cli.ts")
    const bunPath = join(packageRoot, "bin", "bun")
    mkdirSync(join(packageRoot, "src", "mcp"), { recursive: true })
    mkdirSync(join(packageRoot, "packages", "lsp-tools-mcp", "src"), { recursive: true })
    writeFileSync(sourceCliPath, "console.log('mcp')\n", "utf-8")

    const config = createLspMcpConfig({
      cwd: createTemporaryDirectory("omo-lsp-source-cwd-"),
      moduleUrl: pathToFileURL(moduleFilePath).href,
      resolveExecutable: createResolver({ bun: bunPath }),
    })

    expect(config.enabled).toBe(true)
    expect(config.command).toEqual([bunPath, sourceCliPath, "mcp"])
    expect(config.environment).not.toHaveProperty("OMO_LSP_DAEMON_CLI")
    expect(config.environment).not.toHaveProperty("OMO_LSP_DAEMON_VERSION")
  })

  it("does not resolve an lsp cli from the opened workspace", () => {
    const packageRoot = createTemporaryDirectory("omo-lsp-package-root-")
    const workspaceRoot = createTemporaryDirectory("omo-lsp-workspace-")
    const moduleFilePath = join(packageRoot, "dist", "index.js")
    const packageCliPath = join(packageRoot, "packages", "lsp-tools-mcp", "dist", "cli.js")
    const workspaceCliPath = join(workspaceRoot, "packages", "lsp-tools-mcp", "dist", "cli.js")
    const nodePath = join(packageRoot, "bin", "node")
    mkdirSync(join(packageRoot, "dist"), { recursive: true })
    mkdirSync(join(packageRoot, "packages", "lsp-tools-mcp", "dist"), { recursive: true })
    mkdirSync(join(workspaceRoot, "packages", "lsp-tools-mcp", "dist"), { recursive: true })
    writeFileSync(packageCliPath, "console.log('package')\n", "utf-8")
    writeFileSync(workspaceCliPath, "console.log('workspace')\n", "utf-8")

    const config = createLspMcpConfig({
      cwd: workspaceRoot,
      moduleUrl: pathToFileURL(moduleFilePath).href,
      resolveExecutable: createResolver({ node: nodePath }),
    })

    expect(config.command).toEqual([nodePath, packageCliPath, "mcp"])
    expect(config.command).not.toContain(workspaceCliPath)
  })

  it("includes the ordered project and user configuration paths", () => {
    const packageRoot = createTemporaryDirectory("omo-lsp-config-root-")
    const moduleFilePath = join(packageRoot, "dist", "index.js")
    const cliPath = join(packageRoot, "packages", "lsp-tools-mcp", "dist", "cli.js")
    const nodePath = join(packageRoot, "bin", "node")
    const cwd = createTemporaryDirectory("omo-lsp-config-cwd-")
    mkdirSync(join(packageRoot, "dist"), { recursive: true })
    mkdirSync(join(packageRoot, "packages", "lsp-tools-mcp", "dist"), { recursive: true })
    writeFileSync(cliPath, "#!/usr/bin/env node\n", "utf-8")

    const config = createLspMcpConfig({ cwd, moduleUrl: pathToFileURL(moduleFilePath).href, resolveExecutable: createResolver({ node: nodePath }) })

    expect(config.environment?.LSP_TOOLS_MCP_PROJECT_CONFIG).toBe(
      [".opencode/lsp.json", ".omo/lsp.json", ".omo/lsp-client.json"].map((path) => join(cwd, path)).join(delimiter),
    )
    expect(config.environment?.LSP_TOOLS_MCP_USER_CONFIG).toContain("opencode/lsp.json")
  })
})
