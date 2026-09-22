import {
  attachPlannerPlan,
  classifyTask,
  createWorkflowState,
  getWorkflowRouting,
  recordApproverResult,
  recordTesterReview,
  transitionWorkflowState,
  type OrchestratorTaskSignals,
  type WorkflowClassification,
  type WorkflowState,
} from "../claude-tasks/orchestrator-workflow"
import type {
  ApproverInput,
  PlannerPlan,
  TesterReview,
} from "../claude-tasks/workflow-contracts"

export const HUSTLER_ROLES = [
  "orchestrator",
  "planner",
  "developer",
  "tester",
  "approver",
  "librarian",
  "architect",
] as const

export type HustlerRole = typeof HUSTLER_ROLES[number]

export type HustlerWorkflow = Readonly<{
  classification: WorkflowClassification
  state: WorkflowState
}>

export function startHustlerWorkflow(input: {
  readonly taskId: string
  readonly signals: OrchestratorTaskSignals
  readonly plannerPlan?: PlannerPlan
}): HustlerWorkflow {
  const classification = classifyTask(input.signals)
  const routing = getWorkflowRouting({ tier: classification.tier, signals: input.signals })
  let state = createWorkflowState(input.taskId, classification.tier)

  if (routing.requiresPlanner) {
    state = transitionWorkflowState(state, "planning")
    if (input.plannerPlan !== undefined) {
      state = attachPlannerPlan(state, input.plannerPlan)
    } else {
      return { classification, state }
    }
  }

  state = transitionWorkflowState(state, "implementation")
  return { classification, state }
}

export function advanceHustlerWorkflowToReview(state: WorkflowState): WorkflowState {
  const integrated = state.tier >= 2
    ? transitionWorkflowState(state, "integration")
    : state
  return transitionWorkflowState(integrated, "review")
}

export function applyHustlerTesterReview(
  state: WorkflowState,
  review: TesterReview,
  workItemId?: string,
): WorkflowState {
  return recordTesterReview(state, review, workItemId)
}

export function applyHustlerApproverResult(
  state: WorkflowState,
  input: ApproverInput,
  workItemId?: string,
): WorkflowState {
  return recordApproverResult(state, input, workItemId)
}

export function completeHustlerWorkflow(state: WorkflowState): WorkflowState {
  return transitionWorkflowState(state, "complete")
}
