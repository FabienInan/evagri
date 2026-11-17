"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import type { FilterInput } from "@/types/filter"
import { FILTERS_PARAM, parseFiltersParam, stringifyFilters } from "@/lib/transaction-filters"

export { parseFiltersParam, stringifyFilters } from "@/lib/transaction-filters"

/**
 * Derniers filtres appliqués, gardés pour la session : revenir à la liste par un lien sans paramètre (barre latérale,
 * fiche) rétablit les filtres au lieu de les perdre. Chaîne vide = aucun filtre (ne rien restaurer).
 */
const REMEMBERED_FILTERS_KEY = "evagri:transactions-filters"

function readRememberedFilters(): string {
  try {
    return window.sessionStorage.getItem(REMEMBERED_FILTERS_KEY) ?? ""
  } catch {
    return ""
  }
}

function writeRememberedFilters(value: string): void {
  try {
    window.sessionStorage.setItem(REMEMBERED_FILTERS_KEY, value)
  } catch {
    // Stockage indisponible : les filtres ne sont simplement pas mémorisés.
  }
}

export function useTransactionFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filtersParam = searchParams.get(FILTERS_PARAM)

  // Depend on the raw param string (not `searchParams`) so unrelated params
  // (e.g. `selected`) don't produce a new array reference and retrigger effects.
  const filters = useMemo(() => parseFiltersParam(filtersParam), [filtersParam])

  // Arrivée sans filtres dans l'URL : on rétablit les derniers filtres appliqués (s'il y en avait).
  useEffect(() => {
    if (filtersParam !== null) return
    const remembered = readRememberedFilters()
    if (!remembered) return
    const params = new URLSearchParams(searchParams.toString())
    params.set(FILTERS_PARAM, remembered)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }, [filtersParam, pathname, router, searchParams])

  const updateUrl = useCallback(
    (nextFilters: FilterInput[]) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextFilters.length) {
        params.set(FILTERS_PARAM, stringifyFilters(nextFilters))
        writeRememberedFilters(stringifyFilters(nextFilters))
      } else {
        params.delete(FILTERS_PARAM)
        writeRememberedFilters("")
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const setFilters = useCallback(
    (nextFilters: FilterInput[]) => {
      updateUrl(nextFilters)
    },
    [updateUrl]
  )

  const addOrReplaceFilter = useCallback(
    (filter: FilterInput) => {
      const next = filters.filter((f) => f.id !== filter.id)
      next.push(filter)
      updateUrl(next)
    },
    [filters, updateUrl]
  )

  const removeFilter = useCallback(
    (id: string) => {
      const next = filters.filter((f) => f.id !== id)
      updateUrl(next)
    },
    [filters, updateUrl]
  )

  return {
    filters,
    setFilters,
    addOrReplaceFilter,
    removeFilter,
  }
}
