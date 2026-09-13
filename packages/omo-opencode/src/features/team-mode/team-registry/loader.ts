import {
  loadTeamSpec as loadCoreTeamSpec,
  loadAllTeamSpecs,
} from "@oh-my-opencode/team-core/team-registry/loader"
import type { TeamModeConfig } from "@oh-my-opencode/team-core/config"
import type { TeamSpec } from "@oh-my-opencode/team-core/types"
import type { NormalizeTeamSpecInputOptions } from "./team-spec-input-normalizer"
import { normalizeTeamLeadOptions, normalizeTeamSpecInput } from "./team-spec-input-normalizer"

export { TeamSpecValidationError } from "@oh-my-opencode/team-core/team-registry/loader"
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
