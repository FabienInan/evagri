// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"
import { clearColumnPreference } from "@/lib/responsive-columns"

const columns = [
  { key: "a", minWidth: 100, priority: 3 },
  { key: "b", minWidth: 80, priority: 2 },
  { key: "c", minWidth: 60, priority: 1 },
]

const requiredKeys = ["a"]

class MockResizeObserver {
  callback: ResizeObserverCallback
  target?: Element

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
  }

  observe(target: Element) {
    this.target = target
  }

  disconnect() {
    this.target = undefined
  }

  unobserve() {}

  trigger(width: number) {
    if (!this.target) return
    this.callback(
      [
        {
          target: this.target,
          contentRect: { width } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this
    )
  }
}

describe("useResponsiveColumns", () => {
  let observer: MockResizeObserver | null = null

  beforeEach(() => {
    clearColumnPreference()
    vi.stubGlobal(
      "ResizeObserver",
      class extends MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          super(callback)
          observer = this
        }
      }
    )
  })

  afterEach(() => {
    observer = null
    vi.unstubAllGlobals()
  })

  it("calculates visible columns from container width", () => {
    const initialVisible = new Set<string>(["a"])
    const { result } = renderHook(() =>
      useResponsiveColumns(columns, initialVisible, requiredKeys)
    )

    act(() => {
      result.current.containerRef.current = {
        clientWidth: 180,
      } as HTMLDivElement
    })

    act(() => {
      observer?.trigger(180)
    })

    expect([...result.current.visibleColumns].sort()).toEqual(["a", "b"])
  })

  it("persists manual toggle and stops auto calculation", () => {
    const initialVisible = new Set<string>(["a"])
    const { result } = renderHook(() =>
      useResponsiveColumns(columns, initialVisible, requiredKeys)
    )

    act(() => {
      result.current.containerRef.current = {
        clientWidth: 180,
      } as HTMLDivElement
    })

    act(() => {
      result.current.toggleColumn("c")
    })

    expect(result.current.hasUserOverride).toBe(true)
    expect([...result.current.visibleColumns].sort()).toEqual(["a", "c"])
    expect(window.localStorage.getItem("evagri:transaction-table:visible-columns")).toBe(
      JSON.stringify(["a", "c"])
    )

    act(() => {
      result.current.containerRef.current = {
        clientWidth: 300,
      } as HTMLDivElement
      observer?.trigger(300)
    })

    expect([...result.current.visibleColumns].sort()).toEqual(["a", "c"])
  })

  it("reset clears preference and resumes auto calculation", () => {
    const initialVisible = new Set<string>(["a"])
    const { result } = renderHook(() =>
      useResponsiveColumns(columns, initialVisible, requiredKeys)
    )

    act(() => {
      result.current.toggleColumn("c")
    })

    act(() => {
      result.current.containerRef.current = {
        clientWidth: 180,
      } as HTMLDivElement
      observer?.trigger(180)
      result.current.resetColumns()
    })

    expect(result.current.hasUserOverride).toBe(false)
    expect(window.localStorage.getItem("evagri:transaction-table:visible-columns")).toBeNull()
    expect([...result.current.visibleColumns].sort()).toEqual(["a", "b"])
  })
})
