import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { spawn, spawnSync } from "node:child_process"

const WAIT_MS = 25_000
const POLL_MS = 100

export function fail(message) {
  throw new Error(message)
}

export function authHeaders(password) {
  return { authorization: `Basic ${Buffer.from(`opencode:${password}`).toString("base64")}` }
}

export async function request(baseUrl, password, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { ...authHeaders(password), ...(options.headers ?? {}) },
    signal: options.signal ?? AbortSignal.timeout(5_000),
  })
  const text = await response.text()
  let body = text
  try { body = JSON.parse(text) } catch {}
  if (!response.ok) fail(`${options.method ?? "GET"} ${path} returned ${response.status}: ${redact(text)}`)
  return { response, body }
}

export function redact(value) {
  return String(value)
    .replace(/(authorization|apiKey|api_key|password|token|secret)\s*[:=]\s*[^,\s}]+/gi, "$1=<redacted>")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer <redacted>")
}

export async function waitFor(label, predicate, timeoutMs = WAIT_MS) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await predicate()
    if (value) return value
    await new Promise(resolve => setTimeout(resolve, POLL_MS))
  }
  fail(`Timed out waiting for ${label} after ${timeoutMs}ms`)
}

export async function makeSandbox(repoRoot) {
  const root = await mkdtemp(join("/tmp", "hustler-lifecycle-"))
  await Promise.all(["config/opencode", "data", "cache", "state", "home", "project/.omo", "tasks"]
    .map(path => mkdir(join(root, path), { recursive: true })))
  const pluginPath = join(repoRoot, "packages", "omo-opencode", "src", "index.ts")
  const configPath = join(root, "config", "opencode", "opencode.jsonc")
  const omoConfigPath = join(root, "project", ".omo", "omo.jsonc")
  await writeFile(configPath, `${JSON.stringify({
    plugin: [`file://${pluginPath}`],
    model: "openai/gpt-fake",
    provider: { openai: { options: { apiKey: "fake-key", baseURL: "http://127.0.0.1:__FAKE_PORT__/v1" }, models: { "gpt-fake": { tool_call: true, limit: { context: 200000, output: 8192 } } } } },
    permission: { bash: "allow", task: "allow", call_omo_agent: "allow" },
  }, null, 2)}\n`)
  await writeFile(omoConfigPath, `${JSON.stringify({
    "[opencode]": {
      team_mode: { enabled: false },
      sisyphus: { tasks: { storage_path: join(root, "tasks") } },
    },
  }, null, 2)}\n`)
  return { root, configPath, omoConfigPath, pluginPath }
}

export async function updateOpenCodeConfig(sandbox, fakePort) {
  const text = await readFile(sandbox.configPath, "utf8")
  await writeFile(sandbox.configPath, text.replace("http://127.0.0.1:__FAKE_PORT__/v1", `http://127.0.0.1:${fakePort}/v1`))
}

export function startProcess(command, args, env, cwd) {
  const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] })
  let stderr = ""
  child.stderr.on("data", chunk => { stderr += String(chunk) })
  return { child, getStderr: () => redact(stderr) }
}

export async function waitForPort(processHandle, pattern, timeoutMs = 10_000) {
  let stdout = ""
  processHandle.child.stdout.on("data", chunk => { stdout += String(chunk) })
  return waitFor("child port", () => {
    const match = stdout.match(pattern)
    return match?.[1] ?? false
  }, timeoutMs)
}

export function stopProcess(processHandle) {
  if (!processHandle?.child || processHandle.child.exitCode !== null) return
  processHandle.child.kill("SIGTERM")
}

export async function cleanupProcess(processHandle) {
  stopProcess(processHandle)
  if (!processHandle?.child || processHandle.child.exitCode !== null) return
  await Promise.race([
    new Promise(resolve => processHandle.child.once("exit", resolve)),
    new Promise(resolve => setTimeout(() => { processHandle.child.kill("SIGKILL"); resolve() }, 2_000)),
  ])
}

export async function cleanupSandbox(root) {
  await rm(root, { recursive: true, force: true })
}

export async function openSse(baseUrl, password, directory) {
  const controller = new AbortController()
  const events = []
  const errors = []
  const stream = await fetch(`${baseUrl}/event?directory=${encodeURIComponent(directory)}`, {
    headers: authHeaders(password),
    signal: controller.signal,
  })
  if (!stream.ok || stream.body === null) fail(`SSE endpoint returned ${stream.status}`)
  const reader = stream.body.getReader()
  const decoder = new TextDecoder()
  const task = (async () => {
    let buffer = ""
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) return
        buffer += decoder.decode(value, { stream: true })
        const frames = buffer.split("\n\n")
        buffer = frames.pop() ?? ""
        for (const frame of frames) {
          const data = frame.split("\n").find(line => line.startsWith("data: "))?.slice(6)
          if (!data || data === "[DONE]") continue
          try { events.push(JSON.parse(data)) } catch {}
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && (!(error instanceof Error) || error.name !== "AbortError")) {
        errors.push(redact(error instanceof Error ? error.message : error))
      }
    }
  })()
  return { events, errors, ready: waitFor("server.connected", () => events.some(event => event.type === "server.connected")), close: async () => { controller.abort(); await task } }
}

export async function hostSessionCount() {
  const pathResult = spawnSync("opencode", ["db", "path"], { encoding: "utf8", timeout: 5_000 })
  if (pathResult.status !== 0) fail(`Unable to resolve host OpenCode DB path: ${redact(pathResult.stderr)}`)
  const dbPath = pathResult.stdout.trim()
  const query = spawnSync("sqlite3", ["-noheader", dbPath, "SELECT count(*) FROM session;"], { encoding: "utf8", timeout: 5_000 })
  if (query.status !== 0) fail(`Unable to read host OpenCode session count: ${redact(query.stderr)}`)
  const count = Number(query.stdout.trim())
  if (!Number.isInteger(count)) fail("Host OpenCode session count was not numeric")
  return { dbPath, count }
}

export function assert(condition, message) {
  if (!condition) fail(message)
}

export function assertExact(actual, expected, label) {
  const left = JSON.stringify([...actual].sort())
  const right = JSON.stringify([...expected].sort())
  assert(left === right, `${label}: expected ${right}, received ${left}`)
}
