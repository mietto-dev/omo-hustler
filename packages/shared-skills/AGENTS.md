# shared-skills - OpenCode Skill Bundle

## Overview

This package contains the hand-authored skills consumed by the OMO Hustler OpenCode product. `index.mjs` exposes `sharedSkillsRootPath()` for locating the bundled `skills/` directory from the workspace and built output.

## Layout

- Each skill has a `SKILL.md` with YAML frontmatter and a concise routing description.
- Longer material belongs in `references/`; executable helpers belong in `scripts/`.
- Third-party frontend references live in the pinned `upstreams/` gitlinks and are materialized only when the frontend asset build requires them.

## Boundaries

- Keep skill content independent of OpenCode SDK APIs; adapter-specific behavior belongs in `packages/omo-opencode`.
- Do not commit materialized third-party reference copies or generated local state.
- Skill prose is not a runtime contract. Tests should cover packaging, parsing, path resolution, provenance, and other machine-consumed behavior rather than pinning wording.

## Verification

Run the focused shared-skills tests from the repository root after changing package layout, provenance, or materialization behavior. Preserve the four frontend upstream gitlinks required by the provenance gate.
