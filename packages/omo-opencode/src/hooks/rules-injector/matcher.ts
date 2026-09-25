export {
  createContentHash,
  getMatcherCacheStats,
  isDuplicateByContentHash,
  isDuplicateByRealPath,
  resetMatcherCache,
  shouldApplyRule,
} from "@omo-hustler/rules-engine";
export type { MatchResult } from "@omo-hustler/rules-engine";

export interface MatcherCacheStats {
  readonly entries: number;
}
