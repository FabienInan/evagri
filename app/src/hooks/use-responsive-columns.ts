"use client"

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
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

  const [visibleColumns, setVisibleColumnsState] = useState<Set<string>>(() => initialVisible)

  const [hasUserOverride, setHasUserOverride] = useState(false)
  const initializedRef = useRef(false)

  const calculate = useCallback(
    (el: HTMLDivElement) => {
      const width = el.clientWidth
      if (width <= 0) return
      setVisibleColumnsState(computeVisibleColumns(columns, width, requiredKeys))
    },
    [columns, requiredKeys]
  )

  // Initialize saved preference and calculate only on client to avoid SSR mismatch
  useEffect(() => {
    if (!isClient || initializedRef.current) return
    initializedRef.current = true
    const saved = loadColumnPreference()
    if (saved) {
      setVisibleColumnsState(new Set(saved))
      setHasUserOverride(true)
    } else if (container) {
      calculate(container)
    }
  }, [isClient, container, calculate])

  useEffect(() => {
    if (hasUserOverride || !container || !isClient) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          calculate(entry.target as HTMLDivElement)
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
    if (container) calculate(container)
  }, [calculate, container])

  return {
    containerRef,
    visibleColumns,
    toggleColumn,
    resetColumns,
    hasUserOverride,
  }
}
