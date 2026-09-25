import { describe, expect, test } from "bun:test"
import { HUSTLER_ROLES } from "./role-constants"
import {
  HUSTLER_ROLE_FACTORIES,
  HUSTLER_ROLE_MODES,
  type HustlerRoleDefinition,
} from "./roles"

const legacyIdentities = ["sisyphus", "hephaestus", "prometheus", "atlas"] as const

describe("HUSTLER role definitions", () => {
  test("exposes one deterministic typed definition for every canonical role", () => {
    for (const role of HUSTLER_ROLES) {
      const factory = HUSTLER_ROLE_FACTORIES[role]
      const first = factory("provider/model")
      const second = factory("provider/model")

      expect(first).toEqual(second)
      expect(first.key).toBe(role)
      expect(first.config.mode).toBe(HUSTLER_ROLE_MODES[role])
      expect(first.config.model).toBe("provider/model")
      expect(first.config.description?.length).toBeGreaterThan(0)
      expect(first.metadata.identity).toBe(`hustler.${role}`)
      expect(first.metadata.capabilities.length).toBeGreaterThan(0)
      expect(first.modelRequirement.fallbackChain.length).toBeGreaterThan(0)
    }
  })

  test("keeps active role identity separate from legacy agent names", () => {
    const definitions = HUSTLER_ROLES.map((role) => HUSTLER_ROLE_FACTORIES[role]("provider/model"))

    for (const definition of definitions satisfies readonly HustlerRoleDefinition[]) {
      const serialized = JSON.stringify({
        description: definition.config.description,
        identity: definition.metadata.identity,
      }).toLowerCase()

      for (const legacyIdentity of legacyIdentities) {
        expect(serialized).not.toContain(legacyIdentity)
      }
    }
  })
})
