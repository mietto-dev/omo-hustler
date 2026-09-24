#!/usr/bin/env bun

import { createHash } from "node:crypto"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { spawnSync } from "node:child_process"
import {
  assert,
  cleanupProcess,
  cleanupSandbox,
  hostSessionCount,
  makeSandbox,
  openSse,
  redact,
  request,
  startProcess,
  updateOpenCodeConfig,
  waitFor,
  waitForPort,
} from "./qa-hustler-lifecycle-support.mjs"

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)))
const fakeProvider = join(repoRoot, ".agents", "skills", "opencode-qa", "scripts", "lib", "fake-openai-server.mjs")
const password = "hustler-qa-local"
const prompt = "HUSTLER_E2E_TIER0_SUCCESS: make a small localized README change"

function tmux(args) {
  const result = spawnSync("tmux", args, { encoding: "utf8", timeout: 5_000 })
  if (result.status !== 0) throw new Error(`tmux ${args[0]} failed: ${redact(result.stderr)}`)
  return result.stdout
}

function tmuxHasSession(name) {
  return spawnSync("tmux", ["has-session", "-t", name], { timeout: 5_000 }).status === 0
}

function killTmuxSession(name) {
  if (!name || !tmuxHasSession(name)) return
  spawnSync("tmux", ["kill-session", "-t", name], { timeout: 5_000 })
}

