"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  computeVisibleColumns,
  loadColumnPreference,
  saveColumnPreference,
  clearColumnPreference,
  type ResponsiveColumn,
} from "@/lib/responsive-columns"

export function useResponsiveColumns(
  columns: ResponsiveColumn[],
  initialVisible: Set<string>,
  requiredKeys: string[] = []
) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null)

  // Reactive ref: setting current notifies React so ResizeObserver can attach
  const containerRef = useMemo(() => {
    let currentValue: HTMLDivElement | null = null
    return {
      get current() {
        return currentValue
      },
      set current(value: HTMLDivElement | null) {
        currentValue = value
        setContainer(value)
      },
    }
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

  const hasUserOverrideRef = useRef(hasUserOverride)
  useEffect(() => {
    hasUserOverrideRef.current = hasUserOverride
  }, [hasUserOverride])

  const calculate = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    const width = el.clientWidth
    if (width <= 0) return
    setVisibleColumnsState(computeVisibleColumns(columns, width, requiredKeys))
  }, [columns, requiredKeys])

  useEffect(() => {
    if (hasUserOverride || !container) return
    const observer = new ResizeObserver((entries) => {
      if (hasUserOverrideRef.current) return
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          calculate()
        }
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [calculate, hasUserOverride, container])

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
