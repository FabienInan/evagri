"use client"

import { useCallback, useEffect, useState, useSyncExternalStore } from "react"
import {
  computeVisibleColumns,
  loadColumnPreference,
  saveColumnPreference,
  clearColumnPreference,
  type ResponsiveColumn,
} from "@/lib/responsive-columns"

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )
}

export function useResponsiveColumns(
  columns: ResponsiveColumn[],
  initialVisible: Set<string>,
  requiredKeys: string[] = []
) {
  const isClient = useIsClient()
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node)
  }, [])

  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return initialVisible
    const saved = loadColumnPreference()
    return saved ? new Set(saved) : initialVisible
  })

  const [hasUserOverride, setHasUserOverride] = useState(() => {
    if (typeof window === "undefined") return false
    return loadColumnPreference() !== null
  })

  const calculate = useCallback(() => {
    const el = container
    if (!el) return
    const width = el.clientWidth
    if (width <= 0) return
    setVisibleColumnsState(computeVisibleColumns(columns, width, requiredKeys))
  }, [columns, container, requiredKeys])

  useEffect(() => {
    if (hasUserOverride || !container || !isClient) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          calculate()
        }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [calculate, hasUserOverride, container, isClient])

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumnsState((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveColumnPreference([...next])
      return next
    })
    setHasUserOverride(true)
  }, [])

  const resetColumns = useCallback(() => {
    clearColumnPreference()
    setHasUserOverride(false)
    calculate()
  }, [calculate])

  return {
    containerRef,
    visibleColumns,
    toggleColumn,
    resetColumns,
    hasUserOverride,
  }
}
