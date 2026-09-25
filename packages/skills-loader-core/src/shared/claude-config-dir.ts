import { join } from "node:path"
import { getHomeDirectory } from "@omo-hustler/utils"

export function getClaudeConfigDir(): string {
  const envConfigDir = process.env.CLAUDE_CONFIG_DIR
  if (envConfigDir) {
    return envConfigDir
  }

  return join(getHomeDirectory(), ".claude")
}
