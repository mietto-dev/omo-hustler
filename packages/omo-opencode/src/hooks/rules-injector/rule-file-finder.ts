import { setSisyphusRuleDeprecationLogger } from "@omo-hustler/rules-engine";
import { log } from "../../shared/logger";

setSisyphusRuleDeprecationLogger(log);

export { findRuleFiles } from "@omo-hustler/rules-engine";
export type { FindRuleFilesOptions } from "@omo-hustler/rules-engine";
