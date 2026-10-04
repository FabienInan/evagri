import { describe, it, expect } from "vitest"
import {
  UNASSIGNED,
  buildInitialLayout,
  findContainerOf,
  moveBetweenContainers,
  removeSection,
  reorderSections,
  reorderWithinContainer,
  toFicheSections,
  type Containers,
  type FicheLayoutState,
} from "@/lib/fiche-layout"

describe("buildInitialLayout", () => {
  it("pools every champ when no section is saved", () => {
    const state = buildInitialLayout(["a", "b"], [])
    expect(state.containers[UNASSIGNED]).toEqual(["a", "b"])
    expect(state.sections).toEqual([])
  })

  it("respects the persisted section order", () => {
    const state = buildInitialLayout(
      ["a", "b"],
      [
        { id: "s2", nom: "Deux", ordre: 1, champs: ["b"] },
        { id: "s1", nom: "Un", ordre: 0, champs: ["a"] },
      ]
    )
    expect(state.sections.map((s) => s.id)).toEqual(["s1", "s2"])
  })

  it("drops champ ids that no longer exist", () => {
    const state = buildInitialLayout(["a"], [{ id: "s1", nom: "Un", ordre: 0, champs: ["a", "deleted"] }])
    expect(state.containers.s1).toEqual(["a"])
  })

  it("pools champs created after the layout was saved", () => {
    const state = buildInitialLayout(["a", "new"], [{ id: "s1", nom: "Un", ordre: 0, champs: ["a"] }])
    expect(state.containers[UNASSIGNED]).toEqual(["new"])
  })

  it("keeps a champ in a single section when the saved layout duplicates it", () => {
    const state = buildInitialLayout(
      ["a"],
      [
        { id: "s1", nom: "Un", ordre: 0, champs: ["a"] },
        { id: "s2", nom: "Deux", ordre: 1, champs: ["a"] },
      ]
    )
    expect(state.containers.s1).toEqual(["a"])
    expect(state.containers.s2).toEqual([])
  })
})

describe("findContainerOf", () => {
  const containers: Containers = { [UNASSIGNED]: ["a"], s1: ["b"] }

  it("resolves a champ to its container", () => {
    expect(findContainerOf(containers, "b")).toBe("s1")
  })

  it("resolves a container id to itself", () => {
    expect(findContainerOf(containers, "s1")).toBe("s1")
  })

  it("returns null for an unknown id", () => {
    expect(findContainerOf(containers, "nope")).toBeNull()
  })
})

describe("moveBetweenContainers", () => {
  it("moves a champ into an empty section", () => {
    const result = moveBetweenContainers({ [UNASSIGNED]: ["a", "b"], s1: [] }, "a", "s1")
    expect(result).toEqual({ [UNASSIGNED]: ["b"], s1: ["a"] })
  })

  it("inserts above the hovered champ by default", () => {
    const result = moveBetweenContainers({ [UNASSIGNED]: ["a"], s1: ["x", "y"] }, "a", "y")
    expect(result.s1).toEqual(["x", "a", "y"])
  })

  it("inserts below the hovered champ when requested", () => {
    const result = moveBetweenContainers({ [UNASSIGNED]: ["a"], s1: ["x", "y"] }, "a", "y", true)
    expect(result.s1).toEqual(["x", "y", "a"])
  })

  it("moves a champ back to the unassigned pool", () => {
    const result = moveBetweenContainers({ [UNASSIGNED]: [], s1: ["a"] }, "a", UNASSIGNED)
    expect(result).toEqual({ [UNASSIGNED]: ["a"], s1: [] })
  })

  it("is a no-op within the same container", () => {
    const containers = { [UNASSIGNED]: ["a", "b"] }
    expect(moveBetweenContainers(containers, "a", "b")).toBe(containers)
  })

  it("is a no-op for an unknown target", () => {
    const containers = { [UNASSIGNED]: ["a"] }
    expect(moveBetweenContainers(containers, "a", "ghost")).toBe(containers)
  })
})

describe("reorderWithinContainer", () => {
  it("moves a champ down inside its section", () => {
    const result = reorderWithinContainer({ s1: ["a", "b", "c"] }, "a", "c")
    expect(result.s1).toEqual(["b", "c", "a"])
  })

  it("moves a champ up inside its section", () => {
    const result = reorderWithinContainer({ s1: ["a", "b", "c"] }, "c", "a")
    expect(result.s1).toEqual(["c", "a", "b"])
  })

  it("is a no-op across containers", () => {
    const containers = { s1: ["a"], s2: ["b"] }
    expect(reorderWithinContainer(containers, "a", "b")).toBe(containers)
  })

  it("is a no-op when dropped on itself", () => {
    const containers = { s1: ["a", "b"] }
    expect(reorderWithinContainer(containers, "a", "a")).toBe(containers)
  })
})

describe("removeSection", () => {
  it("returns orphaned champs to the unassigned pool", () => {
    const state: FicheLayoutState = {
      containers: { [UNASSIGNED]: ["a"], s1: ["b", "c"] },
      sections: [{ id: "s1", nom: "Un" }],
    }
    const result = removeSection(state, "s1")
    expect(result.containers[UNASSIGNED]).toEqual(["a", "b", "c"])
    expect(result.containers.s1).toBeUndefined()
    expect(result.sections).toEqual([])
  })
})

describe("reorderSections", () => {
  const sections = [
    { id: "s1", nom: "Un" },
    { id: "s2", nom: "Deux" },
    { id: "s3", nom: "Trois" },
  ]

  it("moves a section down", () => {
    expect(reorderSections(sections, "s1", "s3").map((s) => s.id)).toEqual(["s2", "s3", "s1"])
  })

  it("moves a section up", () => {
    expect(reorderSections(sections, "s3", "s1").map((s) => s.id)).toEqual(["s3", "s1", "s2"])
  })

  it("is a no-op for an unknown id", () => {
    expect(reorderSections(sections, "s1", "ghost")).toBe(sections)
  })
})

describe("toFicheSections", () => {
  it("serialises sections with a contiguous ordre and omits the pool", () => {
    const state: FicheLayoutState = {
      containers: { [UNASSIGNED]: ["pooled"], s1: ["a"], s2: [] },
      sections: [
        { id: "s1", nom: "Un" },
        { id: "s2", nom: "Deux" },
      ],
    }
    expect(toFicheSections(state)).toEqual([
      { id: "s1", nom: "Un", ordre: 0, champs: ["a"] },
      { id: "s2", nom: "Deux", ordre: 1, champs: [] },
    ])
  })

  it("falls back to a generated name for a blank section", () => {
    const state: FicheLayoutState = {
      containers: { s1: [] },
      sections: [{ id: "s1", nom: "   " }],
    }
    expect(toFicheSections(state)[0].nom).toBe("Section 1")
  })
})
