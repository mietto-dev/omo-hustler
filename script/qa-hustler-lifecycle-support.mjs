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

export function jsonBody(value) {
  return { headers: { "content-type": "application/json" }, body: JSON.stringify(value) }
}

function redactedField(value) { return typeof value === "string" ? redact(value) : value }

function selectedFields(value, keys) {
  if (!value || typeof value !== "object") return redactedField(value)
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, key === "error" && value[key] && typeof value[key] === "object"
    ? selectedFields(value[key], ["name", "type", "code", "status", "message"])
    : redactedField(value[key])]))
}

export function cancellationEventTimeline(events, sessionId) {
  return events
    .filter(event => event.type === "server.connected"
      || event.properties?.sessionID === sessionId
      || event.properties?.sessionId === sessionId)
    .map((event, sequence) => {
      const properties = event.properties ?? {}
      return {
        sequence,
        type: redactedField(event.type),
        sessionID: redactedField(properties.sessionID ?? properties.sessionId),
        status: selectedFields(properties.status, ["type", "status", "reason", "message"]),
        error: selectedFields(properties.error, ["name", "type", "code", "status", "message"]),
        message: selectedFields(properties.message, ["id", "role", "status", "finish", "error"]),
      }
    })
}

export function persistedSummary(record) {
  if (!record) return null
  return {
    workflowId: redactedField(record.identity?.workflowId),
    status: redactedField(record.status),
    phase: redactedField(record.state?.phase),
    revision: record.revision,
    retryCount: record.state?.retryCount,
    lifecycleEventCount: Array.isArray(record.events) ? record.events.length : undefined,
    lastLifecycleOperation: redactedField(record.events?.at(-1)?.operation),
  }
}

export function abortResponseSummary(result) {
  if (!result) return null
  return {
    status: result.response.status,
    ok: result.response.ok,
    body: selectedFields(result.body, ["code", "status", "message", "error"]),
  }
}

export function review(status) { return {
    status,
    issues: status === "approved" ? [] : [{ severity: "medium", description: "fixture issue", requiredFix: "fixture retry", workItemId: "work-1" }],
    reviewSummary: "fixture review",
    verification: { tests: status === "approved" ? "pass" : "fail", build: "pass", lint: "pass", typecheck: "pass" },
  }
}

export function approval(accepted) { return {
    originalRequest: "HUSTLER_E2E",
    acceptanceCriteria: ["fixture work is complete"],
    completedWork: accepted ? ["fixture work is complete"] : [],
    unresolvedIssues: accepted ? [] : ["fixture approval rejection"],
    verification: { tests: accepted ? "pass" : "fail", build: "pass", lint: "pass", typecheck: "pass" },
  }
}

export async function advanceToReview(adapter, workflowId, record, tasksPath, getWorkflowPath) {
  let current = record
  if (current.state.phase === "planning") {
    const plan = { summary: "fixture plan", workItems: [{ id: "work-1", objective: "complete fixture work", scope: ["README.md"], dependencies: [], skills: [], acceptanceCriteria: ["fixture work is complete"] }], parallelGroups: [], risks: [], finalAcceptance: ["fixture work is complete"] }
    const path = getWorkflowPath({ sisyphus: { tasks: { storage_path: tasksPath } } }, workflowId)
    const persisted = JSON.parse(await readFile(path, "utf8"))
    persisted.state.plan = plan
    await writeFile(path, `${JSON.stringify(persisted, null, 2)}\n`)
    adapter.transition(workflowId, { eventKey: "qa:planner-attached", nextPhase: "implementation" })
    current = adapter.load(workflowId)
    assert(current?.state.plan?.summary === plan.summary, "Planner evidence was not persisted")
  }
  if (current?.state.phase === "implementation" && current.classification.tier >= 2) {
    adapter.transition(workflowId, { eventKey: `qa:integration:${current.revision}`, nextPhase: "integration" })
    current = adapter.load(workflowId)
  }
  if (current?.state.phase === "implementation" || current?.state.phase === "integration") {
    adapter.transition(workflowId, { eventKey: `qa:review:${current.revision}`, nextPhase: "review" })
    current = adapter.load(workflowId)
  }
  assert(current?.state.phase === "review", `Expected review phase, received ${current?.state.phase}`)
  return current
}

export async function finishWorkflow(adapter, workflowId, scenario, tasksPath, getWorkflowPath) {
  let current = adapter.load(workflowId)
  assert(current !== null, `Missing persisted workflow ${workflowId}`)
  current = await advanceToReview(adapter, workflowId, current, tasksPath, getWorkflowPath)
  if (scenario.testerReject) {
    current = adapter.recordTesterReview(workflowId, { eventKey: "qa:tester-reject", review: review("changes_requested"), workItemId: "work-1" })
    assert(current.state.retryCount === 1 && current.state.phase === "implementation", "Tester rejection did not create a retry route")
    current = await advanceToReview(adapter, workflowId, current, tasksPath, getWorkflowPath)
  }
  current = adapter.recordTesterReview(workflowId, { eventKey: scenario.testerReject ? "qa:tester-accept-after-retry" : "qa:tester-accept", review: review("approved"), workItemId: "work-1" })
  assert(current.state.phase === "acceptance", "Tester approval did not open acceptance")
  if (scenario.approverReject) {
    current = adapter.recordApproverResult(workflowId, { eventKey: "qa:approver-reject", result: approval(false), workItemId: "work-1" })
    assert(current.state.retryCount === 1 && current.state.phase === "implementation", "Approver rejection did not create a retry route")
    current = await advanceToReview(adapter, workflowId, current, tasksPath, getWorkflowPath)
    current = adapter.recordTesterReview(workflowId, { eventKey: "qa:tester-after-approver-retry", review: review("approved"), workItemId: "work-1" })
  }
  current = adapter.recordApproverResult(workflowId, { eventKey: scenario.approverReject ? "qa:approver-accept-after-retry" : "qa:approver-accept", result: approval(true), workItemId: "work-1" })
  current = adapter.complete(workflowId, { eventKey: "qa:complete" })
  assert(current.status === "completed" && current.state.phase === "complete", "Workflow did not reach terminal completion")
  return current
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
