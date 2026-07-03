"use client"

import { useCallback, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import type { FilterInput } from "@/types/filter"

const FILTERS_PARAM = "filters"

export function parseFiltersParam(raw: string | null): FilterInput[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(decodeURIComponent(raw))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function stringifyFilters(filters: FilterInput[]): string {
  return encodeURIComponent(JSON.stringify(filters))
}

export function useTransactionFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = useMemo(
    () => parseFiltersParam(searchParams.get(FILTERS_PARAM)),
    [searchParams]
  )

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
