import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, test } from "bun:test"
import { loadOpenCodeProjectAgents } from "./loader"

describe("OpenCode agent loader", () => {
  test("#given a project .opencode agent #when loaded #then returns the native agent config", async () => {
    const root = await mkdtemp(join(tmpdir(), "opencode-agent-loader-"))
    await mkdir(join(root, ".opencode", "agents"), { recursive: true })
    await writeFile(
      join(root, ".opencode", "agents", "reviewer.md"),
      "---\ndescription: Reviews changes\nmodel: openai/gpt-5.6\n---\nReview the diff.",
    )

    const agents = loadOpenCodeProjectAgents(root)

    expect(agents.reviewer).toMatchObject({
      description: "(opencode-project) Reviews changes",
      model: "openai/gpt-5.6",
      mode: "subagent",
    })
  })

  test("#given a Claude-host agent directory #when loading OpenCode agents #then ignores it", async () => {
    const root = await mkdtemp(join(tmpdir(), "opencode-agent-loader-"))
    await mkdir(join(root, ".claude", "agents"), { recursive: true })
    await writeFile(join(root, ".claude", "agents", "legacy.md"), "---\ndescription: legacy\n---\nlegacy")

    expect(loadOpenCodeProjectAgents(root)).toEqual({})
  })
})
