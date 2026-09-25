# prompts-core — Markdown Prompt Loading + Variant Routing (Core)

**Generated:** 2026-08-24 / f3642fcda

## OVERVIEW

Owns all static markdown prompt content (`prompts/` tree), bundles it at build time via Bun's `.md` text loader (never read from disk at runtime), and exports it as `VariantTable` records plus typed `loadPrompt`/`loadPromptSync` (frontmatter parse + runtime placeholder injection) and `resolveVariant` (model → variant). Harness-neutral: zero OpenCode SDK coupling, enforced by an audit test. Package: `@omo-hustler/prompts-core`.

## PROMPT TREE (`prompts/`)

| Family | Variants |
|--------|----------|
| `ultrawork/` | `default`, `gpt`, `gemini`, `glm`, `planner` (5) |
| `atlas/` | `default`, `gpt`, `gemini`, `glm`, `kimi`, `kimi-k2-7`, `kimi-k3`, `opus-4-7` (8) |
| `prometheus/` | `default` only (no model routing) |
| `mode/` | `hyperplan`, `team` |

## PUBLIC API (`src/index.ts`)

- **Constants:** `ULTRAWORK_{DEFAULT,GPT,GEMINI,GLM,PLANNER}_PROMPT`, `HYPERPLAN_MODE_PROMPT`, `TEAM_MODE_PROMPT`; `VariantTable`s `ultraworkPromptVariants`, `atlasPromptVariants`, `prometheusPromptVariants`.
- **Functions:** `resolveVariant(input)` (uses `model-core` matchers), `loadPrompt`/`loadPromptSync` (bundled sync or filesystem async).
- **Types/errors:** `ModelVariant` (9 literals), `PromptSource`, `LoadedPrompt`, `VariantTable`; `PromptFileNotFoundError`, `PromptPathTraversalError`.

## DEPENDENCIES & CONSUMERS

- **Peer deps:** `@omo-hustler/model-core` (`isGptModel`, `isGeminiModel`, `isKimiK2Model`, …), `@omo-hustler/utils` (`parseFrontmatter`).
- **Consumers:** `omo-opencode/src/hooks/keyword-detector/{ultrawork,hyperplan,team}/*.ts` (thin re-export shims), `agents/atlas/agent.ts`, and `agents/prometheus/system-prompt.ts`.

## NOTES

- **Edit prompt bodies in `prompts/*.md`, NOT the `.ts` loaders.** The `-prompts.ts` files just import + wrap the markdown.
- **No `@opencode-ai/*` imports** — enforced by `test/opencode-coupling-audit.test.ts`.
- Prometheus stays single-variant; model-specific variants are selected by the adapter.
- Parent: [`packages/AGENTS.md`](../AGENTS.md).
