import { promises as fs, type Dirent } from "node:fs"
import { basename, join } from "node:path"
import { parseFrontmatter } from "../../shared/frontmatter"
import { sanitizeModelField } from "../../shared/model-sanitizer"
import { isMarkdownFile } from "../../shared/file-utils"
import { EXCLUDED_DIRS } from "../../shared/excluded-dirs"
import { getOpenCodeCommandDirs } from "../../shared/opencode-command-dirs"
import { findProjectOpencodeCommandDirs } from "../../shared/project-discovery-dirs"
import { log } from "../../shared/logger"
import { deleteCachedCommands, getCachedCommands, getCommandLoaderCacheKey, setCachedCommands } from "./loader-cache"
import type { CommandDefinition, CommandFrontmatter, LoadedCommand } from "./types"

export { clearCommandLoaderCache } from "./loader-cache"

async function loadFromDir(dir: string, scope: LoadedCommand["scope"], visited = new Set<string>(), prefix = ""): Promise<LoadedCommand[]> {
  try { await fs.access(dir) } catch { return [] }
  let realPath: string
  try { realPath = await fs.realpath(dir) } catch { return [] }
  if (visited.has(realPath)) return []
  visited.add(realPath)
  let entries: Dirent[]
  try { entries = await fs.readdir(dir, { withFileTypes: true }) } catch { return [] }
  const commands: LoadedCommand[] = []
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith(".")) continue
      commands.push(...await loadFromDir(join(dir, entry.name), scope, visited, prefix ? `${prefix}/${entry.name}` : entry.name))
      continue
    }
    if (!isMarkdownFile(entry)) continue
    const commandPath = join(dir, entry.name)
    try {
      const { data, body } = parseFrontmatter<CommandFrontmatter>(await fs.readFile(commandPath, "utf8"))
      const commandName = prefix ? `${prefix}/${basename(entry.name, ".md")}` : basename(entry.name, ".md")
      commands.push({
        name: commandName,
        path: commandPath,
        scope,
        definition: {
          name: commandName,
          description: `(${scope}) ${data.description || ""}`,
          template: `<command-instruction>\n${body.trim()}\n</command-instruction>\n\n<user-request>\n$ARGUMENTS\n</user-request>`,
          agent: data.agent,
          model: sanitizeModelField(data.model, "opencode"),
          subtask: data.subtask,
          argumentHint: data["argument-hint"],
          handoffs: data.handoffs,
        },
      })
    } catch (error) { log(`Failed to parse command: ${commandPath}`, error) }
  }
  return commands
}

function toRecord(commands: LoadedCommand[]): Record<string, CommandDefinition> {
  const result: Record<string, CommandDefinition> = {}
  for (const command of commands) {
    const { argumentHint: _argumentHint, ...definition } = command.definition
    if (!(command.name in result)) result[command.name] = definition
  }
  return result
}

export async function loadOpenCodeGlobalCommands(): Promise<Record<string, CommandDefinition>> {
  const loaded = await Promise.all(getOpenCodeCommandDirs({ binary: "opencode" }).map((dir) => loadFromDir(dir, "opencode")))
  return toRecord(loaded.flat())
}

export async function loadOpenCodeProjectCommands(directory?: string): Promise<Record<string, CommandDefinition>> {
  const loaded = await Promise.all(findProjectOpencodeCommandDirs(directory ?? process.cwd()).map((dir) => loadFromDir(dir, "opencode-project")))
  return toRecord(loaded.flat())
}

export async function loadAllCommands(directory?: string): Promise<Record<string, CommandDefinition>> {
  const key = await getCommandLoaderCacheKey(directory)
  const cached = getCachedCommands(key)
  if (cached) return cached
  const promise = Promise.all([loadOpenCodeGlobalCommands(), loadOpenCodeProjectCommands(directory)])
    .then(([globalCommands, projectCommands]) => ({ ...globalCommands, ...projectCommands }))
    .catch((error) => { deleteCachedCommands(key); throw error })
  setCachedCommands(key, promise)
  return promise
}
