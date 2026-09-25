/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const rootManifestUrl = new URL("../package.json", import.meta.url)

function readRootFiles(): readonly string[] {
  const manifest = JSON.parse(readFileSync(rootManifestUrl, "utf8")) as { readonly files?: readonly string[] }
  return manifest.files ?? []
}

describe("root npm payload containment", () => {
  test("#given root files allowlist #when removed adapter containment is checked #then removed adapter payloads are not shipped", () => {
    // given
    const files = readRootFiles()

    // when / then
    expect(files.some((entry) => entry.startsWith("packages/omo-senpi/"))).toBe(false)
    expect(files.some((entry) => entry.startsWith("packages/lsp-daemon/"))).toBe(false)
  })

  test("#given root files allowlist #when hygiene negations are checked #then nested node_modules and retired component residue are excluded", () => {
    // given
    const files = readRootFiles()

    // when / then
    expect(files.some((entry) => entry.includes("node_modules"))).toBe(false)
  })

  test("#given root files allowlist #when vendored MCP shipping is checked #then each ships its package.json alongside dist", () => {
    // given
    const files = readRootFiles()

    // when / then
    for (const vendoredMcp of ["lsp-tools-mcp"] as const) {
      expect(files).toContain(`packages/${vendoredMcp}/dist`)
      expect(files).toContain(`packages/${vendoredMcp}/package.json`)
    }
  })

})
