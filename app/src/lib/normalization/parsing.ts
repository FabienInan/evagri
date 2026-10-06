import { cleanText } from "./mappings"

const TRUE_TEXT = new Set(["true", "1", "oui", "yes", "vrai", "o", "y"])
const FALSE_TEXT = new Set(["false", "0", "non", "no", "faux", "n", "aucune", "aucun"])

/**
 * Explicit text tokens that count as an affirmative/negative answer, in a stable order. Unlike
 * parseBooleanish, no "any other text is true" fallback: a boolean search must not match arbitrary values
 * (e.g. "Partiel"). Used to match a boolean filter against a value stored as text rather than as a boolean.
 */
export function booleanTextMatches(value: boolean): string[] {
  return Array.from(value ? TRUE_TEXT : FALSE_TEXT)
}

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

/** Unit tokens a spreadsheet header may carry between parentheses (a spreadsheet column is often titled
 *  "Superficie cultivée (ha)"). Compared on a normalized key (case, spaces and ² folded), the original text
 *  is what gets stored. Anything else in parentheses — "(s)" plural, "(CPTAQ)", "(combiné brute)" — is part
 *  of the name, never a unit, so it is left untouched. */
const KNOWN_UNIT_KEYS = new Set([
  "°",
  "ha",
  "hectare",
  "hectares",
  "m",
  "m2",
  "km2",
  "pi2",
  "acre",
  "acres",
  "%",
  "$",
  "$/ha",
  "$/pi2",
  "$/entaille",
  "entailles/ha",
  "livre",
  "livres",
  "kg",
  "t",
  "tonne",
  "tonnes",
])

function normalizeUnitKey(unit: string): string {
  return unit.trim().toLowerCase().replace(/\s+/g, "").replace(/²/g, "2")
}

/**
 * Splits a trailing "(unit)" off a champ name so the unit lives in `unite` (§6.5) and never in
 * `nom_affichage`. Only recognized unit tokens (KNOWN_UNIT_KEYS) are moved; a name that is nothing but a
 * unit, or whose parentheses are not a unit, is returned unchanged. When `unite` is already set the name
 * keeps the existing unit (so a name that duplicates it — "Taux unitaire global ($/ha)" + unite "$/ha" —
 * is de-duplicated without losing the unit).
 */
export function splitNameUnit(
  nom: string,
  unite: string | null | undefined
): { nom: string; unite: string } {
  const current = unite && unite !== "N/A" ? unite : "N/A"
  const trimmed = nom.trim()
  const match = trimmed.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
  const base = match?.[1]?.trim()
  const inner = match?.[2]?.trim()
  if (!base || !inner || !KNOWN_UNIT_KEYS.has(normalizeUnitKey(inner))) {
    return { nom: trimmed, unite: current }
  }
  return { nom: base, unite: current !== "N/A" ? current : inner }
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
