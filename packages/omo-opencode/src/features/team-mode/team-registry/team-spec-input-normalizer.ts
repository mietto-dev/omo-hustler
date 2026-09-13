import {
  normalizeTeamSpecInput as normalizeCoreTeamSpecInput,
} from "@oh-my-opencode/team-core/team-registry/team-spec-input-normalizer"
import type {
  NormalizeTeamSpecInputOptions,
} from "@oh-my-opencode/team-core/team-registry/team-spec-input-normalizer"

const LEGACY_TEAM_LEAD_IDS: Readonly<Record<string, string>> = {
  orchestrator: "sisyphus",
  "sisyphus - ultraworker": "sisyphus",
  sisyphus: "sisyphus",
  developer: "hephaestus",
  "hephaestus - implementation": "hephaestus",
  hephaestus: "hephaestus",
  planner: "prometheus",
  "prometheus - plan builder": "prometheus",
  prometheus: "prometheus",
  approver: "atlas",
  atlas: "atlas",
  tester: "momus",
  architect: "oracle",
  librarian: "explore",
}

export function normalizeTeamLeadOptions(
  options: NormalizeTeamSpecInputOptions | undefined,
): NormalizeTeamSpecInputOptions | undefined {
  const caller = options?.callerTeamLead
  if (caller?.isEligibleForTeamLead !== false || caller.displayName === undefined) {
    return options
  }

  const legacyAgentTypeId = LEGACY_TEAM_LEAD_IDS[caller.displayName.trim().toLowerCase()]
  if (legacyAgentTypeId === undefined) {
    return options
  }

  return {
    ...options,
    callerTeamLead: {
      ...caller,
      agentTypeId: legacyAgentTypeId,
      isEligibleForTeamLead: true,
    },
  }
}

export type { NormalizeTeamSpecInputOptions }

export function normalizeTeamSpecInput(
  raw: unknown,
  options?: NormalizeTeamSpecInputOptions,
): unknown {
  return normalizeCoreTeamSpecInput(raw, normalizeTeamLeadOptions(options))
}
