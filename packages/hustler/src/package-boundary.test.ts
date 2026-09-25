import { describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { readdirSync, readFileSync } from "node:fs"
import { dirname, join, normalize, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import * as ts from "typescript/unstable/ast"

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

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(path) : path.endsWith(".ts") ? [path] : []
  })
}

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

function importSpecifiers(source: string): string[] {
  const scanner = ts.createScanner(true, ts.LanguageVariant.Standard, source)
  const specifiers: string[] = []
  let previousToken = ts.SyntaxKind.Unknown
  let tokenBeforePrevious = ts.SyntaxKind.Unknown
  let previousTokenValue: string | undefined
  let previousTokenStart = -1

  while (true) {
    const token = scanner.scan()
    const tokenStart = scanner.getTokenStart()
    if (tokenStart <= previousTokenStart) {
      scanner.setText(source, scanner.getTokenEnd() + 1)
      previousToken = ts.SyntaxKind.Unknown
      tokenBeforePrevious = ts.SyntaxKind.Unknown
      previousTokenValue = undefined
      continue
    }
    previousTokenStart = tokenStart
    if (token === ts.SyntaxKind.EndOfFile) {
      break
    }
    if (token === ts.SyntaxKind.StringLiteral) {
      const isSideEffectImport = previousToken === ts.SyntaxKind.ImportKeyword
      const isDynamicImport = previousToken === ts.SyntaxKind.OpenParenToken && tokenBeforePrevious === ts.SyntaxKind.ImportKeyword
      const isFromClause = previousTokenValue === "from"
      const tokenText = scanner.getTokenValue()
      if (isSideEffectImport || isDynamicImport || isFromClause) {
        specifiers.push(tokenText)
      }
    }
    tokenBeforePrevious = previousToken
    previousToken = token
    previousTokenValue = scanner.getTokenValue()
  }
  return specifiers
}

function resolvesToHustlerFacade(sourcePath: string, specifier: string): boolean {
  const facadePath = normalize(join(repositoryRoot, "packages/hustler/src/index.ts"))
  if (specifier === "packages/hustler/src/index.ts") {
    return true
  }
  if (!specifier.startsWith(".")) {
    return false
  }
  const candidate = normalize(resolve(dirname(sourcePath), specifier))
  return [candidate, `${candidate}.ts`, join(candidate, "index.ts")].includes(facadePath)
}

describe("Hustler package boundary", () => {
  test("#given the standalone HUSTLER facade #when loading its public entrypoint #then it does not re-export the OpenCode plugin", async () => {
    const facade = await import("./index")

    expect("default" in facade).toBe(false)
    expect("omoPlugin" in facade).toBe(false)
    expect(facade.HUSTLER_ROLES).toEqual([
      "orchestrator",
      "planner",
      "developer",
      "tester",
      "approver",
      "librarian",
      "architect",
    ])
  })

  test("#given the OpenCode source #when auditing imports #then it never imports the HUSTLER facade", () => {
    const opencodeSourceRoot = join(repositoryRoot, "packages/omo-opencode/src")
    const reverseImports = sourceFiles(opencodeSourceRoot).flatMap((path) => {
      return importSpecifiers(readFileSync(path, "utf8")).some((specifier) => resolvesToHustlerFacade(path, specifier)) ? [path] : []
    })

    expect(reverseImports).toEqual([])
  })

  test("#given source text #when extracting imports #then only executable import syntax is audited", () => {
    const fixtureSpecifiers = importSpecifiers(`
      // import "packages/hustler/src/index.ts"
      const text = "packages/hustler/src/index.ts"
      import("packages/hustler/src/index.ts")
      export { value } from "packages/hustler/src/index.ts"
    `)

    expect(fixtureSpecifiers).toEqual([
      "packages/hustler/src/index.ts",
      "packages/hustler/src/index.ts",
    ])
  })

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
