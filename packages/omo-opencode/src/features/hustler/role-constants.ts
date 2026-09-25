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
