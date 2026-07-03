"use client"

import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "evagri-transactions-filter-panel-visible"

export function useFilterPanelVisibility(defaultValue = true) {
  const [visible, setVisible] = useState(defaultValue)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) {
        setVisible(stored === "true")
      }
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

  return { visible, toggle }
}
