export const branchCounts = {
  title: 0,
  "parent-tool-call": 0,
  "parent-hold": 0,
  child: 0,
  wake: 0,
  default: 0,
}

export const latches = {
  parentToolCallIssued: false,
  parentHoldIssued: false,
}

export const hustlerState = {
  scenario: "",
  workflowId: "",
  taskId: "",
  parentCalls: 0,
  providerFailures: 0,
  toolFailures: 0,
}

export function configureHustler(input) {
  hustlerState.scenario = typeof input.scenario === "string" ? input.scenario : ""
  hustlerState.workflowId = typeof input.workflowId === "string" ? input.workflowId : ""
  hustlerState.taskId = typeof input.taskId === "string" ? input.taskId : ""
  hustlerState.parentCalls = 0
  hustlerState.providerFailures = 0
  hustlerState.toolFailures = 0
}

export function hustlerRoleIn(inputStr) {
  const match = inputStr.match(/hustler\.(planner|developer|tester|approver)/)
  return match?.[1] ?? undefined
}

export function hustlerScenarioIn(inputStr) {
  const match = inputStr.match(/HUSTLER_E2E_[A-Z_]+/)
  return match?.[0] ?? hustlerState.scenario
}

export function hasToolResult(inputStr) {
  return (
    inputStr.includes('"type":"function_call_output"') ||
    inputStr.includes('"type": "function_call_output"') ||
    inputStr.includes('"type":"tool_result"') ||
    inputStr.includes('"type": "tool_result"') ||
    inputStr.includes('"role":"tool"') ||
    inputStr.includes('"role": "tool"')
  )
}

export function selectBranch(inputStr) {
  const isTitle = inputStr.includes("Generate a title")
  const isSplitProbe = inputStr.includes("Run the split probe")
  const isChild = inputStr.includes("SPLIT_CHILD_TASK")
  const isWake = inputStr.includes("[BACKGROUND TASK")
  const hasResult = hasToolResult(inputStr)

  if (isTitle) return "title"
  if (isChild && !isSplitProbe) return "child"
  if (isWake) return "wake"
  if (isSplitProbe && !hasResult && !latches.parentToolCallIssued) return "parent-tool-call"
  if (isSplitProbe && (hasResult || latches.parentToolCallIssued) && !latches.parentHoldIssued) return "parent-hold"
  return "default"
}
