import { z } from "zod"
import { OhMyOpenCodeConfigSchema } from "../packages/omo-opencode/src/config/schema"

export function createOhMyOpenCodeJsonSchema(): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(OhMyOpenCodeConfigSchema, {
    target: "draft-7",
    unrepresentable: "any",
  }) as Record<string, unknown>

  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: "urn:omo-hustler:schema:plugin",
    title: "OMO Hustler Plugin Configuration",
    description: "Configuration schema for the OMO Hustler OpenCode plugin",
    ...jsonSchema,
  }
}
