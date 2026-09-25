#!/usr/bin/env bun
import { createOmoJsonSchema } from "./build-omo-schema-document"
import { createOhMyOpenCodeJsonSchema } from "./build-schema-document"

const OMO_SCHEMA_OUTPUT_PATH = "assets/omo.schema.json"
const PLUGIN_SCHEMA_OUTPUT_PATH = "assets/omo-hustler.schema.json"
const DIST_SCHEMA_OUTPUT_PATH = "dist/omo-hustler.schema.json"

async function main() {
  console.log("Generating JSON Schemas...")

  await Bun.write(OMO_SCHEMA_OUTPUT_PATH, JSON.stringify(createOmoJsonSchema(), null, 2))

  const pluginSchema = createOhMyOpenCodeJsonSchema()
  await Bun.write(PLUGIN_SCHEMA_OUTPUT_PATH, JSON.stringify(pluginSchema, null, 2))
  await Bun.write(DIST_SCHEMA_OUTPUT_PATH, JSON.stringify(pluginSchema, null, 2))

  console.log(`✓ JSON Schemas generated: ${OMO_SCHEMA_OUTPUT_PATH}, ${PLUGIN_SCHEMA_OUTPUT_PATH}`)
}

main()
