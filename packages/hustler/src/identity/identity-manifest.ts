export type ManifestClassification = "included" | "generated" | "excluded"

export type IdentityDecision =
  | { status: "resolved"; value: string }
  | { status: "unresolved"; value: null }

export type ManifestPath = {
  classification: ManifestClassification
  path: string
  reason: string
}

export type ProvenanceRequirement = {
  destination: string
  required: readonly ["source_url", "license", "copyright", "destination"]
  source: string
}

export type IdentityManifest = {
  baseline: {
    fork_snapshot_commit: string
    upstream_commit: string
    upstream_repository: string
  }
  closure: {
    excluded_package_roots: readonly string[]
    included_artifact_paths: readonly string[]
    included_package_roots: readonly string[]
    package_file_list: readonly string[]
    paths: readonly ManifestPath[]
  }
  identity: {
    cli: IdentityDecision
    config_namespace: IdentityDecision
    package_name: IdentityDecision
    plugin_registration: IdentityDecision
    repository: IdentityDecision
    telemetry_prefix: IdentityDecision
    version_stream: IdentityDecision
  }
  provenance: {
    legal_files: readonly string[]
    requirements: readonly ProvenanceRequirement[]
    review_before_release: readonly string[]
  }
}

const includedPackageRoots = [
  "packages/omo-opencode",
  "packages/agents-md-core",
  "packages/boulder-state",
  "packages/comment-checker-core",
  "packages/delegate-core",
  "packages/hashline-core",
  "packages/lsp-core",
  "packages/mcp-client-core",
  "packages/mcp-stdio-core",
  "packages/memory-core",
  "packages/model-core",
  "packages/omo-config-core",
  "packages/openclaw-core",
  "packages/prompts-core",
  "packages/rules-engine",
  "packages/shared-skills",
  "packages/skills-loader-core",
  "packages/team-core",
  "packages/telemetry-core",
  "packages/tmux-core",
  "packages/utils",
  "packages/lsp-tools-mcp",
] as const

const excludedPackageRoots = [
  "packages/omo-codex",
  "packages/omo-senpi",
  "packages/omo-native",
  "packages/senpi-task",
  "packages/pi-goal",
  "packages/pi-webfetch",
  "packages/ast-grep-mcp",
  "packages/git-bash-mcp",
  "packages/lsp-daemon",
] as const

const includedArtifactPaths = [] as const

const resolved = (value: string): IdentityDecision => ({ status: "resolved", value })
const unresolved = (): IdentityDecision => ({ status: "unresolved", value: null })

export const identityManifest: IdentityManifest = {
  baseline: {
    fork_snapshot_commit: "983f1765a7e630d0a3ab725ecffed945e6435ec0",
    upstream_commit: "bee8c2ba46348da2a634003da53cf8cb038f5465",
    upstream_repository: "https://github.com/code-yeongyu/oh-my-openagent",
  },
  identity: {
    cli: resolved("hustler-opencode"),
    config_namespace: resolved("omo-hustler"),
    package_name: resolved("omo-hustler"),
    plugin_registration: resolved("omo-hustler"),
    repository: unresolved(),
    telemetry_prefix: resolved("omo-hustler"),
    version_stream: resolved("0.x-private"),
  },
  closure: {
    included_package_roots: includedPackageRoots,
    excluded_package_roots: excludedPackageRoots,
    included_artifact_paths: includedArtifactPaths,
    package_file_list: [
      "LICENSE.md",
      "THIRD-PARTY-NOTICES.md",
      ...includedPackageRoots.map((root) => `${root}/**`),
      "dist/**",
      "assets/omo-hustler.schema.json",
      ...includedArtifactPaths,
    ],
    paths: [
      {
        classification: "included",
        path: "LICENSE.md",
        reason: "Preserve the donor license and its restrictions in every payload.",
      },
      {
        classification: "included",
        path: "THIRD-PARTY-NOTICES.md",
        reason: "Preserve third-party attribution for redistributed components.",
      },
      ...includedPackageRoots.map((path) => ({
        classification: "included" as const,
        path: `${path}/**`,
        reason: "OpenCode adapter, reusable Core, MCP, or shared skill dependency.",
      })),
      {
        classification: "generated",
        path: "dist/**",
        reason: "Built OpenCode package output generated from included source.",
      },
      {
        classification: "generated",
        path: "assets/omo-hustler.schema.json",
        reason: "Generated OMO Hustler plugin schema included in the private package payload.",
      },
      ...excludedPackageRoots.map((path) => ({
        classification: "excluded" as const,
        path: `${path}/**`,
        reason: "Outside the OpenCode-only extraction boundary.",
      })),
    ],
  },
  provenance: {
    legal_files: ["LICENSE.md", "THIRD-PARTY-NOTICES.md"],
    requirements: includedPackageRoots.map((source) => ({
      source,
      destination: source,
      required: ["source_url", "license", "copyright", "destination"] as const,
    })),
    review_before_release: [
      "Resolve package, repository, CLI, plugin, config, telemetry, and version ownership.",
      "Obtain legal review before changing license, copyright, trademark, or commercial-use terms.",
      "Audit copied component notices against the final packed file list.",
    ],
  },
}

export function validateIdentityManifest(manifest: IdentityManifest): string[] {
  const errors: string[] = []
  const classifiedPaths = new Set<string>()
  const excludedRoots = manifest.closure.excluded_package_roots.map((root) => root.replace(/\*$/, ""))
  const includedArtifacts = manifest.closure.included_artifact_paths

  if (!/^[0-9a-f]{40}$/.test(manifest.baseline.fork_snapshot_commit)) {
    errors.push("baseline.fork_snapshot_commit must be a full commit SHA")
  }
  if (!/^[0-9a-f]{40}$/.test(manifest.baseline.upstream_commit)) {
    errors.push("baseline.upstream_commit must be a full commit SHA")
  }
  for (const entry of manifest.closure.paths) {
    if (classifiedPaths.has(entry.path)) errors.push(`duplicate classified path: ${entry.path}`)
    classifiedPaths.add(entry.path)
  }
  for (const path of manifest.closure.package_file_list) {
    if (!classifiedPaths.has(path)) {
      errors.push(`package file is not classified: ${path}`)
    }
    if (
      excludedRoots.some((root) => path.startsWith(root)) &&
      !includedArtifacts.some((artifact) => path === artifact || (artifact.endsWith("/**") && path.startsWith(artifact.slice(0, -3))))
    ) {
      errors.push(`excluded adapter appears in package file list: ${path}`)
    }
  }
  for (const file of manifest.provenance.legal_files) {
    if (!manifest.closure.paths.some((entry) => entry.path === file && entry.classification === "included")) {
      errors.push(`legal file is not included: ${file}`)
    }
  }
  for (const key of Object.keys(manifest.identity) as (keyof IdentityManifest["identity"])[]) {
    const decision = manifest.identity[key]
    if (key === "repository") {
      if (decision.status !== "unresolved" || decision.value !== null) {
        errors.push(`identity decision must remain unresolved: ${key}`)
      }
      continue
    }
    if (decision.status !== "resolved" || decision.value.length === 0) {
      errors.push(`identity decision must remain unresolved: ${key}`)
    }
  }
  return errors
}
