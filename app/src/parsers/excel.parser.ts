import * as XLSX from "xlsx"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"

export const SHEET_MAPPING: Record<string, { typologieCode: string }> = {
  Terre: { typologieCode: "TERRES_CULTIVEES" },
  Bois: { typologieCode: "TERRES_BOISEES" },
  "Ventes erablière": { typologieCode: "ERABLIERES" },
  "Ventes erabliere": { typologieCode: "ERABLIERES" },
}

export interface ParsedSheet {
  sheet: string
  typologieCode: string
  rows: Record<string, unknown>[]
}

/** Excel headers often carry stray leading/trailing spaces ("Colonne " vs "Colonne"). Trimming row keys
 *  once, here, keeps every downstream lookup (source mapping, enrichment header extraction) consistent. */
function trimRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    result[key.trim()] = value
  }
  return result
}

export function parseWorkbook(buffer: ArrayBuffer | Uint8Array): ParsedSheet[] {
  const workbook = XLSX.read(buffer, { type: "array" })
  const results: ParsedSheet[] = []

  for (const sheetName of workbook.SheetNames) {
    const mapping = SHEET_MAPPING[sheetName]
    if (!mapping) continue

    const worksheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null })
    const rows = json.map(trimRowKeys)
    if (rows.length > 0) {
      results.push({ sheet: sheetName, rows, typologieCode: mapping.typologieCode })
    }
  }

  return results
}

function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/** Normalized spreadsheet header → `code_machine` of the imported field it feeds, built from the shared
 *  catalogue so the parser and the seeded `Champ.entetesImport` cannot drift. A header shared by several
 *  systems (JLR + EXISTANT_EVAGRI) resolves to the same field code. */
export const IMPORTED_HEADER_TO_CODE: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const field of IMPORTED_FIELDS) {
    for (const header of [...field.entetesImport.JLR, ...field.entetesImport.EXISTANT_EVAGRI]) {
      map[normalizeHeader(header)] = field.code
    }
  }
  return map
})()

export function rowToSourceFields(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [header, value] of Object.entries(row)) {
    if (!header) continue
    const code = IMPORTED_HEADER_TO_CODE[normalizeHeader(header)]
    if (code !== undefined) result[code] = value
  }
  return result
}

const IMPORTED_HEADER_SET = new Set(Object.keys(IMPORTED_HEADER_TO_CODE))

export function isImportedHeader(header: string): boolean {
  return IMPORTED_HEADER_SET.has(normalizeHeader(header))
}

function isIgnoredHeader(header: string): boolean {
  const h = header.trim().toLowerCase()
  return h === "" || h.startsWith("__empty") || h.startsWith("column")
}

export interface EnrichmentHeaderCandidate {
  header: string
  sample: unknown
}

export function extractNonEmptyEnrichmentHeaders(
  rows: Record<string, unknown>[]
): EnrichmentHeaderCandidate[] {
  if (rows.length === 0) return []
  const allHeaders = Object.keys(rows[0]).filter(Boolean)
  const candidates: EnrichmentHeaderCandidate[] = []

  for (const header of allHeaders) {
    if (isImportedHeader(header) || isIgnoredHeader(header)) continue
    const trimmedHeader = header.trim()
    const firstNonEmpty = rows
      .map((r) => r[trimmedHeader])
      .find((v) => v !== null && v !== undefined && v !== "")
    candidates.push({ header: trimmedHeader, sample: firstNonEmpty ?? null })
  }

  return candidates
}

export type InferredDataType = "TEXTE" | "DECIMAL" | "ENTIER" | "BOOLEAN"

export function inferType(value: unknown): InferredDataType {
  if (typeof value === "boolean") return "BOOLEAN"
  if (typeof value === "number") return Number.isInteger(value) ? "ENTIER" : "DECIMAL"
  const str = String(value).trim().replace(",", ".")
  if (!isNaN(Number(str)) && str !== "") return Number.isInteger(Number(str)) ? "ENTIER" : "DECIMAL"
  return "TEXTE"
}
