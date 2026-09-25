import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { describe, expect, test } from "bun:test"
import { clearCommandLoaderCache, loadOpenCodeProjectCommands } from "./loader"

describe("OpenCode command loader", () => {
  test("#given a project .opencode command #when loaded #then returns the command definition", async () => {
    const root = await mkdtemp(join(tmpdir(), "opencode-command-loader-"))
    await mkdir(join(root, ".opencode", "commands"), { recursive: true })
    await writeFile(
      join(root, ".opencode", "commands", "review.md"),
      "---\ndescription: Review changes\nagent: reviewer\n---\nReview $ARGUMENTS",
    )

    const commands = await loadOpenCodeProjectCommands(root)

    expect(commands.review).toMatchObject({
      description: "(opencode-project) Review changes",
      agent: "reviewer",
    })
  })

  test("#given a Claude-host command directory #when loaded #then returns empty and does not cache it", async () => {
    const root = await mkdtemp(join(tmpdir(), "opencode-command-loader-"))
    await mkdir(join(root, ".claude", "commands"), { recursive: true })
    await writeFile(join(root, ".claude", "commands", "legacy.md"), "---\ndescription: legacy\n---\nlegacy")

    clearCommandLoaderCache()

    expect(await loadOpenCodeProjectCommands(root)).toEqual({})
  })
})
