// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, act } from "@testing-library/react"
import { useCallback, useLayoutEffect, useRef, useState } from "react"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"
import { clearColumnPreference } from "@/lib/responsive-columns"

const columns = [
  { key: "a", minWidth: 100, priority: 3 },
  { key: "b", minWidth: 80, priority: 2 },
  { key: "c", minWidth: 60, priority: 1 },
]

const requiredKeys = ["a"]
const STORAGE_KEY = "evagri:transaction-table:visible-columns"

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

function setup(initialVisible: Set<string>, initialWidth: number = 0) {
  const apiRef: { current: ReturnType<typeof useResponsiveColumns> | null } = {
    current: null,
  }
  const setWidthRef: { current: (width: number) => void } = {
    current: () => {},
  }

  function TestComponent({ initialWidth }: { initialWidth: number }) {
    const [width, setWidth] = useState(initialWidth)
    const result = useResponsiveColumns(columns, initialVisible, requiredKeys)
    const containerRef = useRef<HTMLDivElement | null>(null)

    apiRef.current = result
    setWidthRef.current = setWidth

    const setContainer = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node
        result.containerRef(node)
      },
      [result.containerRef]
    )

    useLayoutEffect(() => {
      if (containerRef.current) {
        Object.defineProperty(containerRef.current, "clientWidth", {
          configurable: true,
          value: width,
          writable: true,
        })
      }
    }, [width])

    return (
      <div
        ref={setContainer}
        style={{ width }}
        data-testid="container"
      />
    )
  }

  render(<TestComponent initialWidth={initialWidth} />)

  return {
    get result() {
      if (!apiRef.current) throw new Error("Hook not mounted")
      return apiRef.current
    },
    setWidth(width: number) {
      act(() => setWidthRef.current(width))
    },
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
    const api = setup(new Set<string>(["a"]))

    api.setWidth(180)
    act(() => observer?.trigger(180))

    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b"])
  })

  it("persists manual toggle and stops auto calculation", () => {
    const api = setup(new Set<string>(["a"]))

    api.setWidth(180)
    act(() => observer?.trigger(180))
    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b"])

    act(() => api.result.toggleColumn("c"))

    expect(api.result.hasUserOverride).toBe(true)
    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b", "c"])
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify(["a", "b", "c"])
    )

    api.setWidth(120)
    act(() => observer?.trigger(120))

    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b", "c"])
  })

  it("reset clears preference and resumes auto calculation", () => {
    const api = setup(new Set<string>(["a"]))

    act(() => api.result.toggleColumn("c"))

    api.setWidth(180)
    act(() => observer?.trigger(180))
    act(() => api.result.resetColumns())

    expect(api.result.hasUserOverride).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b"])
  })
})
