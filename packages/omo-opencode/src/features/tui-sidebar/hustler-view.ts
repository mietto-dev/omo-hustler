import { getAgentListDisplayName } from "../../shared/agent-display-names"
import { LABEL_MAX } from "./constants"
import { box, text } from "./element-helpers"
import type { ViewNode } from "./element-helpers"
import type { TuiHustlerWorkflow } from "./snapshot-schema"
import { assertNever } from "./state-types"
import type { HustlerWorkflowState } from "./state-types"

type HustlerTheme = {
  readonly text?: unknown
  readonly info?: unknown
  readonly borderSubtle?: unknown
}

export function buildHustlerNodes(workflow: HustlerWorkflowState, theme: HustlerTheme): ViewNode[] {
  switch (workflow.kind) {
    case "none":
      return []
    case "workflow":
      return [
        box({ borderStyle: "single", borderColor: theme.borderSubtle, flexDirection: "column", padding: 1 }, [
          text({ fg: theme.info }, "HUSTLER"),
          ...hustlerFieldLines(workflow.workflow).map((line) => text({ fg: theme.text }, line)),
        ]),
      ]
    default:
      return assertNever(workflow)
  }
}

export function describeHustler(workflow: HustlerWorkflowState): string[] {
  switch (workflow.kind) {
    case "none":
      return []
    case "workflow":
      return ["HUSTLER", ...hustlerFieldLines(workflow.workflow)]
    default:
      return assertNever(workflow)
  }
}

function hustlerFieldLines(workflow: TuiHustlerWorkflow): string[] {
  return [
    `current role ${hustlerRoleLabel(workflow.activeRole)}`,
    `phase ${workflow.phase}`,
    `planner gate ${workflow.plannerGate}`,
    `work item ${workItemLabel(workflow)}`,
    `review ${workflow.reviewState}`,
    `terminal ${workflow.terminalStatus}`,
  ]
}

function workItemLabel(workflow: TuiHustlerWorkflow): string {
  if (workflow.workItem === null) {
    return "none"
  }

  return `${truncate(workflow.workItem.id)} ${hustlerRoleLabel(workflow.workItem.role)} ${workflow.workItem.status}`
}

function hustlerRoleLabel(role: string | null): string {
  return role === null ? "none" : getAgentListDisplayName(role)
}

function truncate(value: string): string {
  return value.length <= LABEL_MAX ? value : `${value.slice(0, LABEL_MAX - 3)}...`
}
