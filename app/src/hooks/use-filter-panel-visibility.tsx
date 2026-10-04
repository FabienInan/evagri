"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

const STORAGE_KEY = "evagri-transactions-filter-panel-visible"

interface FilterPanelVisibilityContextValue {
  visible: boolean
  toggle: () => void
}

const FilterPanelVisibilityContext = createContext<FilterPanelVisibilityContextValue | null>(null)

/**
 * Shared filter-panel visibility for the transactions views. Mounted once in the transactions
 * layout so the toolbar (which renders the toggle) and the pages (which render the panel) read the
 * same state and stay in sync.
 */
export function FilterPanelVisibilityProvider({
  children,
  defaultValue = true,
}: {
  children: ReactNode
  defaultValue?: boolean
}) {
  const [visible, setVisible] = useState(defaultValue)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) setVisible(stored === "true")
    } catch {
      // ignore storage errors
    }
  }, [])

  const toggle = useCallback(() => {
    setVisible((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // ignore storage errors
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ visible, toggle }), [visible, toggle])

  return (
    <FilterPanelVisibilityContext.Provider value={value}>
      {children}
    </FilterPanelVisibilityContext.Provider>
  )
}

export function useFilterPanelVisibility() {
  const ctx = useContext(FilterPanelVisibilityContext)
  if (!ctx) {
    throw new Error("useFilterPanelVisibility must be used within a FilterPanelVisibilityProvider")
  }
  return ctx
}
