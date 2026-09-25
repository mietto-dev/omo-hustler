import { spawnTmuxPane as spawnTmuxPaneCore } from "@omo-hustler/tmux-core"
import type { SpawnTmuxPaneDeps, TmuxConfig } from "@omo-hustler/tmux-core"
import type { SpawnPaneResult } from "../types"
import type { SplitDirection } from "./environment"
import { withPaneSpawnDeps } from "./adapter-deps"

export async function spawnTmuxPane(
	sessionId: string,
	description: string,
	config: TmuxConfig,
	serverUrl: string,
	_directory: string,
	targetPaneId?: string,
	splitDirection: SplitDirection = "-h",
	depsInput?: Partial<SpawnTmuxPaneDeps>,
): Promise<SpawnPaneResult> {
	return spawnTmuxPaneCore(
		sessionId,
		description,
		config,
		serverUrl,
		_directory,
		targetPaneId,
		splitDirection,
		withPaneSpawnDeps(depsInput),
	)
}
