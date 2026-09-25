# CLI Reference

The CLI manages the OpenCode plugin and its local configuration.

## Common Commands

```bash
bunx oh-my-openagent install
bunx oh-my-openagent doctor
bunx oh-my-openagent run "complete the task"
bunx oh-my-openagent version
```

| Command | Purpose |
| --- | --- |
| `install` or `setup` | Register the plugin and guide provider setup |
| `doctor` | Check plugin registration, configuration, tools, and models |
| `run <message>` | Run a non-interactive OpenCode session |
| `config migrate` | Migrate legacy OMO configuration into `~/.omo/omo.jsonc` |
| `refresh-model-capabilities` | Refresh the model capability cache |
| `worktree-sweep` | Report or remove stale linked worktrees |
| `boulder` | Inspect active work state |
| `mcp oauth` | Manage OAuth tokens for configured MCP servers |
| `version` | Print the installed version |

## install

```bash
bunx oh-my-openagent install
```

Use `--no-tui` for scripted environments. The installer targets OpenCode and writes only the plugin registration and OMO configuration it owns. Provider subscription flags and authentication prompts are optional setup inputs.

## Configuration

Runtime configuration is stored in `~/.omo/omo.jsonc`, with project configuration in `.omo/omo.jsonc`. The nearest project file wins over the user file. `config migrate --dry-run` previews legacy configuration migration without writing files.

## QA

Run the CLI in an isolated environment when testing installation, sessions, or database behavior. Record the command, observed output, and isolation result under `.omo/evidence/`.
