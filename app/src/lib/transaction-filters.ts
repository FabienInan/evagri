import type { FilterInput } from "@/types/filter"

export const FILTERS_PARAM = "filters"
/** Marqueur « la fiche a été ouverte depuis la liste des transactions » (même sans filtre actif). */
export const LISTE_PARAM = "liste"

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
 * (précédent/suivant) reste dans la même liste et le même tri. `liste=1` marque l'origine même
 * sans filtre actif : la fiche navigue alors dans la liste complète, dans l'ordre affiché.
 */
export function buildTransactionDetailQuery(input: {
  filters: FilterInput[]
  sortField?: string
  sortOrder?: "asc" | "desc"
}): string {
  const params: Record<string, string> = {}
  if (input.filters.length > 0) params.filters = stringifyFilters(input.filters)
  params[LISTE_PARAM] = "1"
  return buildQuery(params, input.sortField, input.sortOrder)
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
