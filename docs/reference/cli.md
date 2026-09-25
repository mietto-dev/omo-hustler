# CLI Reference

`hustler-opencode` is the retained local entrypoint for the OpenCode adapter.
It is built and run from this private repository. No public installer or
distribution command is provided.

## Development commands

```bash
bun install
bun run build
./bin/hustler-opencode.js --help
./bin/hustler-opencode.js --version
```

Run the adapter's repository scripts from the checkout when developing or
testing. The exact command surface is defined by the built entrypoint and its
OpenCode adapter modules.

## Configuration

Runtime configuration is stored under `~/.omo`. Project configuration lives in
`.omo/omo.jsonc`, with the nearest project file taking precedence over the user
configuration. See the [configuration reference](configuration.md).

## QA

Run installation, session, and database checks in an isolated environment.
Record the command, observed output, and isolation result under
`.omo/evidence/`.
