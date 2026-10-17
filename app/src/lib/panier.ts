import type { SerializedTransaction, SerializedValue } from "@/serializers/transaction.serializer"

/** Normalise une valeur sérialisée pour comparaison : tableaux joints, booléens en 0/1, null conservé. */
function normalizeSortValue(value: SerializedValue): string | number | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.join(",")
  if (typeof value === "boolean") return value ? 1 : 0
  return value
}

/**
 * Trie une liste de transactions sérialisées par un champ de `fields` (aucune colonne triable en base sur
 * le modèle unifié). Les valeurs nulles descendent en fin quel que soit le sens ; le tri des nombres est
 * numérique, le reste en locale fr ; les égalités retombent sur createdAt décroissant. Ne mute pas l'entrée.
 */
export function sortTransactionRows(
  rows: SerializedTransaction[],
  sortField: string,
  sortOrder: "asc" | "desc"
): SerializedTransaction[] {
  const dir = sortOrder === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = normalizeSortValue(a.fields[sortField])
    const bv = normalizeSortValue(b.fields[sortField])
    if (av === null && bv === null) return b.createdAt.localeCompare(a.createdAt)
    if (av === null) return 1
    if (bv === null) return -1

    const an = typeof av === "number" ? av : Number(av)
    const bn = typeof bv === "number" ? bv : Number(bv)
    if (Number.isFinite(an) && Number.isFinite(bn)) {
      if (an !== bn) return (an - bn) * dir
      return b.createdAt.localeCompare(a.createdAt)
    }

    const cmp = String(av).localeCompare(String(bv), "fr")
    if (cmp !== 0) return cmp * dir
    return b.createdAt.localeCompare(a.createdAt)
  })
}
