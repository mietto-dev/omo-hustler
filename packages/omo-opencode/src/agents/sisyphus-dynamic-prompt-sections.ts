import {
  buildAgentIdentitySection,
  buildAntiPatternsSection,
  buildCategorySkillsDelegationGuide,
  buildDelegationTable,
  buildHardBlocksSection,
  buildKeyTriggersSection,
  buildLibrarianSection,
  buildNonClaudePlannerSection,
  buildArchitectSection,
  buildParallelDelegationSection,
  buildToolSelectionTable,
} from "./dynamic-agent-prompt-builder";
import type {
  AvailableAgent,
  AvailableCategory,
  AvailableSkill,
  AvailableTool,
} from "./dynamic-agent-prompt-builder";
import { buildTaskManagementSection } from "./sisyphus/default";

export interface SisyphusDynamicPromptSections {
  readonly agentIdentity: string;
  readonly antiPatterns: string;
  readonly categorySkillsGuide: string;
  readonly delegationTable: string;
  readonly hardBlocks: string;
  readonly keyTriggers: string;
  readonly librarianSection: string;
  readonly repositoryLibrarianSection: string;
  readonly nonClaudePlannerSection: string;
  readonly architectSection: string;
  readonly parallelDelegationSection: string;
  readonly taskManagementSection: string;
  readonly todoHookNote: string;
  readonly toolSelection: string;
}

export function buildSisyphusDynamicPromptSections(
  model: string,
  availableAgents: AvailableAgent[],
  availableTools: AvailableTool[],
  availableSkills: AvailableSkill[],
  availableCategories: AvailableCategory[],
  useTaskSystem: boolean,
): SisyphusDynamicPromptSections {
  return {
    agentIdentity: buildAgentIdentitySection(
      "Sisyphus",
      "Powerful AI Agent with orchestration capabilities from OhMyOpenCode",
    ),
    antiPatterns: buildAntiPatternsSection(),
    categorySkillsGuide: buildCategorySkillsDelegationGuide(
      availableCategories,
      availableSkills,
    ),
    delegationTable: buildDelegationTable(availableAgents),
    hardBlocks: buildHardBlocksSection(),
    keyTriggers: buildKeyTriggersSection(availableAgents, availableSkills),
    librarianSection: buildLibrarianSection(availableAgents),
    repositoryLibrarianSection: buildLibrarianSection(availableAgents, "repository"),
    nonClaudePlannerSection: buildNonClaudePlannerSection(model),
    architectSection: buildArchitectSection(availableAgents),
    parallelDelegationSection: buildParallelDelegationSection(model, availableCategories),
    taskManagementSection: buildTaskManagementSection(useTaskSystem),
    todoHookNote: buildTodoHookNote(useTaskSystem),
    toolSelection: buildToolSelectionTable(availableAgents, availableTools, availableSkills),
  };
}

function buildTodoHookNote(useTaskSystem: boolean): string {
  if (useTaskSystem) {
    return "YOUR TASK CREATION WOULD BE TRACKED BY HOOK([SYSTEM REMINDER - TASK CONTINUATION])";
  }

  return "YOUR TODO CREATION WOULD BE TRACKED BY HOOK([SYSTEM REMINDER - TODO CONTINUATION])";
}
