export const AGENT_NAME_MAP: Record<string, string> = {
  omo: "orchestrator",
  build: "developer",
  plan: "planner",
  sisyphus: "orchestrator",
  hephaestus: "developer",
  prometheus: "planner",
  momus: "tester",
  atlas: "approver",
  explore: "librarian",
  oracle: "architect",
  "multimodal-looker": "librarian",
  metis: "architect",
  "sisyphus-junior": "developer",
  orchestrator: "orchestrator",
  planner: "planner",
  developer: "developer",
  tester: "tester",
  approver: "approver",
  librarian: "librarian",
  architect: "architect",
}

export const BUILTIN_AGENT_NAMES = new Set([
  "orchestrator",
  "planner",
  "developer",
  "tester",
  "approver",
  "librarian",
  "architect",
])

export function migrateAgentNames(
  agents: Record<string, unknown>
): { migrated: Record<string, unknown>; changed: boolean } {
  const migrated: Record<string, unknown> = {}
  let changed = false

  for (const [key, value] of Object.entries(agents)) {
    const newKey = AGENT_NAME_MAP[key.toLowerCase()] ?? AGENT_NAME_MAP[key] ?? key
    if (newKey !== key) {
      changed = true
    }
    migrated[newKey] = value
  }

  return { migrated, changed }
}
