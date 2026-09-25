import { getSessionAgent } from "../../features/claude-code-session-state"

export const AGENT_NAMES = [
  "orchestrator",
  "architect",
  "librarian",
  "planner",
  "approver",
  "tester",
  "developer",
  "build",
  "plan",
]

const LEGACY_AGENT_NAMES: Record<string, string> = {
  atlas: "approver",
  explore: "librarian",
  hephaestus: "developer",
  momus: "tester",
  oracle: "architect",
  prometheus: "planner",
  sisyphus: "orchestrator",
  "sisyphus-junior": "developer",
}

const legacyAgentPattern = new RegExp(
  `\\b(${Object.keys(LEGACY_AGENT_NAMES)
    .sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/-/g, "\\-"))
    .join("|")})\\b`,
  "i",
)

export const agentPattern = new RegExp(
  `\\b(${AGENT_NAMES
    .sort((a, b) => b.length - a.length)
    .map((a) => a.replace(/-/g, "\\-"))
    .join("|")})\\b`,
  "i",
)

export function detectAgentFromSession(sessionID: string): string | undefined {
  const match = sessionID.match(agentPattern) ?? sessionID.match(legacyAgentPattern)
  if (match?.[1]) {
    const matchedName = match[1].toLowerCase()
    return LEGACY_AGENT_NAMES[matchedName] ?? matchedName
  }
  return undefined
}

export function normalizeAgentName(agent: string | undefined): string | undefined {
  if (!agent) return undefined
  const normalized = agent.toLowerCase().trim()
  const legacyName = LEGACY_AGENT_NAMES[normalized]
  if (legacyName) return legacyName
  for (const [legacyName, canonicalName] of Object.entries(LEGACY_AGENT_NAMES)) {
    if (normalized.startsWith(`${legacyName} `)) return canonicalName
  }
  if (AGENT_NAMES.includes(normalized)) {
    return normalized
  }
  const match = normalized.match(agentPattern)
  if (match?.[1]) {
    const matchedName = match[1].toLowerCase()
    return LEGACY_AGENT_NAMES[matchedName] ?? matchedName
  }
  return undefined
}

export function resolveAgentForSession(sessionID: string, eventAgent?: string): string | undefined {
  return (
    normalizeAgentName(eventAgent) ??
    normalizeAgentName(getSessionAgent(sessionID)) ??
    detectAgentFromSession(sessionID)
  )
}
