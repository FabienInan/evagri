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

    // Référence stable de la fonction du hook : évite de dépendre de l'objet `result` à chaque rendu.
    const registerContainer = result.containerRef
    const setContainer = useCallback(
      (node: HTMLDivElement | null) => {
        containerRef.current = node
        registerContainer(node)
      },
      [registerContainer]
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
  let windowWidth = 1200

  /** Redimensionne la fenêtre puis notifie le conteneur : seul ce cas recalcule les colonnes. */
  function resizeObserved(width: number) {
    windowWidth += 1
    Object.defineProperty(window, "innerWidth", { configurable: true, value: windowWidth, writable: true })
    observer?.trigger(width)
  }

  // Le constructeur passe l'instance à ce rangement, sans alias de `this` dans une variable.
  const keepObserver = (instance: MockResizeObserver) => {
    observer = instance
  }

  beforeEach(() => {
    clearColumnPreference()
    vi.stubGlobal(
      "ResizeObserver",
      class extends MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          super(callback)
          keepObserver(this)
        }
      }
    )
  })

  afterEach(() => {
    observer = null
    vi.unstubAllGlobals()
  })

  it("ne recalcule pas les colonnes quand seule la largeur du conteneur change (volet de filtres)", () => {
    const api = setup(new Set<string>(["a", "b", "c"]))

    api.setWidth(180)
    act(() => resizeObserved(180))
    const beforePanel = [...api.result.visibleColumns].sort()

    // Le volet s'ouvre : le conteneur se rétrécit, la fenêtre ne change pas.
    api.setWidth(120)
    act(() => observer?.trigger(120))

    expect([...api.result.visibleColumns].sort()).toEqual(beforePanel)
  })

  it("calculates visible columns from container width", () => {
    const api = setup(new Set<string>(["a", "b", "c"]))

    api.setWidth(180)
    act(() => resizeObserved(180))

    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b"])
  })

  it("persists manual toggle and stops auto calculation", () => {
    const api = setup(new Set<string>(["a", "b", "c"]))

    api.setWidth(180)
    act(() => resizeObserved(180))
    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b"])

    act(() => api.result.toggleColumn("c"))

    expect(api.result.hasUserOverride).toBe(true)
    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b", "c"])
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify(["a", "b", "c"])
    )

    api.setWidth(120)
    act(() => resizeObserved(120))

    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b", "c"])
  })

  it("reset clears preference and resumes auto calculation", () => {
    const api = setup(new Set<string>(["a", "b", "c"]))

    act(() => api.result.toggleColumn("c"))

    api.setWidth(180)
    act(() => resizeObserved(180))
    act(() => api.result.resetColumns())

    expect(api.result.hasUserOverride).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect([...api.result.visibleColumns].sort()).toEqual(["a", "b"])
  })

  it("n'affiche jamais une colonne masquée par défaut, même sans contrainte de largeur", () => {
    // Un panier typé ne cale pas la largeur (minWidth 0) : seules les colonnes par défaut doivent rester visibles.
    const api = setup(new Set<string>(["a"]))

    api.setWidth(1000)
    act(() => resizeObserved(1000))

    expect([...api.result.visibleColumns]).toEqual(["a"])
  })
})
