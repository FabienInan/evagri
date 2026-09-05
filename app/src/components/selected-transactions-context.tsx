"use client"

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react"

interface SelectedTransactionsContextValue {
  selectedIds: Set<string>
  toggleSelected: (id: string) => void
}

const SelectedTransactionsContext = createContext<SelectedTransactionsContextValue | null>(null)

/**
 * Shared, in-memory selection state for the transaction list and map views.
 * Mounted once in the transactions layout so it survives client-side
 * navigation between /transactions and /transactions/map.
 */
export function SelectedTransactionsProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set())

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
