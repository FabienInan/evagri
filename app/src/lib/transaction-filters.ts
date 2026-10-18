import type { FilterInput } from "@/types/filter"

export const FILTERS_PARAM = "filters"

/** Lit le paramètre `filters` (JSON encodé) de la liste des transactions. */
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

/**
 * Query string à joindre aux liens vers une fiche, pour que la navigation contextuelle
 * (précédent/suivant) reste dans la même liste filtrée et le même tri. Vide sans filtre actif.
 */
export function buildTransactionDetailQuery(input: {
  filters: FilterInput[]
  sortField?: string
  sortOrder?: "asc" | "desc"
}): string {
  if (input.filters.length === 0) return ""
  return buildQuery({ filters: stringifyFilters(input.filters) }, input.sortField, input.sortOrder)
}

/**
 * Contexte d'un panier : la fiche navigue alors uniquement parmi les transactions déjà dans le panier,
 * dans l'ordre d'affichage de sa liste (pas de notion de liste filtrée ici).
 */
export function buildPanierDetailQuery(input: {
  panierId: string
  sortField?: string
  sortOrder?: "asc" | "desc"
}): string {
  return buildQuery({ panier: encodeURIComponent(input.panierId) }, input.sortField, input.sortOrder)
}

function buildQuery(
  params: Record<string, string>,
  sortField: string | undefined,
  sortOrder: "asc" | "desc" | undefined
): string {
  const parts = Object.entries(params).map(([key, value]) => `${key}=${value}`)
  if (sortField) parts.push(`sort=${encodeURIComponent(sortField)}`)
  if (sortOrder) parts.push(`order=${sortOrder}`)
  return `?${parts.join("&")}`
}
