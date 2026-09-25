/// <reference types="bun-types" />

import { afterEach, beforeAll, describe, expect, test } from "bun:test"

import { installAgentSortShim, setAgentSortOrder, setDefaultAgentForSort } from "./agent-sort-shim"
import { AGENT_DISPLAY_NAMES } from "./agent-display-names"

type AgentListItem = {
  name: string
  default_agent?: boolean
}

declare global {
  interface Array<T> {
    toSorted(compareFn?: (a: T, b: T) => number): T[]
  }
}

describe("agent-sort-shim", () => {
  beforeAll(() => {
    installAgentSortShim()
  })

  afterEach(() => {
    setAgentSortOrder(undefined)
  })

  describe("#given canonical agent objects in random order", () => {
    describe("#when toSorted with alphabetical compareFn", () => {
      test("#then returns canonical Hustler order", () => {
        // given
        setAgentSortOrder(undefined)
        const orchestrator = { name: "Orchestrator" }
        const developer = { name: "Developer" }
        const planner = { name: "Planner" }
        const approver = { name: "Approver" }
        const input = [approver, planner, developer, orchestrator]

        // when
        const result = input.toSorted((a, b) => a.name.localeCompare(b.name))

        // then
        expect(result).toEqual([orchestrator, planner, developer, approver])
      })

      test("#then follows configured core agent order", () => {
        // given
        setAgentSortOrder(["developer", "orchestrator", "planner", "approver"])
        const orchestrator = { name: "Orchestrator" }
        const developer = { name: "Developer" }
        const planner = { name: "Planner" }
        const approver = { name: "Approver" }
        const input = [approver, planner, developer, orchestrator]

        // when
        const result = input.toSorted((a, b) => a.name.localeCompare(b.name))

        // then
        expect(result).toEqual([developer, orchestrator, planner, approver])
      })
    })
  })

  describe("#given 4 core agents mixed with 2 non-core agent objects", () => {
    describe("#when toSorted with alphabetical compareFn", () => {
      test("#then core agents come first in canonical order followed by non-core agents alphabetically", () => {
        // given
        const orchestrator = { name: "Orchestrator" }
        const developer = { name: "Developer" }
        const planner = { name: "Planner" }
        const approver = { name: "Approver" }
        const build = { name: "build" }
        const plan = { name: "plan" }
        const input = [approver, build, planner, plan, developer, orchestrator]

        // when
        const result = input.toSorted((a, b) => a.name.localeCompare(b.name))

        // then
        expect(result).toEqual([orchestrator, planner, developer, approver, build, plan])
      })
    })
  })

  describe("#given OpenCode Agent.list style sort with default agent priority", () => {
    describe("#when toSorted compares default_agent first and then name", () => {
      test("#then core agents stay in canonical order before non-core agents", () => {
        // given
        const orchestrator = { name: AGENT_DISPLAY_NAMES.orchestrator, default_agent: true }
        const developer = { name: AGENT_DISPLAY_NAMES.developer }
        const planner = { name: AGENT_DISPLAY_NAMES.planner }
        const approver = { name: AGENT_DISPLAY_NAMES.approver }
        const architect = { name: AGENT_DISPLAY_NAMES.architect }
        const librarian = { name: AGENT_DISPLAY_NAMES.librarian }
        const input: AgentListItem[] = [architect, approver, librarian, planner, developer, orchestrator]

        // when
        const result = input.toSorted((left, right) => {
          const leftDefault = left.default_agent ? 1 : 0
          const rightDefault = right.default_agent ? 1 : 0
          if (leftDefault !== rightDefault) return rightDefault - leftDefault
          return left.name.localeCompare(right.name)
        })

        // then
        expect(result).toEqual([orchestrator, planner, developer, approver, librarian, architect])
      })
    })
  })

  describe("#given an array with only one core agent and several non-core agent-like objects", () => {
    describe("#when toSorted with case-sensitive string-comparison compareFn", () => {
      test("#then activation predicate fails and result is ASCII-sensitive order with capital S before lowercase letters", () => {
        // given
        const architect = { name: "architect" }
        const librarian = { name: "librarian" }
        const orchestrator = { name: "Orchestrator" }
        const input = [architect, librarian, orchestrator, librarian]

        // when
        const result = input.toSorted((a, b) =>
          a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
        )

        // then
        expect(result).toEqual([orchestrator, librarian, librarian, architect])
      })
    })
  })

  describe("#given a mixed-type array containing null, objects, a string, and a number", () => {
    describe("#when toSorted with a string-coercing compareFn", () => {
      test("#then activation predicate fails, shim does not throw, and result matches native semantics", () => {
        // given
        const sisyphusObj = { name: "Orchestrator" }
        const hephaestusObj = { name: "Developer" }
        const input: unknown[] = [null, sisyphusObj, "string", 42, hephaestusObj]
        const compare = (a: unknown, b: unknown): number => {
          const sa = String(a)
          const sb = String(b)
          if (sa < sb) return -1
          if (sa > sb) return 1
          return 0
        }

        // when
        const result = input.toSorted(compare)

        // then
        expect(result).toEqual([42, sisyphusObj, hephaestusObj, null, "string"])
      })
    })
  })

  describe("#given a plain string array", () => {
    describe("#when toSorted with no compareFn", () => {
      test("#then returns native alphabetical ordering untouched", () => {
        // given
        const input = ["zebra", "apple", "mango"]

        // when
        const result = input.toSorted()

        // then
        expect(result).toEqual(["apple", "mango", "zebra"])
      })
    })
  })

  describe("#given a number array", () => {
    describe("#when sort with numeric compareFn (in-place)", () => {
      test("#then mutates the array and returns the same reference in ascending order", () => {
        // given
        const input = [3, 1, 4, 1, 5, 9, 2, 6]

        // when
        const result = input.sort((a, b) => a - b)

        // then
        expect(result).toBe(input)
        expect(input).toEqual([1, 1, 2, 3, 4, 5, 6, 9])
      })
    })
  })

  describe("#given canonical agent objects in random order", () => {
    describe("#when sort with alphabetical compareFn (in-place)", () => {
      test("#then mutates the original array to canonical order", () => {
        // given
        const orchestrator = { name: "Orchestrator" }
        const developer = { name: "Developer" }
        const planner = { name: "Planner" }
        const approver = { name: "Approver" }
        const input = [approver, planner, developer, orchestrator]

        // when
        const result = input.sort((a, b) => a.name.localeCompare(b.name))

        // then
        expect(result).toBe(input)
        expect(input).toEqual([orchestrator, planner, developer, approver])
      })
    })
  })

  describe("#given installAgentSortShim has been invoked multiple times", () => {
    describe("#when toSorted is called on core agents after duplicate installs", () => {
      test("#then result is canonical order with no double-wrapping side effects", () => {
        // given
        installAgentSortShim()
        installAgentSortShim()
        const orchestrator = { name: "Orchestrator" }
        const developer = { name: "Developer" }
        const planner = { name: "Planner" }
        const approver = { name: "Approver" }
        const input = [approver, planner, developer, orchestrator]

        // when
        const result = input.toSorted((a, b) => a.name.localeCompare(b.name))

        // then
        expect(result).toEqual([orchestrator, planner, developer, approver])
      })
    })
  })

  describe("#given a custom default_agent configured via setDefaultAgentForSort", () => {
    describe("#when toSorted is called on core agents mixed with the custom default agent", () => {
      test("#then the custom default agent sorts first, followed by core agents in canonical order", () => {
        // given
        setAgentSortOrder(undefined)
        setDefaultAgentForSort("crystal")
        const orchestrator = { name: "Orchestrator" }
        const developer = { name: "Developer" }
        const planner = { name: "Planner" }
        const approver = { name: "Approver" }
        const crystal = { name: "crystal" }
        const input = [approver, crystal, planner, developer, orchestrator]

        // when
        const result = input.toSorted((a, b) => a.name.localeCompare(b.name))

        // then
        expect(result).toEqual([orchestrator, planner, developer, approver, crystal])
      })
    })

    describe("#when setDefaultAgentForSort is called with a core agent name", () => {
      test("#then that core agent sorts first, others follow in remaining canonical order", () => {
        // given
        setAgentSortOrder(undefined)
        setDefaultAgentForSort("developer")
        const orchestrator = { name: "Orchestrator" }
        const developer = { name: "Developer" }
        const planner = { name: "Planner" }
        const approver = { name: "Approver" }
        const input = [approver, planner, developer, orchestrator]

        // when
        const result = input.toSorted((a, b) => a.name.localeCompare(b.name))

        // then
        expect(result).toEqual([developer, orchestrator, planner, approver])
      })
    })
  })

  describe("#given agent_order configured without default_agent", () => {
    describe("#when setAgentSortOrder sets a non-canonical order and setDefaultAgentForSort is NOT called", () => {
      test("#then the custom agent_order is preserved without implicit override", () => {
        // given
        setAgentSortOrder(["developer", "orchestrator", "planner", "approver"])
        // setDefaultAgentForSort is intentionally NOT called (user did not set default_agent)
        const orchestrator = { name: "Orchestrator" }
        const developer = { name: "Developer" }
        const planner = { name: "Planner" }
        const approver = { name: "Approver" }
        const input = [approver, orchestrator, planner, developer]

        // when
        const result = input.toSorted((a, b) => a.name.localeCompare(b.name))

        // then — Hephaestus must remain first per the user's agent_order
        expect(result).toEqual([developer, orchestrator, planner, approver])
      })
    })
  })
})
