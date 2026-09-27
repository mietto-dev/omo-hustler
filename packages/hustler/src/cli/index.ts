#!/usr/bin/env node

import { access, chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const args = process.argv.slice(2)

const version = "0.0.0-private"

function usage(): void {
  process.stdout.write("Usage: hustler-opencode <install>|[--help|--version]\n")
}

function homeDirectory(): string {
  const home = process.env.HOME
  if (home === undefined || home.length === 0) throw new Error("HOME is required to install the Hustler profile")
  return home
}

function profileDirectory(): string {
  return join(process.env.XDG_CONFIG_HOME ?? join(homeDirectory(), ".config"), "opencode", "profiles", "hustler")
}

function launcherPath(): string {
  return join(homeDirectory(), ".local", "bin", "opencode-hustler")
}

function pluginPath(): string {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
  return join(packageRoot, "dist", "index.js")
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`
}

async function install(): Promise<void> {
  const profile = profileDirectory()
  const configPath = join(profile, "opencode.json")
  const launcher = launcherPath()
  const plugin = pluginPath()

  await access(plugin)
  await mkdir(profile, { recursive: true })
  await mkdir(dirname(launcher), { recursive: true })

  let config: Record<string, unknown> = {}
  try {
    const existing = JSON.parse(await readFile(configPath, "utf8")) as unknown
    if (existing !== null && typeof existing === "object" && !Array.isArray(existing)) {
      config = existing as Record<string, unknown>
    }
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw new Error(`Failed to read Hustler profile config: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const plugins = Array.isArray(config.plugin) ? [...config.plugin] : []
  if (!plugins.includes(pathToFileURL(plugin).href)) plugins.push(pathToFileURL(plugin).href)
  config.plugin = plugins

  const configTemporary = `${configPath}.tmp-${process.pid}`
  await writeFile(configTemporary, `${JSON.stringify(config, null, 2)}\n`, "utf8")
  await rename(configTemporary, configPath)

  const launcherTemporary = `${launcher}.tmp-${process.pid}`
  const launcherContent = `#!/usr/bin/env bash
set -euo pipefail

export XDG_CONFIG_HOME=${shellQuote(profile)}
export OPENCODE_CONFIG_DIR=${shellQuote(profile)}
exec opencode "$@"
`
  await writeFile(launcherTemporary, launcherContent, { encoding: "utf8", mode: 0o755 })
  await chmod(launcherTemporary, 0o755)
  await rename(launcherTemporary, launcher)

  process.stdout.write(`Hustler profile installed: ${profile}\n`)
  process.stdout.write(`Launcher installed: ${launcher}\n`)
}

async function main(): Promise<void> {
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    usage()
    return
  }

  if (args.includes("--version") || args.includes("-v")) {
    process.stdout.write(`${version}\n`)
    return
  }

  if (args.length === 1 && args[0] === "install") {
    await install()
    return
  }

  process.stderr.write(`Unsupported Hustler CLI arguments: ${args.join(" ")}\n`)
  process.exitCode = 1
}

await main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
  process.exitCode = 1
})
