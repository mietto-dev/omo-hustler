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

function readTsConfig(relativePath: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(repositoryRoot, relativePath), "utf8")) as Record<string, unknown>
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
    ])
  })

  test("#given the root workspace list #when inspecting workspaces #then Hustler participates in the monorepo boundary", () => {
    const manifest = readRootManifest()
    const workspaces = manifest.workspaces as string[]

    expect(workspaces).toContain("packages/hustler")
    expect(workspaces).not.toContain("packages/omo-codex")
  })

  test("#given the root build graph #when selecting the plugin entry #then it uses the OpenCode adapter directly", () => {
    const buildScript = readBuildScript()

    expect(buildScript).toContain('"packages/omo-opencode/src/index.ts"')
    expect(buildScript).not.toContain('"packages/hustler/src/index.ts"')
  })

  test("#given the OpenCode project configs #when inspecting exclusions #then legacy CLI sources stay outside each build boundary", () => {
    const rootConfig = readTsConfig("tsconfig.json")
    const packageConfig = readTsConfig("packages/omo-opencode/tsconfig.json")

    expect(rootConfig.exclude).toContain("packages/omo-opencode/src/cli/**")
    expect(packageConfig.exclude).toContain("src/cli/**")
  })
})
