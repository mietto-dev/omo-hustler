import { configureMigrationCategoryDefaults } from "@omo-hustler/utils/migration/agent-category"

import { DEFAULT_CATEGORIES } from "../tools/delegate-task/constants"

configureMigrationCategoryDefaults(DEFAULT_CATEGORIES)

export { AGENT_NAME_MAP, BUILTIN_AGENT_NAMES, migrateAgentNames } from "@omo-hustler/utils/migration/agent-names"
export { migrateAgentConfigToCategory, MODEL_TO_CATEGORY_MAP, shouldDeleteAgentConfig } from "@omo-hustler/utils/migration/agent-category"
export { HOOK_NAME_MAP, migrateHookNames } from "@omo-hustler/utils/migration/hook-names"
export { getSidecarPath, readAppliedMigrations, writeAppliedMigrations } from "@omo-hustler/utils/migration/migrations-sidecar"
export { migrateModelVersions, MODEL_VERSION_MAP } from "@omo-hustler/utils/migration/model-versions"
