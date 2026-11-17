import { writeLocalStorage } from "@/lib/local-storage-store"

export type PanierSort = { field: string; order: "asc" | "desc" }

export const DEFAULT_PANIER_SORT: PanierSort = { field: "date_vente", order: "desc" }

/** Clé localStorage du tri d'un panier, isolée par panier. */
export function panierSortStorageKey(panierId: string): string {
  return `evagri:panier-table:${panierId}:sort`
}

/** Lit un tri enregistré (texte brut de localStorage). Null si absent ou invalide. */
export function parsePanierSort(raw: string | null): PanierSort | null {
  if (!raw) return null
  try {
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

export function loadPanierSort(storageKey: string): PanierSort | null {
  if (typeof globalThis.localStorage === "undefined") return null
  try {
    return parsePanierSort(globalThis.localStorage.getItem(storageKey))
  } catch {
    return null
  }
}

/** Enregistre le tri et notifie les composants qui le lisent (voir useLocalStorageValue). */
export function savePanierSort(storageKey: string, sort: PanierSort): void {
  writeLocalStorage(storageKey, JSON.stringify(sort))
}
