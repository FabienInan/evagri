"use client"

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react"
import { useLocalStorageValue, writeLocalStorage } from "@/lib/local-storage-store"

const STORAGE_KEY = "evagri-transactions-filter-panel-visible"

interface FilterPanelVisibilityContextValue {
  visible: boolean
  toggle: () => void
}

const FilterPanelVisibilityContext = createContext<FilterPanelVisibilityContextValue | null>(null)

/**
 * Shared filter-panel visibility for the transactions views. Mounted once in the transactions
 * layout so the toolbar (which renders the toggle) and the pages (which render the panel) read the
 * same state and stay in sync. La valeur mémorisée se lit pendant le rendu (aucun effet) : pas de
 * décalage après l'hydratation.
 */
export function FilterPanelVisibilityProvider({
  children,
  defaultValue = true,
}: {
  children: ReactNode
  defaultValue?: boolean
}) {
  const stored = useLocalStorageValue(STORAGE_KEY)
  const visible = stored === null ? defaultValue : stored === "true"

  const toggle = useCallback(() => {
    writeLocalStorage(STORAGE_KEY, String(!visible))
  }, [visible])

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
