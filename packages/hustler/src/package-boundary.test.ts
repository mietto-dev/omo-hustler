import { describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url))
const rootPackageJsonPath = join(repositoryRoot, "package.json")
const hustlerPackageJsonPath = join(repositoryRoot, "packages/hustler/package.json")
const forbiddenPayloadPrefixes = [
  "packages/omo-codex/",
  "packages/omo-senpi/",
  "packages/omo-native/",
  "packages/senpi-task/",
  "packages/pi-goal/",
  "packages/pi-webfetch/",
  "packages/ast-grep-mcp/",
  "packages/git-bash-mcp/",
  "packages/lsp-daemon/src/",
  "packages/omo-opencode/src/",
  "packages/utils/src/",
]

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>
}

function packedPaths(): string[] {
  const output = execFileSync("bun", ["pm", "pack", "--dry-run", "--ignore-scripts"], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  })
  return output
    .split("\n")
    .flatMap((line) => {
      const match = /^packed\s+\S+\s+(.+)$/.exec(line)
      return match?.[1] === undefined ? [] : [match[1]]
    })
}

describe("Hustler package boundary", () => {
  test("#given the package manifest #when inspecting package metadata #then it is independently buildable", () => {
    const manifest = readJson(hustlerPackageJsonPath)
    expect(manifest.name).toBe("@oh-my-opencode/hustler")
    expect(manifest.private).toBe(true)
    expect(manifest.type).toBe("module")
    expect(manifest.main).toBe("./dist/index.js")
    expect(manifest.types).toBe("./dist/index.d.ts")
    expect(manifest.scripts).toEqual({
      build: "rm -rf dist && bun run build:index && bun run build:cli && bun run build:types",
      "build:index": "bun build src/index.ts --outdir dist --target node --format esm --external zod",
      "build:cli": "bun build src/cli/index.ts --outfile dist/cli.js --target node --format esm",
      "build:types": "mkdir -p dist && cp src/index.d.ts dist/index.d.ts",
      typecheck: "tsgo --noEmit -p tsconfig.json",
      test: "bun test",
    })
    expect(manifest.files).toEqual(["dist", "package.json", "tsconfig.json"])
  })

  test("#given the root package manifest #when inspecting the published closure #then only built OpenCode runtime roots are allowlisted", () => {
    const rootManifest = readJson(rootPackageJsonPath)
    expect(rootManifest.files).toEqual([
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

  test("#given the packed root artifact #when collecting payload paths #then excluded source and unrelated harness artifacts are absent", () => {
    const paths = packedPaths()
    expect(paths.length).toBeLessThan(3000)
    expect(paths).toContain("LICENSE.md")
    expect(paths).toContain("THIRD-PARTY-NOTICES.md")
    expect(paths).toContain("packages/lsp-daemon/dist/cli.js")
    expect(paths).toContain("packages/hustler/package.json")
    expect(paths).toContain("packages/hustler/dist/index.js")
    expect(paths.filter((path) => forbiddenPayloadPrefixes.some((prefix) => path.startsWith(prefix)))).toEqual([])
    expect(paths.some((path) => /\.test\.(?:ts|js|d\.ts)$/.test(path))).toBe(false)
    expect(paths.some((path) => path.includes("/test/") || path.startsWith("test/"))).toBe(false)
    expect(paths.some((path) => path.startsWith("dist/__tests__/") || path.includes("/tests/"))).toBe(false)
    expect(paths.some((path) => path.includes("test-support"))).toBe(false)
  })
})
