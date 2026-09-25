import { configureMigrationCategoryDefaults } from "@omo-hustler/utils/migration/agent-category"

import { DEFAULT_CATEGORIES } from "../../tools/delegate-task/constants"

configureMigrationCategoryDefaults(DEFAULT_CATEGORIES)

export * from "@omo-hustler/utils/migration/agent-category"
