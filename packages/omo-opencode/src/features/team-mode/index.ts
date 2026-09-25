export * from "./types"
export * from "./team-worktree"

import { setTeamCoreLogger } from "@omo-hustler/team-core"

import { log } from "../../shared/logger"

setTeamCoreLogger(log)
