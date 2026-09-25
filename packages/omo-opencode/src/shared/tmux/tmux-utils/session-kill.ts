import { killTmuxSessionIfExists as killTmuxSessionIfExistsCore } from "@omo-hustler/tmux-core"

export async function killTmuxSessionIfExists(sessionName: string): Promise<boolean> {
  const [{ log }, { isNativeTmux }, { getTmuxPath }, { runTmuxCommand }] = await Promise.all([
    import("../../logger"),
    import("./environment"),
    import("../../../tools/interactive-bash/tmux-path-resolver"),
    import("../runner"),
  ])
  return killTmuxSessionIfExistsCore(sessionName, {
    log,
    isInsideTmux: isNativeTmux,
    getTmuxPath,
    runTmuxCommand,
  })
}