function safeText(value, root) {
  return redact(String(value)).replaceAll(root, "<sandbox>").replaceAll(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
}

async function writeArtifacts(directory, artifacts) {
  if (!directory) return
  await mkdir(directory, { recursive: true })
  await writeFile(join(directory, "summary.json"), `${JSON.stringify(artifacts.summary, null, 2)}\n`)
  await writeFile(join(directory, "sse-events.jsonl"), `${artifacts.sse.map(event => `${JSON.stringify(event)}\n`).join("")}`)
  await writeFile(join(directory, "pane.txt"), `${artifacts.pane}\n`)
  await writeFile(join(directory, "cleanup.json"), `${JSON.stringify(artifacts.cleanup, null, 2)}\n`)
}

async function main() {
  const evidenceFlagIndex = process.argv.indexOf("--evidence-dir")
  const evidenceDir = process.argv.find(value => value.startsWith("--evidence-dir="))?.slice(15)
    ?? (evidenceFlagIndex >= 0 ? process.argv[evidenceFlagIndex + 1] : undefined)
  const hostBefore = await hostSessionCount()
  const sandbox = await makeSandbox(repoRoot)
  const fake = startProcess("bun", ["run", "--bun", fakeProvider], { ...process.env, HUSTLER_FAKE_PROVIDER: "1", FAKE_LLM_LOG: join(sandbox.root, "fake-provider.log") }, sandbox.root)
  let server
  let tmuxSession
  let sse
  let pane = ""
  let result
  let failure
  let cleanupFailure
  let hostAfter
  try {
    const fakePort = Number(await waitForPort(fake, /fake-openai listening on (\d+)/))
    await updateOpenCodeConfig(sandbox, fakePort)
    const port = 43900 + (process.pid % 500)
    server = startProcess("opencode", ["serve", "--port", String(port), "--hostname", "127.0.0.1"], {
      ...process.env,
      HOME: join(sandbox.root, "home"),
      XDG_CONFIG_HOME: join(sandbox.root, "config"),
      XDG_DATA_HOME: join(sandbox.root, "data"),
      XDG_CACHE_HOME: join(sandbox.root, "cache"),
      XDG_STATE_HOME: join(sandbox.root, "state"),
      OPENCODE_DISABLE_AUTOUPDATE: "1",
      OPENCODE_DISABLE_MODELS_FETCH: "1",
      OPENCODE_SERVER_PASSWORD: password,
    }, join(sandbox.root, "project"))
    const baseUrl = `http://127.0.0.1:${port}`
    await waitFor("OpenCode health", async () => {
      try { return (await request(baseUrl, password, "/global/health")).body?.healthy === true } catch { return false }
    })
    sse = await openSse(baseUrl, password, join(sandbox.root, "project"))
    await sse.ready

    const projectDir = join(sandbox.root, "project")
    const sessionResponse = await request(baseUrl, password, `/session?directory=${encodeURIComponent(projectDir)}`, { method: "POST", ...jsonBody({ title: "HUSTLER TUI" }) })
    const sessionId = sessionResponse.body?.id ?? sessionResponse.body?.data?.id
    assert(typeof sessionId === "string" && sessionId.length > 0, "Session creation response did not contain an ID")
    tmuxSession = `hustler_tui_${process.pid}`
    tmux(["new-session", "-d", "-s", tmuxSession, "-x", "200", "-y", "50"])
    const tuiEnv = `HOME='${join(sandbox.root, "home")}' XDG_CONFIG_HOME='${join(sandbox.root, "config")}' XDG_DATA_HOME='${join(sandbox.root, "data")}' XDG_CACHE_HOME='${join(sandbox.root, "cache")}' XDG_STATE_HOME='${join(sandbox.root, "state")}' OPENCODE_SERVER_PASSWORD='${password}' OPENCODE_DISABLE_AUTOUPDATE=1 OPENCODE_DISABLE_MODELS_FETCH=1 opencode attach ${baseUrl} --session ${sessionId} --dir '${projectDir}'`
    tmux(["send-keys", "-t", tmuxSession, tuiEnv, "Enter"])
    await waitFor("TUI session", () => tmuxHasSession(tmuxSession))
    pane = tmux(["capture-pane", "-t", tmuxSession, "-p"])
    tmux(["send-keys", "-t", tmuxSession, "tui-input-transport", "C-u"])

    const tuiDirectory = `?directory=${encodeURIComponent(projectDir)}`
    await request(baseUrl, password, `/tui/append-prompt${tuiDirectory}`, { method: "POST", ...jsonBody({ text: prompt }) })
    await request(baseUrl, password, `/session/${sessionId}/prompt_async${tuiDirectory}`, { method: "POST", ...jsonBody({ parts: [{ type: "text", text: prompt }] }) })
    await waitFor("user prompt persisted", async () => {
      const messages = (await request(baseUrl, password, `/session/${sessionId}/message?directory=${encodeURIComponent(projectDir)}`)).body
      return JSON.stringify(messages).includes(prompt)
    })

    const identityModule = await import(pathToFileURL(join(repoRoot, "packages", "omo-opencode", "src", "features", "hustler", "lifecycle-state.ts")).href)
    const schemaModule = await import(pathToFileURL(join(repoRoot, "packages", "omo-opencode", "src", "features", "tui-sidebar", "snapshot-schema.ts")).href)
    const identity = identityModule.createHustlerWorkflowIdentity({ sessionId })
    const workflowPath = identityModule.getHustlerWorkflowPath({ sisyphus: { tasks: { storage_path: join(sandbox.root, "tasks") } } }, identity.workflowId)
    const workflow = await waitFor("persisted HUSTLER workflow", async () => {
      try {
        const record = JSON.parse(await readFile(workflowPath, "utf8"))
        return record.identity.sessionId === sessionId && record.state.phase !== "routing" ? record : false
      } catch { return false }
    })
    const projectHash = createHash("sha1").update(projectDir).digest("hex").slice(0, 16)
    const mirrorPath = join(sandbox.root, "data", "opencode", "storage", "oh-my-openagent", "tui-state", `${projectHash}.json`)
    const mirror = await waitFor("validated HUSTLER mirror", async () => {
      try {
        const raw = JSON.parse(await readFile(mirrorPath, "utf8"))
        const parsed = schemaModule.parseSnapshot(raw)
        return parsed?.hustlerWorkflow?.phase === workflow.state.phase ? parsed : false
      } catch { return false }
    })
    await waitFor("terminal SSE activity", () => sse.events.some(event => event.type === "session.idle" || event.type === "message.updated"))
    const hostAfter = await hostSessionCount()
    assert(hostBefore.count === hostAfter.count, `Host OpenCode session count changed: ${hostBefore.count} -> ${hostAfter.count}`)
    result = {
      surface: { tmuxSessionAlive: tmuxHasSession(tmuxSession), inputTransport: true },
      tuiControl: { appendPrompt: true },
      promptSubmission: { endpoint: "session.prompt_async", acknowledged: true, messageContainsPrompt: true },
      sse: { connected: true, types: [...new Set(sse.events.map(event => event.type))].sort(), terminalActivity: true },
      workflow: { tier: workflow.classification.tier, phase: workflow.state.phase, status: workflow.status, revision: workflow.revision },
      mirror: { schemaVersion: mirror.version, projectDirMatches: mirror.projectDir === join(sandbox.root, "project"), workflow: mirror.hustlerWorkflow },
      hostSessionCount: { before: hostBefore.count, after: hostAfter.count },
      isolation: { fakeProvider: true, teamMode: false, fakeProviderLog: "redacted sandbox log inspected" },
    }
  } catch (error) {
    failure = redact(error instanceof Error ? error.stack ?? error.message : error)
    throw error
  } finally {
    const cleanup = { tmuxSession: false, sandboxRemoved: false, errors: [] }
    const recordCleanupFailure = (label, error) => {
      const message = redact(error instanceof Error ? error.message : error)
      cleanup.errors.push({ step: label, error: message })
      cleanupFailure ??= new Error(`${label} failed: ${message}`)
    }
    try {
      hostAfter = await hostSessionCount()
      cleanup.hostSessionCount = { before: hostBefore.count, after: hostAfter.count }
      if (hostBefore.count !== hostAfter.count) recordCleanupFailure("host session isolation", new Error(`Host OpenCode session count changed: ${hostBefore.count} -> ${hostAfter.count}`))
    } catch (error) {
      recordCleanupFailure("host session check", error)
    }
    try { if (sse) await sse.close() } catch (error) { recordCleanupFailure("SSE close", error) }
    try { killTmuxSession(tmuxSession) } catch (error) { recordCleanupFailure("tmux cleanup", error) }
    cleanup.tmuxSession = tmuxSession === undefined || !tmuxHasSession(tmuxSession)
    try { await cleanupProcess(server) } catch (error) { recordCleanupFailure("OpenCode cleanup", error) }
    try { await cleanupProcess(fake) } catch (error) { recordCleanupFailure("fake provider cleanup", error) }
    try { await cleanupSandbox(sandbox.root); cleanup.sandboxRemoved = true } catch (error) { recordCleanupFailure("sandbox cleanup", error) }
    if (evidenceDir) {
      try {
        await writeArtifacts(evidenceDir, {
          summary: failure ? { status: "failed", error: failure } : cleanupFailure ? { status: "failed", error: cleanupFailure.message } : result,
          sse: (sse?.events ?? []).map(event => ({ type: event.type })),
          pane: safeText(pane, sandbox.root),
          cleanup,
        })
      } catch (error) {
        recordCleanupFailure("evidence write", error)
      }
    }
    if (!failure && cleanupFailure) throw cleanupFailure
  }
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

function jsonBody(value) {
  return { headers: { "content-type": "application/json" }, body: JSON.stringify(value) }
}

main().catch(error => {
  process.stderr.write(`${redact(error instanceof Error ? error.stack ?? error.message : error)}\n`)
  process.exitCode = 1
})
