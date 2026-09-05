"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

const STORAGE_KEY = "evagri:selected-transactions"

interface SelectedTransactionsContextValue {
  selectedIds: Set<string>
  toggleSelected: (id: string) => void
}

const SelectedTransactionsContext = createContext<SelectedTransactionsContextValue | null>(null)

function loadFromStorage(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? new Set(parsed) : new Set()
  } catch {
    return new Set()
  }
}

/**
 * Shared selection state for the transaction list and map views, persisted to
 * localStorage so it stays visible across reloads and navigation between
 * /transactions and /transactions/map.
 */
export function SelectedTransactionsProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())
  // Loaded lazily in an effect (not in useState's initializer) to keep the
  // server-rendered and first client render identical and avoid a hydration mismatch.
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setSelectedIds(loadFromStorage())
    setIsHydrated(true)
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...selectedIds]))
  }, [selectedIds, isHydrated])

  const toggleSelected = useCallback((id: string) => {
    // Functional update: avoids losing selections when several toggles fire in quick succession.
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const value = useMemo(() => ({ selectedIds, toggleSelected }), [selectedIds, toggleSelected])

  return (
    <SelectedTransactionsContext.Provider value={value}>
      {children}
    </SelectedTransactionsContext.Provider>
  )
}

export function useSelectedTransactions() {
  const ctx = useContext(SelectedTransactionsContext)
  if (!ctx) {
    throw new Error("useSelectedTransactions must be used within a SelectedTransactionsProvider")
  }
  return ctx
}
