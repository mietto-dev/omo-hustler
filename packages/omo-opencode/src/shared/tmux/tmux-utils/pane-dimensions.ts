import { getPaneDimensions as getPaneDimensionsCore } from "@omo-hustler/tmux-core"
import type { PaneDimensions } from "@omo-hustler/tmux-core"

export async function getPaneDimensions(
	paneId: string,
): Promise<PaneDimensions | null> {
  const [{ getTmuxPath }, { runTmuxCommand }] = await Promise.all([
    import("../../../tools/interactive-bash/tmux-path-resolver"),
    import("../runner"),
  ])
	return getPaneDimensionsCore(paneId, { getTmuxPath, runTmuxCommand })
}

export type { PaneDimensions }
