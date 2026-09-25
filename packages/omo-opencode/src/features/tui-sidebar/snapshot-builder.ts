import { getLastAgentFromSession } from "../../hooks/atlas/session-last-agent"
import { normalizeSDKResponse } from "../../shared/normalize-sdk-response"
import { MIRROR_SCHEMA_VERSION } from "./constants"
import { readActiveLoop } from "./loop-reader"
import { canonicalProjectDir } from "./mirror-path"
import type { TuiHustlerWorkflow, TuiRuntimeSnapshot } from "./snapshot-schema"
import type { AgentStatus, JobRow } from "./state-types"
import type { BackgroundTaskSnapshot } from "../background-agent/types"
import type { HustlerLifecycleRecord } from "../hustler/lifecycle-state-schema"

export type TuiMirrorClient = {
  readonly session: {
    readonly status: () => Promise<unknown>
    readonly messages: (input: { readonly path: { readonly id: string } }) => Promise<unknown>
  }
}

export type SessionStatusRow = {
  readonly type: string
}

export type SessionStatusMap = Record<string, SessionStatusRow>

export type TuiBackgroundSnapshotProvider = {
  readonly getTasksSnapshot: () => readonly BackgroundTaskSnapshot[]
}

export type SessionAgentResolver = (sessionID: string, client: TuiMirrorClient) => Promise<string | null>

export type TuiHustlerWorkflowProvider = (
  statuses: SessionStatusMap,
) => HustlerLifecycleRecord | null

export type BuildTuiRuntimeSnapshotInput = {
  readonly client: TuiMirrorClient
  readonly projectDir: string
  readonly backgroundManager: TuiBackgroundSnapshotProvider
  readonly getStatuses?: () => Promise<SessionStatusMap>
  readonly sessionAgentResolver?: SessionAgentResolver
  readonly getHustlerWorkflow?: TuiHustlerWorkflowProvider
}

type ActiveAgentStatus = Extract<AgentStatus, "busy" | "retry" | "running">

export async function buildTuiRuntimeSnapshot(
  input: BuildTuiRuntimeSnapshotInput,
): Promise<TuiRuntimeSnapshot> {
  const statuses = await readStatuses(input)
  const loop = readActiveLoop(input.projectDir)
  const workflow = input.getHustlerWorkflow?.(statuses) ?? null

  return {
    version: MIRROR_SCHEMA_VERSION,
    projectDir: canonicalProjectDir(input.projectDir),
    updatedAt: Date.now(),
    activeAgents: await activeAgentsFromStatuses(statuses, input.client, input.sessionAgentResolver ?? getLastAgentFromSession),
    jobBoard: input.backgroundManager.getTasksSnapshot().map(toJobRow),
    loop: loop.kind === "live" ? redactLoopText(loop) : null,
    hustlerWorkflow: workflow === null ? null : projectHustlerWorkflow(workflow),
  }
}

async function readStatuses(input: BuildTuiRuntimeSnapshotInput): Promise<SessionStatusMap> {
  if (input.getStatuses) {
    return input.getStatuses()
  }

  const response = await input.client.session.status()
  return normalizeSDKResponse<SessionStatusMap>(response, {})
}

async function activeAgentsFromStatuses(
  statuses: SessionStatusMap,
  client: TuiMirrorClient,
  sessionAgentResolver: SessionAgentResolver,
): Promise<TuiRuntimeSnapshot["activeAgents"]> {
  const rows = Object.entries(statuses)
    .map(([sessionID, row]) => ({ sessionID, status: activeStatus(row.type) }))
    .filter((row): row is { readonly sessionID: string; readonly status: ActiveAgentStatus } => row.status !== null)

  return Promise.all(
    rows.map(async (row) => ({
      name: (await sessionAgentResolver(row.sessionID, client)) ?? row.sessionID,
      status: row.status,
    })),
  )
}

function activeStatus(status: string): ActiveAgentStatus | null {
  switch (status) {
    case "busy":
    case "retry":
    case "running":
      return status
    default:
      return null
  }
}

function toJobRow(task: BackgroundTaskSnapshot): JobRow {
  return {
    title: task.title || `${task.agent} background task`,
    status: task.status,
    toolCalls: task.toolCalls,
    lastTool: task.lastTool,
  }
}

function redactLoopText(loop: TuiRuntimeSnapshot["loop"]): TuiRuntimeSnapshot["loop"] {
  if (loop === null) {
    return null
  }
  return { ...loop, activeGoal: null }
}

function projectHustlerWorkflow(record: HustlerLifecycleRecord): TuiHustlerWorkflow {
  const activeWorker = record.state.workers.find(worker => worker.status === "running")
    ?? record.state.workers.find(worker => worker.status === "pending")
  const workItem = activeWorker ?? record.state.workers.at(-1) ?? null
  const plannerGate = record.classification.tier < 2
    ? "not-required"
    : record.state.plan === undefined
      ? "required"
      : "satisfied"
  const reviewState = record.state.acceptance?.status
    ?? record.state.review?.status
    ?? "not-started"

  return {
    activeRole: activeWorker?.role ?? null,
    phase: record.state.phase,
    plannerGate,
    workItem: workItem === null
      ? null
      : { id: workItem.workItemId ?? workItem.id, role: workItem.role, status: workItem.status },
    reviewState,
    terminalStatus: record.status,
  }
}
