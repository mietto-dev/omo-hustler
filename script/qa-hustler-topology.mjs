#!/usr/bin/env bun

import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { spawn } from "node:child_process"

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const pluginPath = join(repoRoot, "dist", "index.js")
const workflowPath = join(repoRoot, "packages", "hustler", "src", "orchestrator.ts")
const timeoutMs = 12_000

function fail(message) {
  throw new Error(message)
}

async function waitForHealth(url, auth) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/global/health`, {
        headers: { authorization: `Basic ${Buffer.from(`opencode:${auth}`).toString("base64")}` },
        signal: AbortSignal.timeout(1_000),
      })
      if (response.ok) return
    } catch (error) {
      if (!(error instanceof Error)) fail("OpenCode health probe failed with a non-Error value")
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  fail("OpenCode server did not become healthy")
}

async function readSse(url, auth, directory) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10_000)
  try {
    const response = await fetch(`${url}/event?directory=${encodeURIComponent(directory)}`, {
      headers: { authorization: `Basic ${Buffer.from(`opencode:${auth}`).toString("base64")}` },
      signal: controller.signal,
    })
    if (!response.ok || response.body === null) fail(`SSE endpoint returned ${response.status}`)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let text = ""
    while (!text.includes("server.connected")) {
      const { value, done } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    if (!text.includes("server.connected")) fail(`SSE stream did not emit server.connected: ${text}`)
  } finally {
    clearTimeout(timer)
    controller.abort()
  }
}

async function probeWorkflow(entrypoint) {
  const tier0 = entrypoint.startHustlerWorkflow({
    taskId: "topology-tier-0",
    signals: { localized: true, expectedFiles: 1 },
  })
  if (tier0.state.phase !== "implementation") fail(`Tier 0 started in ${tier0.state.phase}`)

  const tier2 = entrypoint.startHustlerWorkflow({
    taskId: "topology-tier-2",
    signals: { layers: 2 },
  })
  if (tier2.classification.tier !== 2 || tier2.state.phase !== "planning") {
    fail(`Tier 2 gate failed: ${JSON.stringify(tier2)}`)
  }
}

async function probeOpenCode() {
  const root = await mkdtemp(join("/tmp", "hustler-topology-"))
  const dirs = ["config/opencode", "data", "cache", "state", "home", "project"]
  await Promise.all(dirs.map((dir) => mkdir(join(root, dir), { recursive: true })))
  const configPath = join(root, "config", "opencode", "opencode.json")
  await writeFile(configPath, `${JSON.stringify({ plugin: [pathToFileURL(pluginPath).href] })}\n`)
  const port = 43000 + Math.floor(Math.random() * 1000)
  const password = `hustler-${process.pid}`
  const server = spawn("opencode", ["serve", "--port", String(port), "--hostname", "127.0.0.1"], {
    cwd: join(root, "project"),
    env: {
      ...process.env,
      HOME: join(root, "home"),
      XDG_CONFIG_HOME: join(root, "config"),
      XDG_DATA_HOME: join(root, "data"),
      XDG_CACHE_HOME: join(root, "cache"),
      XDG_STATE_HOME: join(root, "state"),
      OPENCODE_DISABLE_AUTOUPDATE: "1",
      OPENCODE_DISABLE_MODELS_FETCH: "1",
      OPENCODE_SERVER_PASSWORD: password,
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let stderr = ""
  server.stderr.on("data", (chunk) => { stderr += chunk })
  try {
    const url = `http://127.0.0.1:${port}`
    await waitForHealth(url, password)
    const health = await fetch(`${url}/global/health`, {
      headers: { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` },
    })
    if (!(await health.json()).healthy) fail("OpenCode health response was not healthy")
    await readSse(url, password, join(root, "project"))
  } catch (error) {
    fail(`${error.message}\n${stderr}`)
  } finally {
    server.kill("SIGTERM")
    await rm(root, { recursive: true, force: true })
  }
}

async function main() {
  const packageJson = JSON.parse(await readFile(join(repoRoot, "packages", "hustler", "package.json"), "utf8"))
  if (packageJson.name !== "@oh-my-opencode/hustler") fail("Unexpected HUSTLER package identity")
  const workflow = await import(pathToFileURL(workflowPath).href)
  if (typeof workflow.startHustlerWorkflow !== "function") fail("HUSTLER workflow source does not export the workflow")
  await probeWorkflow(workflow)
  await probeOpenCode()
  process.stdout.write(JSON.stringify({
    package: packageJson.name,
    workflow: { tier0: "implementation", tier2: "planning" },
    opencode: { plugin: pluginPath, server: "healthy", sse: "server.connected" },
  }) + "\n")
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error}\n`)
  process.exitCode = 1
})
