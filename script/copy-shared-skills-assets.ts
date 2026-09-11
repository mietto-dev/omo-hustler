#!/usr/bin/env bun
import { cp, mkdir, readdir, rm } from "node:fs/promises"
import { join, relative } from "node:path"

const sourceRoot = join(import.meta.dir, "..", "packages", "shared-skills", "skills")
const destinationRoot = join(import.meta.dir, "..", "dist", "skills")
const excludedNames = new Set(["__pycache__", ".coverage", ".pytest_cache", "__tests__", "tests", "test-support"])

async function copyDirectory(source: string, destination: string): Promise<void> {
  await mkdir(destination, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (
      excludedNames.has(entry.name) ||
      entry.name.endsWith(".test.ts") ||
      entry.name.endsWith(".test.mjs") ||
      entry.name.endsWith(".test-support.ts")
    ) {
      continue
    }

    const sourcePath = join(source, entry.name)
    const destinationPath = join(destination, entry.name)
    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath)
      continue
    }
    if (entry.isFile()) {
      await cp(sourcePath, destinationPath)
    }
  }
}

await rm(destinationRoot, { recursive: true, force: true })
await copyDirectory(sourceRoot, destinationRoot)
process.stdout.write(`Copied filtered shared skills to ${relative(process.cwd(), destinationRoot)}\n`)
