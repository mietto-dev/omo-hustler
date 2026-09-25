import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const workflow = readFileSync(new URL("../.github/workflows/windows-flake-soak.yml", import.meta.url), "utf8")

describe("Windows flake soak workflow", () => {
  test("keeps the workflow manually dispatched with fixed OpenCode/core targets", () => {
    expect(workflow).toContain("workflow_dispatch:")
    expect(workflow).not.toContain("push:")
    expect(workflow).not.toContain("pull_request:")
    expect(workflow).toContain('"team-message" = @(')
    expect(workflow).toContain('"facts-lock" = @(')
    expect(workflow).toContain('"reply-listener" = @(')
    expect(workflow).not.toContain("omo-senpi")
    expect(workflow).not.toContain("senpi-task")
    expect(workflow).not.toContain("omo-codex")
    expect(workflow).not.toContain("omo-native")
  })

  test("validates the target and iteration boundaries before repeated execution", () => {
    expect(workflow).toContain("$targets.ContainsKey($target)")
    expect(workflow).toContain("Windows soak target is not allowlisted")
    expect(workflow).toContain("[int]::TryParse($env:SOAK_ITERATIONS, [ref]$iterationCount)")
    expect(workflow).toContain("$iterationCount -lt 1 -or $iterationCount -gt 50")
    expect(workflow).toContain("exit $LASTEXITCODE")
  })

  test("records iteration outcomes in the job summary", () => {
    expect(workflow).toContain('"iterations_ran=$iteration"')
    expect(workflow).toContain('"failed_iteration=$iteration"')
    expect(workflow).toContain("steps.run-soak.outputs.iterations_ran")
    expect(workflow).toContain("steps.run-soak.outputs.failed_iteration")
  })
})
