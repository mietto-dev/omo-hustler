import type { LoadedSkill } from "../features/opencode-skill-loader";
import {
  deduplicateSkillsByName,
  discoverConfigSourceSkills,
  discoverGlobalAgentsSkills,
  discoverOpencodeGlobalSkills,
  discoverOpencodeProjectSkills,
  discoverProjectAgentsSkills,
} from "../features/opencode-skill-loader";
import { adaptHostSkillConfig } from "../shared/host-skill-config";
import type { ApplyAgentConfigParams } from "./agent-config-types";

export async function discoverAgentSkills(
  params: Pick<ApplyAgentConfigParams, "config" | "pluginConfig" | "ctx">,
): Promise<LoadedSkill[]> {
  const hostSkillConfig = adaptHostSkillConfig(params.config.skills);
  const [
    discoveredConfigSourceSkills,
    discoveredHostConfigSkills,
    discoveredProjectAgentsSkills,
    discoveredOpencodeGlobalSkills,
    discoveredOpencodeProjectSkills,
    discoveredGlobalAgentsSkills,
  ] = await Promise.all([
    discoverConfigSourceSkills({
      config: params.pluginConfig.skills,
      configDir: params.ctx.directory,
    }),
    discoverConfigSourceSkills({
      config: hostSkillConfig,
      configDir: params.ctx.directory,
    }),
    discoverProjectAgentsSkills(params.ctx.directory),
    discoverOpencodeGlobalSkills(),
    discoverOpencodeProjectSkills(params.ctx.directory),
    discoverGlobalAgentsSkills(),
  ]);

  return deduplicateSkillsByName([
    ...discoveredConfigSourceSkills,
    ...discoveredHostConfigSkills,
    ...discoveredOpencodeProjectSkills,
    ...discoveredProjectAgentsSkills,
    ...discoveredOpencodeGlobalSkills,
    ...discoveredGlobalAgentsSkills,
  ]);
}
