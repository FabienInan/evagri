"use client"

import { useCallback, useMemo } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"

const SELECTED_PARAM = "selected"

export function parseSelectedParam(raw: string | null): string[] {
  if (!raw) return []
  return raw.split(",").filter(Boolean)
}

/**
 * Selected transaction ids, persisted in the URL so the selection survives
 * navigation between the list (/transactions) and map (/transactions/map) views.
 */
export function useSelectedTransactions() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const selectedIds = useMemo(
    () => parseSelectedParam(searchParams.get(SELECTED_PARAM)),
    [searchParams]
  )

  const updateUrl = useCallback(
    (nextIds: string[]) => {
      const params = new URLSearchParams(searchParams.toString())
      if (nextIds.length) {
        params.set(SELECTED_PARAM, nextIds.join(","))
      } else {
        params.delete(SELECTED_PARAM)
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  const toggleSelected = useCallback(
    (id: string) => {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((existing) => existing !== id)
        : [...selectedIds, id]
      updateUrl(next)
    },
    [selectedIds, updateUrl]
  )

  const clearSelected = useCallback(() => updateUrl([]), [updateUrl])

  return { selectedIds, toggleSelected, clearSelected }
}
