import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url))
const forbiddenRoots = [
  "packages/omo-codex",
  "packages/omo-senpi",
  "packages/omo-native",
  "packages/senpi-task",
  "packages/pi-goal",
  "packages/pi-webfetch",
  "packages/ast-grep-mcp",
  "packages/git-bash-mcp",
  "packages/web",
] as const

describe("published package exclusions", () => {
  test("#given the root package files allowlist #when checking forbidden roots #then no excluded harness is allowlisted", () => {
    const packageJson = readFileSync(join(repositoryRoot, "package.json"), "utf8")

    for (const root of forbiddenRoots) {
      expect(packageJson).not.toContain(`"${root}"`)
    }
  })

  test("#given the legal files #when checking the package manifest #then both required notices remain present", () => {
    const packageJson = JSON.parse(readFileSync(join(repositoryRoot, "package.json"), "utf8")) as {
      files: string[]
    }

    expect(packageJson.files).toContain("LICENSE.md")
    expect(packageJson.files).toContain("THIRD-PARTY-NOTICES.md")
  })
})
