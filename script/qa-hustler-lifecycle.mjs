#!/usr/bin/env bun

import { join, resolve } from "node:path"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  assert,
  assertExact,
  abortResponseSummary,
  cleanupProcess,
  cleanupSandbox,
  cancellationEventTimeline,
  finishWorkflow,
  hostSessionCount,
  jsonBody,
  makeSandbox,
  openSse,
  persistedSummary,
  redact,
  request,
  startProcess,
  updateOpenCodeConfig,
  waitFor,
  waitForPort,
} from "./qa-hustler-lifecycle-support.mjs"

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const fakeProvider = join(repoRoot, ".agents", "skills", "opencode-qa", "scripts", "lib", "fake-openai-server.mjs")
const scenarios = [
  { name: "tier0-success", marker: "HUSTLER_E2E_TIER0_SUCCESS", tier: 0, terminal: "completed" },
  { name: "tier2-success", marker: "HUSTLER_E2E_TIER2_SUCCESS", tier: 2, terminal: "completed" },
  { name: "tester-reject-retry", marker: "HUSTLER_E2E_TIER2_TESTER_REJECT", tier: 2, terminal: "completed", testerReject: true },
  { name: "approver-reject-retry", marker: "HUSTLER_E2E_TIER2_APPROVER_REJECT", tier: 2, terminal: "completed", approverReject: true },
  { name: "provider-failure", marker: "HUSTLER_E2E_PROVIDER_FAILURE", tier: 0, terminal: "failed" },
  { name: "tool-failure", marker: "HUSTLER_E2E_TOOL_FAILURE", tier: 0, terminal: "failed" },
  { name: "cancel", marker: "HUSTLER_E2E_CANCEL", tier: 0, terminal: "cancelled" },
]

const { createHustlerLifecycleAdapter, createHustlerWorkflowIdentity, getHustlerWorkflowPath } = await import(pathToFileURL(join(repoRoot, "packages", "omo-opencode", "src", "features", "hustler", "lifecycle-state.ts")).href)

function scenarioPrompt(scenario) {
  return scenario.tier >= 2
    ? `${scenario.marker}: implement a multi-file frontend, backend, and database change across modules`
    : scenario.marker
}

function workflowConfig(tasksPath) {
  return { sisyphus: { tasks: { storage_path: tasksPath } } }
}

async function createSession(baseUrl, password, directory, title) {
  const result = await request(baseUrl, password, `/session?directory=${encodeURIComponent(directory)}`, { method: "POST", ...jsonBody({ title }) })
  const sessionId = result.body?.id ?? result.body?.data?.id
  assert(typeof sessionId === "string" && sessionId.length > 0, "Session creation response did not contain an ID")
  return sessionId
}

