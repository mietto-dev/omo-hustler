import type { Command } from "commander"
import { cleanup } from "./cleanup"
import type { CleanupOptions } from "./cleanup"

type CleanupCommandOptions = {
  readonly project?: CleanupOptions["project"]
  readonly json?: CleanupOptions["json"]
}

export function configureCleanupCommand(program: Command): void {
  program
    .command("cleanup")
    .alias("uninstall")
    .description("Remove the OpenCode plugin entry from the active configuration")
    .option("--project <path>", "Project directory to inspect")
    .option("--json", "Output structured JSON result")
    .addHelpText("after", `
Examples:
  $ oh-my-opencode uninstall
  $ oh-my-opencode cleanup
`)
    .action(async (options: CleanupCommandOptions) => {
      const exitCode = await cleanup({
        project: options.project,
        json: options.json ?? false,
      })
      process.exit(exitCode)
    })
}
