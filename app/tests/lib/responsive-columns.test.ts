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

import { beforeEach, afterEach, vi } from "vitest"
import {
  loadColumnPreference,
  saveColumnPreference,
  clearColumnPreference,
} from "@/lib/responsive-columns"

describe("column preference storage", () => {
  let storage: Record<string, string> = {}

  beforeEach(() => {
    storage = {}
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage[key] ?? null,
      setItem: (key: string, value: string) => {
        storage[key] = value
      },
      removeItem: (key: string) => {
        delete storage[key]
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("returns null when no preference is saved", () => {
    expect(loadColumnPreference()).toBeNull()
  })

  it("loads a saved preference", () => {
    storage["evagri:transaction-table:visible-columns"] = JSON.stringify(["a", "c"])
    expect(loadColumnPreference()).toEqual(["a", "c"])
  })

  it("ignores corrupted stored value", () => {
    storage["evagri:transaction-table:visible-columns"] = "not-json"
    expect(loadColumnPreference()).toBeNull()
  })

  it("ignores non-array stored value", () => {
    storage["evagri:transaction-table:visible-columns"] = JSON.stringify({ a: true })
    expect(loadColumnPreference()).toBeNull()
  })

  it("saves a preference", () => {
    saveColumnPreference(["b", "c"])
    expect(storage["evagri:transaction-table:visible-columns"]).toBe(JSON.stringify(["b", "c"]))
  })

  it("clears a preference", () => {
    storage["evagri:transaction-table:visible-columns"] = JSON.stringify(["a"])
    clearColumnPreference()
    expect(storage["evagri:transaction-table:visible-columns"]).toBeUndefined()
  })

  it("returns null on server where localStorage is missing", () => {
    vi.stubGlobal("localStorage", undefined)
    expect(loadColumnPreference()).toBeNull()
  })
})
