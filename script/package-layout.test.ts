import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url))

function readRootManifest(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as Record<string, unknown>
}

function readBuildScript(): string {
  return readFileSync(join(repositoryRoot, "script/build.ts"), "utf8")
}

describe("published package layout", () => {
  test("#given the root package manifest #when inspecting files #then legal files and built OpenCode runtimes are explicit", () => {
    const manifest = readRootManifest()

    expect(manifest.files).toEqual([
      "LICENSE.md",
      "THIRD-PARTY-NOTICES.md",
      "dist",
      "bin/hustler-opencode.js",
      "assets/oh-my-opencode.schema.json",
      "packages/hustler/package.json",
      "packages/hustler/dist",
      "packages/lsp-tools-mcp/package.json",
      "packages/lsp-tools-mcp/dist",
      "packages/lsp-daemon/package.json",
      "packages/lsp-daemon/dist",
    ])
  })

  test("#given the root workspace list #when inspecting workspaces #then Hustler participates in the monorepo boundary", () => {
    const manifest = readRootManifest()
    const workspaces = manifest.workspaces as string[]

    expect(workspaces).not.toContain("packages/omo-codex")
    expect(workspaces).not.toContain("packages/omo-senpi")
    expect(workspaces).not.toContain("packages/web")
  })

  test("#given the root build graph #when selecting the plugin entry #then it uses the OpenCode adapter directly", () => {
    const buildScript = readBuildScript()

    expect(buildScript).toContain('"packages/omo-opencode/src/index.ts"')
    expect(buildScript).not.toContain('"packages/hustler/src/index.ts"')
  })
})
