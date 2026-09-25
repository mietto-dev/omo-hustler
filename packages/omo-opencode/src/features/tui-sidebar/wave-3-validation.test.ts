import { afterAll, describe, expect, it } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { classifyTask } from "../opencode-tasks/orchestrator-classification"
import { createHustlerLifecycleAdapter } from "../hustler/lifecycle-state"
import { computeView, viewKey } from "./compute-view"
import { deriveHustlerWorkflow } from "./derivers"
import { buildViewNodes, describeView } from "./render-view"
import { buildTuiRuntimeSnapshot } from "./snapshot-builder"
import { MIRROR_SCHEMA_VERSION } from "./constants"
import { parseSnapshot } from "./snapshot-schema"
import type { TuiHustlerWorkflow } from "./snapshot-schema"
import type { ComputeViewSections } from "./compute-view"
import type { SidebarView } from "./state-types"

const theme = {
  accent: "accent",
  borderSubtle: "border",
  error: "error",
  info: "info",
  success: "success",
  text: "text",
  textMuted: "muted",
  warning: "warning",
}

const roster = { kind: "rows" as const, rows: [{ label: "orchestrator", model: "gpt-5.5" }] }
const noRuntimeSections: Omit<ComputeViewSections, "hustler"> = {
  config: { kind: "valid" },
  roster,
  agents: { kind: "none" },
  jobs: { kind: "none" },
  loop: { kind: "none" },
}

const activeWorkflow: TuiHustlerWorkflow = {
  activeRole: "planner",
  phase: "planning",
  plannerGate: "required",
  workItem: { id: "work-planner", role: "planner", status: "running" },
  reviewState: "not-started",
  terminalStatus: "active",
}

const baseSnapshot = {
  version: MIRROR_SCHEMA_VERSION,
  projectDir: "/tmp/project",
  updatedAt: Date.now(),
  activeAgents: [],
  jobBoard: [],
  loop: null,
}

const tempDirs: string[] = []

function makeTempDir(label: string): string {
  const directory = mkdtempSync(join(tmpdir(), `omo-wave-3-${label}-`))
  tempDirs.push(directory)
  return directory
}

function createEmptyMirrorClient() {
  return {
    session: {
      status: async () => ({ data: {} }),
      messages: async () => ({ data: [] }),
    },
  }
}

function createEmptyBackgroundManager() {
  return { getTasksSnapshot: () => [] }
}

function workflowState(workflow: TuiHustlerWorkflow, terminalStatus = workflow.terminalStatus): SidebarView {
  return computeView({
    ...noRuntimeSections,
    hustler: { kind: "workflow", workflow: { ...workflow, terminalStatus } },
  })
}