async function runScenario(baseUrl, password, sandbox, scenario, fakePort) {
  const sse = await openSse(baseUrl, password, join(sandbox.root, "project"))
  await sse.ready
  let abortResult
  let persistedSnapshot
  try {
    const sessionId = await createSession(baseUrl, password, join(sandbox.root, "project"), `HUSTLER ${scenario.name}`)
    const identity = createHustlerWorkflowIdentity({ sessionId })
    const controlResponse = await fetch(`http://127.0.0.1:${fakePort}/control`, { method: "POST", ...jsonBody({ scenario: scenario.marker, workflowId: identity.workflowId, taskId: identity.taskId }) })
    assert(controlResponse.status === 204, `${scenario.name} fake provider control returned ${controlResponse.status}, expected 204`)
    await request(baseUrl, password, `/session/${sessionId}/prompt_async?directory=${encodeURIComponent(join(sandbox.root, "project"))}`, { method: "POST", ...jsonBody({ parts: [{ type: "text", text: scenarioPrompt(scenario) }] }) })
    if (scenario.marker === "HUSTLER_E2E_CANCEL") {
      await waitFor(`${scenario.name} session busy`, () => sse.events.some(event => event.type === "session.status"
        && event.properties?.sessionID === sessionId
        && event.properties?.status?.type === "busy"))
      abortResult = await request(baseUrl, password, `/session/${sessionId}/abort?directory=${encodeURIComponent(join(sandbox.root, "project"))}`, { method: "POST", ...jsonBody({}) })
    }
    const lifecycleEvents = await waitFor(`${scenario.name} terminal lifecycle SSE event`, () => {
      const events = sse.events.filter(event => ["session.created", "session.idle", "session.error", "message.updated", "message.part.updated"].includes(event.type))
      const terminalObserved = scenario.terminal === "completed"
        ? events.some(event => event.type === "session.idle" || event.type === "message.updated")
        : events.some(event => event.type === "session.error" || event.type === "session.idle")
      return terminalObserved ? events : false
    })
    assert(sse.errors.length === 0, `${scenario.name} SSE observer failed: ${sse.errors.join("; ")}`)
    const adapter = createHustlerLifecycleAdapter(workflowConfig(join(sandbox.root, "tasks")))
    const persisted = await waitFor(`${scenario.name} persisted workflow state`, () => {
      const record = adapter.load(identity.workflowId)
      if (record) persistedSnapshot = record
      return scenario.terminal === "completed"
        ? (record?.status === "active" || record?.status === "completed" ? record : false)
        : (record?.status === scenario.terminal ? record : false)
    })
    const final = scenario.terminal === "completed" ? await finishWorkflow(adapter, identity.workflowId, scenario, join(sandbox.root, "tasks"), getHustlerWorkflowPath) : persisted
    assert(final.status === scenario.terminal, `${scenario.name} persisted status mismatch`)
    assert(final.classification.tier === scenario.tier, `${scenario.name} classification tier mismatch`)
    assert(final.events.length > 0, `${scenario.name} persisted no lifecycle events`)
    if (scenario.testerReject || scenario.approverReject) assert(final.state.retryCount > 0, `${scenario.name} persisted no retry transition`)
    if (scenario.terminal === "failed") assert(final.events.some(event => event.operation === "fail"), `${scenario.name} persisted no fail operation`)
    if (scenario.terminal === "cancelled") assert(final.events.some(event => event.operation === "cancel"), `${scenario.name} persisted no cancel operation`)
    return {
      name: scenario.name,
      expectedTerminal: scenario.terminal,
      api: { sessionCreated: true, control: { status: controlResponse.status, accepted: controlResponse.ok }, promptSubmitted: true },
      sse: { types: [...new Set(lifecycleEvents.map(event => event.type))].sort(), terminalObserved: true },
      persisted: { workflowId: identity.workflowId, status: final.status, phase: final.state.phase, revision: final.revision, lifecycleEventCount: final.events.length, retryCount: final.state.retryCount },
      ...(scenario.marker === "HUSTLER_E2E_CANCEL" ? {
        cancellation: {
          abortResponse: abortResponseSummary(abortResult),
          sseTimeline: cancellationEventTimeline(sse.events, sessionId),
          persisted: persistedSummary(final),
        },
      } : {}),
    }
  } catch (error) {
    const eventShapes = sse.events.map(event => ({
      type: event.type,
      propertyKeys: Object.keys(event.properties ?? {}).sort(),
    }))
    const wrapped = new Error(`${errorText(error)}; observed SSE event shapes: ${JSON.stringify(eventShapes)}`)
    if (scenario.marker === "HUSTLER_E2E_CANCEL") {
      wrapped.cancellationEvidence = {
        abortResponse: abortResponseSummary(abortResult),
        sseTimeline: cancellationEventTimeline(sse.events, sessionId),
        persisted: persistedSummary(persistedSnapshot),
      }
    }
    throw wrapped
  } finally {
    await sse.close()
  }
}

function evidenceDirectory(argv) {
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument.startsWith("--evidence-dir=")) return resolve(argument.slice("--evidence-dir=".length))
    if (argument === "--evidence-dir") {
      const value = argv[index + 1]
      if (!value || value.startsWith("--")) throw new Error("--evidence-dir requires a path")
      return resolve(value)
    }
  }
  return undefined
}

function errorText(error) {
  return redact(error instanceof Error ? error.stack ?? error.message : error)
}

