import {
  loadTeamSpec as loadCoreTeamSpec,
  loadAllTeamSpecs,
} from "@omo-hustler/team-core/team-registry/loader"
import type { TeamModeConfig } from "@omo-hustler/team-core/config"
import type { TeamSpec } from "@omo-hustler/team-core/types"
import type { NormalizeTeamSpecInputOptions } from "./team-spec-input-normalizer"
import { normalizeTeamLeadOptions, normalizeTeamSpecInput } from "./team-spec-input-normalizer"

export { TeamSpecValidationError } from "@omo-hustler/team-core/team-registry/loader"
export { loadAllTeamSpecs }

export async function loadTeamSpec(
  teamName: string,
  config: TeamModeConfig,
  projectRoot: string,
  options?: NormalizeTeamSpecInputOptions,
): Promise<TeamSpec> {
  return loadCoreTeamSpec(teamName, config, projectRoot, normalizeTeamLeadOptions(options))
}

export { normalizeTeamSpecInput }
