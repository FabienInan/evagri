import { cleanText } from "./mappings"

const TRUE_TEXT = new Set(["true", "1", "oui", "yes", "vrai", "o", "y"])
const FALSE_TEXT = new Set(["false", "0", "non", "no", "faux", "n", "aucune", "aucun"])

/** Parses a spreadsheet boolean-ish cell. Real booleans and numbers pass through; text is mapped so a
 *  stored "Non"/"false"/"0" is not coerced to true by a naive `Boolean(value)`. Any other non-empty text
 *  is treated as true (an affirmative remark), empty text as false. */
export function parseBooleanish(value: unknown): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  const key = cleanText(value)?.toLowerCase() ?? ""
  if (TRUE_TEXT.has(key)) return true
  if (FALSE_TEXT.has(key)) return false
  return key !== ""
}

/**
 * Parses a numeric cell tolerating French formatting: decimal comma, dot/space/NBSP/narrow-NBSP thousands
 * separators, and currency/percent symbols. When both separators appear, the rightmost is the decimal one.
 * Returns null when the value is not numeric.
 */
export function parseFrenchNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null

  let s = String(value).replace(/[\s\u00a0\u202f]/g, "").replace(/[$%]/g, "")
  if (s === "") return null

  const lastComma = s.lastIndexOf(",")
  const lastDot = s.lastIndexOf(".")
  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", ".")
    } else {
      s = s.replace(/,/g, "")
    }
  } else if (lastComma !== -1) {
    s = s.replace(/,/g, ".")
  }

  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Derives a snake_case codeMachine from a spreadsheet header, mirroring the codes the importer has always
 * produced (accents are dropped, not transliterated: "cultivée" -> "cultive"). Guarantees the result is
 * usable as a codeMachine by collapsing separators and prefixing `champ_` when it does not start with a
 * letter. Returns "" when nothing usable remains (the caller then falls back to a placeholder).
 */
export function buildCodeMachine(header: string): string {
  const code = header
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
  if (!code) return ""
  return /^[a-z]/.test(code) ? code : `champ_${code}`
}
