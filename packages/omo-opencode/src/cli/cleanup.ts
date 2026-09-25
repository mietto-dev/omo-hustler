export interface CleanupOptions {
  readonly project?: string
  readonly json?: boolean
}

export async function cleanup(options: CleanupOptions): Promise<number> {
  if (options.json === true) console.log(JSON.stringify({ removed: [] }))
  else console.log("OpenCode cleanup is managed by removing the plugin entry from opencode.json.")
  return 0
}
