import { promises as fs } from "node:fs"
import { resolve } from "node:path"
import type { CommandDefinition } from "./types"

const cache = new Map<string, Promise<Record<string, CommandDefinition>>>()

export async function getCommandLoaderCacheKey(directory?: string): Promise<string> {
  const resolved = resolve(directory ?? process.cwd())
  try { return await fs.realpath(resolved) } catch { return resolved }
}
export function getCachedCommands(key: string) { return cache.get(key) }
export function setCachedCommands(key: string, value: Promise<Record<string, CommandDefinition>>) { cache.set(key, value) }
export function deleteCachedCommands(key: string) { cache.delete(key) }
export function clearCommandLoaderCache() { cache.clear() }