afterAll(() => {
  for (const directory of tempDirs) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe("Wave 3 TUI mirror and HUSTLER rendering boundaries", () => {
  it("#given a Tier 2 lifecycle record #when building the mirror #then it projects only redacted workflow fields", async () => {
    // given
    const storagePath = makeTempDir("workflow-storage")
    const projectDir = makeTempDir("project")
  const config = { sisyphus: { tasks: { storage_path: storagePath } } }
    const adapter = createHustlerLifecycleAdapter(config)
    const created = adapter.create({
      sessionId: "ses-private",
      workflowId: "workflow-private",
      taskId: "task-private",
      classification: classifyTask({ expectedFiles: 1, tierOverride: 2 }),
    })
    const running = adapter.recordWorkItem(created.identity.workflowId, {
      eventKey: "work:planner",
      workerId: "planner-private",
      role: "planner",
      status: "running",
      workItemId: "work-visible",
    })

    // when
    const snapshot = await buildTuiRuntimeSnapshot({
      projectDir,
      client: createEmptyMirrorClient(),
      backgroundManager: createEmptyBackgroundManager(),
      getHustlerWorkflow: () => running,
    })

    // then
    expect(snapshot.hustlerWorkflow).toEqual({
      activeRole: "planner",
      phase: "routing",
      plannerGate: "required",
      workItem: { id: "work-visible", role: "planner", status: "running" },
      reviewState: "not-started",
      terminalStatus: "active",
    })
    expect(parseSnapshot(snapshot)).toEqual(snapshot)
    expect(JSON.stringify(snapshot)).not.toContain("ses-private")
    expect(JSON.stringify(snapshot)).not.toContain("workflow-private")
    expect(JSON.stringify(snapshot)).not.toContain("task-private")
  })

  it("#given a v2 snapshot without workflow data #when deriving the TUI state #then it preserves optional legacy compatibility", () => {
    // given
    const parsed = parseSnapshot(baseSnapshot)

    // when
    const workflow = deriveHustlerWorkflow(parsed)

    // then
    expect(parsed).not.toBeNull()
    expect(workflow).toEqual({ kind: "none" })
  })

  it("#given unknown workflow text or an invalid role #when parsing the snapshot #then it rejects the payload", () => {
    // given
    const withPrivateText = {
      ...baseSnapshot,
      hustlerWorkflow: { ...activeWorkflow, privateText: "private prompt" },
    }
    const withInvalidRole = {
      ...baseSnapshot,
      hustlerWorkflow: { ...activeWorkflow, activeRole: "legacy-agent" },
    }

    // when
    const privateTextResult = parseSnapshot(withPrivateText)
    const invalidRoleResult = parseSnapshot(withInvalidRole)

    // then
    expect(privateTextResult).toBeNull()
    expect(invalidRoleResult).toBeNull()
  })

  it("#given an active HUSTLER workflow #when computing and rendering the view #then it shows role phase work item review and terminal status", () => {
    // given
    const view = workflowState(activeWorkflow)

    // when
    const description = describeView(view)
    const nodes = buildViewNodes(view, theme)

    // then
    expect(view.kind).toBe("active")
    expect(description).toContain("HUSTLER")
    expect(description).toContain("current role Planner")
    expect(description).toContain("phase planning")
    expect(description).toContain("planner gate required")
    expect(description).toContain("work item work-planner Planner running")
    expect(description).toContain("review not-started")
    expect(description).toContain("terminal active")
    expect(nodes[0]?.kind).toBe("box")
  })

  it("#given a completed HUSTLER workflow #when computing the view #then it keeps the workflow visible in the idle state", () => {
    // given
    const view = workflowState({ ...activeWorkflow, terminalStatus: "completed" })

    // when
    const description = describeView(view)

    // then
    expect(view.kind).toBe("idle")
    expect(description).toContain("HUSTLER")
    expect(description).toContain("terminal completed")
    expect(description).toContain("orchestrator gpt-5.5")
  })

  it("#given equivalent workflow views and one changed workflow value #when computing view keys #then equivalent keys stay stable and changes invalidate them", () => {
    // given
    const first: SidebarView = workflowState(activeWorkflow)
    const equivalent: SidebarView = workflowState({ ...activeWorkflow })
    const changed: SidebarView = workflowState({ ...activeWorkflow, phase: "review" })

    // when
    const firstKey = viewKey(first)
    const equivalentKey = viewKey(equivalent)
    const changedKey = viewKey(changed)

    // then
    expect(equivalentKey).toBe(firstKey)
    expect(changedKey).not.toBe(firstKey)
  })

  it("#given generic sections with no HUSTLER workflow #when computing and rendering #then omission matches an explicit empty workflow", () => {
    // given
    const genericSections: ComputeViewSections = {
      ...noRuntimeSections,
      agents: { kind: "list", agents: [{ name: "orchestrator", status: "running" }] },
    }

    // when
    const omitted = computeView(genericSections)
    const explicit = computeView({ ...genericSections, hustler: { kind: "none" } })

    // then
    expect(omitted).toEqual(explicit)
    expect(viewKey(omitted)).toBe(viewKey(explicit))
    expect(describeView(omitted)).toBe(describeView(explicit))
    expect(buildViewNodes(omitted, theme)).toEqual(buildViewNodes(explicit, theme))
  })
})
