import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")

describe("root test CI partition", () => {
  test("keeps the two-OS-shard matrix and OpenCode test commands", () => {
    expect(workflow).toContain('shard: "1/2"')
    expect(workflow).toContain('shard: "2/2"')
    expect(workflow).toContain("packages/omo-opencode packages/memory-core")
    expect(workflow).toContain("bunfig.win2.parallel.toml")
    expect(workflow).not.toContain("packages/omo-codex")
    expect(workflow).not.toContain("packages/omo-senpi")
    expect(workflow).not.toContain("packages/omo-native")
    expect(workflow).not.toContain("packages/lsp-daemon")
  })

  test("keeps Windows test execution outside Git Bash", () => {
    expect(workflow).toContain("runner.os == 'Windows'")
    expect(workflow).toContain("shell: pwsh")
  })
})
