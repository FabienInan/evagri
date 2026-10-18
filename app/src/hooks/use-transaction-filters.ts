"use client"

import { useCallback, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import type { FilterInput } from "@/types/filter"
import { FILTERS_PARAM, parseFiltersParam, stringifyFilters } from "@/lib/transaction-filters"

export { parseFiltersParam, stringifyFilters } from "@/lib/transaction-filters"

export function useTransactionFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const filtersParam = searchParams.get(FILTERS_PARAM)

  // Depend on the raw param string (not `searchParams`) so unrelated params
  // (e.g. `selected`) don't produce a new array reference and retrigger effects.
  const filters = useMemo(() => parseFiltersParam(filtersParam), [filtersParam])

  const updateUrl = useCallback(
    (nextFilters: FilterInput[]) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextFilters.length) {
        params.set(FILTERS_PARAM, stringifyFilters(nextFilters))
      } else {
        params.delete(FILTERS_PARAM)
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
