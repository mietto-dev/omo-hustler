/// <reference types="bun-types" />

import { describe, expect, test } from "bun:test"
import { AGENT_NAME_MAP, migrateAgentNames } from "./agent-names"

describe("canonical agent names", () => {
  test("keeps canonical names mapped to themselves", () => {
    const canonicalNames = ["orchestrator", "planner", "developer", "tester", "approver", "librarian", "architect"]

    for (const name of canonicalNames) {
      expect(AGENT_NAME_MAP[name]).toBe(name)
    }
  })

  test("does not migrate unknown or retired names", () => {
    const config = {
      retired_role: { model: "provider/model" },
      planner: { model: "provider/planner" },
    }

    expect(migrateAgentNames(config)).toEqual({ migrated: config, changed: false })
  })
})
