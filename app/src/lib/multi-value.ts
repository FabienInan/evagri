/**
 * A MULTI_SELECT enrichment value is persisted in the single `valeur_texte` column as a delimited list.
 * The importer already produced that shape for combined spreadsheet answers ("Cultures annuelles, Prairie"),
 * so legacy data round-trips without migration. Splitting also tolerates the " / " and " et " variants an
 * offline normalizer may have written, and de-duplicates while keeping first-seen order.
 */
export const MULTI_VALUE_SEPARATOR = ", "

export function parseMultiValue(value: unknown): string[] {
  if (value === null || value === undefined) return []
  const text = String(value).trim()
  if (text === "") return []
  const parts = text
    .split(/\s*[,/;]\s*|\s+et\s+/i)
    .map((part) => part.trim())
    .filter((part) => part !== "")
  return Array.from(new Set(parts))
}

/** Joins selections back into the stored form. Returns null for an empty selection so an emptied field
 *  persists as no value rather than an empty string. */
export function joinMultiValue(values: readonly string[]): string | null {
  const cleaned = values.map((value) => value.trim()).filter((value) => value !== "")
  const unique = Array.from(new Set(cleaned))
  return unique.length > 0 ? unique.join(MULTI_VALUE_SEPARATOR) : null
}
