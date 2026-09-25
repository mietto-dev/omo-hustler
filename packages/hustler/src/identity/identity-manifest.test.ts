import { describe, expect, test } from "bun:test"
import {
  identityManifest,
  validateIdentityManifest,
  type IdentityManifest,
} from "./identity-manifest"

const cloneManifest = (): IdentityManifest =>
  JSON.parse(JSON.stringify(identityManifest)) as IdentityManifest

describe("Hustler identity manifest", () => {
  test("accepts the manifest", () => {
    expect(validateIdentityManifest(identityManifest)).toEqual([])
    expect(identityManifest.closure.paths).toHaveLength(
      identityManifest.closure.included_package_roots.length +
        identityManifest.closure.excluded_package_roots.length +
        identityManifest.closure.included_artifact_paths.length +
        4,
    )
    expect(identityManifest.provenance.legal_files).toEqual([
      "LICENSE.md",
      "THIRD-PARTY-NOTICES.md",
    ])
  })

  test("rejects excluded adapter and missing provenance", () => {
    const invalidManifest = cloneManifest()
    invalidManifest.closure.package_file_list = [
      ...invalidManifest.closure.package_file_list,
      "packages/omo-codex/plugin/**",
    ]
    invalidManifest.provenance.legal_files = ["LICENSE.md", "MISSING-NOTICES.md"]

    expect(validateIdentityManifest(invalidManifest)).toEqual([
      "package file is not classified: packages/omo-codex/plugin/**",
      "excluded adapter appears in package file list: packages/omo-codex/plugin/**",
      "legal file is not included: MISSING-NOTICES.md",
    ])
  })
})
