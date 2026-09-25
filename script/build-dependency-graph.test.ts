import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const buildSource = readFileSync(new URL("./build.ts", import.meta.url), "utf8")

describe("build dependency graph", () => {
  test("#given the OpenCode build graph #when scheduled #then generated consumers wait for the index bundle", () => {
    const sharedSkillsNode = buildSource.match(/\{ id: "shared-skills-assets"[^}]*deps: \[([^\]]*)\]/)
    const nodeShimNode = buildSource.match(/\{ id: "node-require-shim"[^}]*deps: \[([^\]]*)\]/)

    expect(sharedSkillsNode?.[1]).toContain('"index"')
    expect(nodeShimNode?.[1]).toContain('"index"')
  })
})
