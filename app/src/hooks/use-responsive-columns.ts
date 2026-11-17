"use client"

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  computeVisibleColumns,
  parseColumnPreference,
  saveColumnPreference,
  clearColumnPreference,
  DEFAULT_COLUMN_PREFERENCE_KEY,
  type ResponsiveColumn,
} from "@/lib/responsive-columns"
import { useLocalStorageValue } from "@/lib/local-storage-store"

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
  requiredKeys: string[] = [],
  storageKey?: string
) {
  const isClient = useIsClient()
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node)
  }, [])

  // Colonnes calculées automatiquement (largeur du conteneur) ou initiales.
  const [computedVisible, setVisibleColumnsState] = useState<Set<string>>(() => initialVisible)

  // Préférence de l'utilisateur : lue pendant le rendu depuis le stockage. Dès qu'elle existe, elle remplace le
  // calcul automatique. Au rendu serveur et à l'hydratation, elle est absente : aucun décalage.
  const storedRaw = useLocalStorageValue(storageKey ?? DEFAULT_COLUMN_PREFERENCE_KEY)
  const savedKeys = useMemo(() => parseColumnPreference(storedRaw), [storedRaw])
  const hasUserOverride = savedKeys !== null
  const visibleColumns = useMemo(
    () => (savedKeys !== null ? new Set(savedKeys) : computedVisible),
    [savedKeys, computedVisible]
  )

  const measuredContainerRef = useRef<HTMLDivElement | null>(null)
  const columnsRef = useRef(columns)
  const requiredKeysRef = useRef(requiredKeys)
  const initialVisibleRef = useRef(initialVisible)

  useEffect(() => {
    columnsRef.current = columns
    requiredKeysRef.current = requiredKeys
    initialVisibleRef.current = initialVisible
  }, [columns, requiredKeys, initialVisible])

  const calculate = useCallback((el: HTMLDivElement) => {
    const width = el.clientWidth
    if (width <= 0) return
    // Seules les colonnes visibles par défaut entrent dans le calcul : les autres restent masquées tant que
    // l'utilisateur ne les coche pas dans le menu « Colonnes ».
    const candidates = columnsRef.current.filter(
      (c) => initialVisibleRef.current.has(c.key) || requiredKeysRef.current.includes(c.key)
    )
    setVisibleColumnsState(
      computeVisibleColumns(candidates, width, requiredKeysRef.current)
    )
  }, [])

  // Calculate visible columns when the container is first measured, but only
  // if no saved user preference exists. Guard prevents infinite loops if the
  // container ref is re-attached during initial render.
  useEffect(() => {
    if (!isClient || !container || hasUserOverride) return
    if (measuredContainerRef.current === container) return
    measuredContainerRef.current = container
    calculate(container)
  }, [isClient, container, hasUserOverride, calculate])

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

  const toggleColumn = useCallback(
    (key: string) => {
      const next = new Set(visibleColumns)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      saveColumnPreference([...next], storageKey)
    },
    [visibleColumns, storageKey]
  )

  /**
   * Freezes the current visible set as the user's preference. Called when the user changes the layout (order,
   * width), so the columns shown after a reload are the ones they saw, not a fresh auto-collapse for the window.
   */
  const persistVisibleColumns = useCallback(() => {
    saveColumnPreference([...visibleColumns], storageKey)
  }, [visibleColumns, storageKey])

  const resetColumns = useCallback(() => {
    clearColumnPreference(storageKey)
    measuredContainerRef.current = null
    if (container) calculate(container)
  }, [calculate, container, storageKey])

  return {
    containerRef,
    visibleColumns,
    toggleColumn,
    persistVisibleColumns,
    resetColumns,
    hasUserOverride,
  }
}
