// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"
import type { ResponsiveColumn } from "@/lib/responsive-columns"

const KEY = "evagri:test:visible-columns"
const columns: ResponsiveColumn[] = [
  { key: "a", minWidth: 100, priority: 1 },
  { key: "b", minWidth: 100, priority: 2 },
  { key: "c", minWidth: 100, priority: 3 },
]

describe("préférences de colonnes après rechargement", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("une colonne cochée reste cochée après un nouveau montage", () => {
    const first = renderHook(() => useResponsiveColumns(columns, new Set(["a"]), [], KEY))
    act(() => first.result.current.toggleColumn("c"))
    expect(window.localStorage.getItem(KEY)).toContain("c")
    first.unmount()

    const second = renderHook(() => useResponsiveColumns(columns, new Set(["a"]), [], KEY))
    expect([...second.result.current.visibleColumns].sort()).toEqual(["a", "c"])
  })

  it("une colonne décochée reste décochée après un nouveau montage", () => {
    const first = renderHook(() => useResponsiveColumns(columns, new Set(["a", "b"]), [], KEY))
    act(() => first.result.current.toggleColumn("b"))
    first.unmount()

    const second = renderHook(() => useResponsiveColumns(columns, new Set(["a", "b"]), [], KEY))
    expect([...second.result.current.visibleColumns]).toEqual(["a"])
  })
})
