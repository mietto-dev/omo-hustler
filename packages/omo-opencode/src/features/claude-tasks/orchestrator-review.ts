import {
  ApproverInputSchema,
  resolveApproverResult,
  TesterReviewSchema,
  type ActionableTesterIssue,
} from "./workflow-contracts"
import {
  resolveRetryRoute,
  WorkflowStateSchema,
  WorkflowStateError,
  type WorkflowState,
} from "./orchestrator-state"

function selectWorkItemId(
  issues: readonly ActionableTesterIssue[],
  requestedWorkItemId: string | undefined,
): string {
  const workItemId = requestedWorkItemId ?? issues.find(issue => issue.workItemId !== undefined)?.workItemId
  if (workItemId === undefined) {
    throw new WorkflowStateError("MISSING_WORK_ITEM", "Review failure requires a responsible work item ID")
  }
  return workItemId
}

export function recordTesterReview(
  state: WorkflowState,
  review: unknown,
  workItemId?: string,
): WorkflowState {
  if (state.phase !== "review") {
    throw new WorkflowStateError("INVALID_PHASE_TRANSITION", "Tester review can only be recorded during review")
  }

  const parsedReview = TesterReviewSchema.safeParse(review)
  if (!parsedReview.success) {
    throw new WorkflowStateError("INVALID_TESTER_REVIEW", "Tester review does not satisfy the review contract")
  }

  if (parsedReview.data.status === "approved") {
    return WorkflowStateSchema.parse({
      ...state,
      phase: "acceptance",
      review: parsedReview.data,
      acceptance: { status: "pending" },
    })
  }

  const route = resolveRetryRoute({
    failure: "tester",
    workItemId: selectWorkItemId(parsedReview.data.issues, workItemId),
  })
  return WorkflowStateSchema.parse({
    ...state,
    phase: route.phase,
    review: parsedReview.data,
    retryCount: state.retryCount + 1,
    lastRetry: route,
  })
}

export function recordApproverResult(
  state: WorkflowState,
  input: unknown,
  workItemId?: string,
): WorkflowState {
  if (state.phase !== "acceptance") {
    throw new WorkflowStateError("INVALID_PHASE_TRANSITION", "Approver result can only be recorded during acceptance")
  }
  if (state.review !== undefined && state.review.status !== "approved") {
    throw new WorkflowStateError("REVIEW_REQUIRED", "Tester review must be approved before acceptance")
  }

  const parsedInput = ApproverInputSchema.safeParse(input)
  if (!parsedInput.success) {
    throw new WorkflowStateError("INVALID_APPROVER_RESULT", "Approver input does not satisfy the acceptance contract")
  }

  const result = resolveApproverResult(parsedInput.data)
  if (result.status === "accepted") {
    return WorkflowStateSchema.parse({ ...state, acceptance: result })
  }

  const route = resolveRetryRoute({
    failure: "approver",
    workItemId: selectWorkItemId(state.review?.issues ?? [], workItemId),
  })
  return WorkflowStateSchema.parse({
    ...state,
    phase: route.phase,
    acceptance: result,
    retryCount: state.retryCount + 1,
    lastRetry: route,
  })
}
