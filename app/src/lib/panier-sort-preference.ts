export type PanierSort = { field: string; order: "asc" | "desc" }

export const DEFAULT_PANIER_SORT: PanierSort = { field: "date_vente", order: "desc" }

/** Clé localStorage du tri d'un panier, isolée par panier. */
export function panierSortStorageKey(panierId: string): string {
  return `evagri:panier-table:${panierId}:sort`
}

export function loadPanierSort(storageKey: string): PanierSort | null {
  if (typeof globalThis.localStorage === "undefined") return null
  try {
    const raw = globalThis.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as PanierSort).field === "string" &&
      ((parsed as PanierSort).order === "asc" || (parsed as PanierSort).order === "desc")
    ) {
      return { field: (parsed as PanierSort).field, order: (parsed as PanierSort).order }
    }
    return null
  } catch {
    return null
  }
}

export function savePanierSort(storageKey: string, sort: PanierSort): void {
  if (typeof globalThis.localStorage === "undefined") return
  globalThis.localStorage.setItem(storageKey, JSON.stringify(sort))
}
