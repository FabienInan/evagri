"use client"

import { createContext, useContext, useState, useCallback, type ReactNode } from "react"

type HeaderActionsContextValue = {
  action: ReactNode
  setAction: (action: ReactNode) => void
  clearAction: () => void
}

const HeaderActionsContext = createContext<HeaderActionsContextValue | undefined>(undefined)

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [action, setActionState] = useState<ReactNode>(null)

  const setAction = useCallback((next: ReactNode) => {
    setActionState(next)
  }, [])

  const clearAction = useCallback(() => {
    setActionState(null)
  }, [])

  return (
    <HeaderActionsContext.Provider value={{ action, setAction, clearAction }}>
      {children}
    </HeaderActionsContext.Provider>
  )
}

export function useHeaderActions() {
  const value = useContext(HeaderActionsContext)
  if (!value) {
    throw new Error("useHeaderActions must be used within a HeaderActionsProvider")
  }
  return value
}
