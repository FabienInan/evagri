import { describe, it, expect } from "vitest"
import { computeVisibleColumns } from "@/lib/responsive-columns"

const columns = [
  { key: "a", minWidth: 100, priority: 3 },
  { key: "b", minWidth: 80, priority: 2 },
  { key: "c", minWidth: 60, priority: 1 },
]

describe("computeVisibleColumns", () => {
  it("shows all columns when container is wide enough", () => {
    const result = computeVisibleColumns(columns, 300)
    expect([...result].sort()).toEqual(["a", "b", "c"])
  })

  it("hides lowest-priority columns when container is narrow", () => {
    const result = computeVisibleColumns(columns, 180)
    expect([...result]).toEqual(["a", "b"])
  })

  it("always includes required keys even if container is too narrow", () => {
    const result = computeVisibleColumns(columns, 50, ["b"])
    expect([...result]).toEqual(["b"])
  })

  it("skips unknown required keys", () => {
    const result = computeVisibleColumns(columns, 300, ["z"])
    expect([...result].sort()).toEqual(["a", "b", "c"])
  })

  it("returns empty set when nothing fits and nothing is required", () => {
    const result = computeVisibleColumns(columns, 0)
    expect([...result]).toEqual([])
  })
})
