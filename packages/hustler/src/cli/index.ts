#!/usr/bin/env node

const args = process.argv.slice(2)

if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
  process.stdout.write("Usage: hustler-opencode [--help|--version]\n")
  process.exit(0)
}

if (args.includes("--version") || args.includes("-v")) {
  process.stdout.write("0.0.0-private\n")
  process.exit(0)
}

process.stderr.write(`Unsupported Hustler CLI arguments: ${args.join(" ")}\n`)
process.exitCode = 1