async function writeReceipt(directory, receipt) {
  if (!directory) return undefined
  try {
    await mkdir(directory, { recursive: true })
    await writeFile(join(directory, "lifecycle-receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`)
    return undefined
  } catch (error) {
    return errorText(error)
  }
}

async function main() {
  const evidenceDir = evidenceDirectory(process.argv.slice(2))
  const hostBefore = await hostSessionCount()
  const sandbox = await makeSandbox(repoRoot)
  const fake = startProcess("bun", ["run", "--bun", fakeProvider], { ...process.env, HUSTLER_FAKE_PROVIDER: "1", FAKE_LLM_LOG: join(sandbox.root, "fake-provider.log") }, sandbox.root)
  const server = { child: null, getStderr: () => "" }
  let results = []
  let roster = []
  let hostAfter = { count: null }
  let failure
  let cancellationEvidence
  let receiptError
  try {
    const fakePort = Number(await waitForPort(fake, /fake-openai listening on (\d+)/))
    await updateOpenCodeConfig(sandbox, fakePort)
    const port = 43800 + (process.pid % 500)
    server.child = startProcess("opencode", ["serve", "--port", String(port), "--hostname", "127.0.0.1"], {
      ...process.env,
      HOME: join(sandbox.root, "home"), XDG_CONFIG_HOME: join(sandbox.root, "config"), XDG_DATA_HOME: join(sandbox.root, "data"), XDG_CACHE_HOME: join(sandbox.root, "cache"), XDG_STATE_HOME: join(sandbox.root, "state"),
      OPENCODE_DISABLE_AUTOUPDATE: "1", OPENCODE_DISABLE_MODELS_FETCH: "1", OPENCODE_SERVER_PASSWORD: "hustler-qa-local",
    }, join(sandbox.root, "project"))
    const baseUrl = `http://127.0.0.1:${port}`
    await waitFor("OpenCode health", async () => {
      try { return (await request(baseUrl, "hustler-qa-local", "/global/health")).body?.healthy === true } catch { return false }
    })
    const agents = (await request(baseUrl, "hustler-qa-local", `/agent?directory=${encodeURIComponent(join(sandbox.root, "project"))}`, {
      signal: AbortSignal.timeout(15_000),
    })).body
    const agentValues = Array.isArray(agents) ? agents : Array.isArray(agents?.data) ? agents.data : Object.values(agents ?? {})
    roster = agentValues.map(agent => String(agent.name ?? agent.id ?? agent).toLowerCase()).filter(Boolean)
    const hustlerRoles = ["orchestrator", "planner", "developer", "tester", "approver", "librarian", "architect"]
    assertExact(roster.filter(name => hustlerRoles.includes(name)), hustlerRoles, "active HUSTLER roster")
    assert(!roster.some(name => /^team[_-]/i.test(String(name))), "Team Mode agent leaked into active roster")
    for (const scenario of scenarios) results.push(await runScenario(baseUrl, "hustler-qa-local", sandbox, scenario, fakePort))
    const log = await readFile(join(sandbox.root, "fake-provider.log"), "utf8").catch(() => "")
    assert(!/team_[a-z0-9_-]+/i.test(log), "Fake-provider request log observed a team tool")
    hostAfter = await hostSessionCount()
    assert(hostBefore.count === hostAfter.count, `Host OpenCode session count changed: ${hostBefore.count} -> ${hostAfter.count}`)
  } catch (error) {
    failure = errorText(error)
    cancellationEvidence = error.cancellationEvidence
    throw error
  } finally {
    const cleanup = { serverStopped: false, fakeProviderStopped: false, sandboxRemoved: false, receiptWrittenBeforeSandboxRemoval: false }
    try {
      await cleanupProcess(server.child ? server.child : undefined)
    } catch (error) {
      cleanup.serverError = errorText(error)
    }
    cleanup.serverStopped = server.child?.exitCode !== null
    try {
      await cleanupProcess(fake)
    } catch (error) {
      cleanup.fakeProviderError = errorText(error)
    }
    cleanup.fakeProviderStopped = fake.child?.exitCode !== null
    hostAfter = await hostSessionCount().catch(error => ({ count: null, error: errorText(error) }))
    const completedAllScenarios = results.length === scenarios.length
    receiptError = await writeReceipt(evidenceDir, {
      status: failure || !completedAllScenarios ? "failed" : "passed",
      testedScenarios: scenarios.map(scenario => ({ name: scenario.name, expectedTerminal: scenario.terminal })),
      observed: { roster: completedAllScenarios ? "validated" : "not reached", teamMode: false, scenarios: results, cancellation: cancellationEvidence ?? results.find(result => result.name === "cancel")?.cancellation ?? null, fakeProviderLog: "redacted sandbox log inspected" },
      hostDb: { before: hostBefore.count, after: hostAfter.count, unchanged: hostAfter.count === hostBefore.count },
      cleanup: { ...cleanup, receiptWrittenBeforeSandboxRemoval: true, sandboxRemoval: "performed immediately after receipt write" },
      omissions: ["Provider secrets, raw logs, prompt contents, and sandbox files were omitted."],
      error: failure ?? null,
    })
    try {
      await cleanupSandbox(sandbox.root)
      cleanup.sandboxRemoved = true
    } catch (error) {
      cleanup.sandboxRemovalError = errorText(error)
    }
    if (receiptError && !failure) throw new Error(`Unable to write lifecycle evidence receipt: ${receiptError}`)
  }
  process.stdout.write(JSON.stringify({ roster, teamMode: false, hostSessionCount: { before: hostBefore.count, after: hostAfter.count }, scenarios: results, evidenceDir: evidenceDir ?? null }) + "\n")
}

main().catch(error => {
  process.stderr.write(`${errorText(error)}\n`)
  process.exitCode = 1
})
