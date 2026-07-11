import * as XLSX from "xlsx"

export const SHEET_MAPPING: Record<string, { typologieCode: string }> = {
  Terre: { typologieCode: "TERRES_CULTIVEES" },
  Bois: { typologieCode: "TERRES_BOISEES" },
  "Ventes erablière": { typologieCode: "ERABLIERES" },
  "Ventes erabliere": { typologieCode: "ERABLIERES" },
}

export const SOURCE_COLUMNS = [
  { headerKeys: ["No d'enregistrement", "No d'enr."], field: "numeroInscription" },
  { headerKeys: ["Date de L'acte", "Date de l'acte ou de l'avant contrat"], field: "dateVente" },
  { headerKeys: ["Vendeur"], field: "vendeur" },
  { headerKeys: ["Acheteur"], field: "acheteur" },
  { headerKeys: ["Lots"], field: "lotsCadastraux" },
  { headerKeys: ["Prix de vente", "Prix de vente ($)", "Prixdevente($)"], field: "prixVente" },
  { headerKeys: ["MRC"], field: "mrc" },
  { headerKeys: ["Ville/Municipalité"], field: "municipalite" },
  { headerKeys: ["Adresse complete", "Adresse complète"], field: "adresse" },
  { headerKeys: ["Superficie Totale (ha)", "Superficie totale (ha)"], field: "superficieTotaleHectare" },
]

export interface ParsedSheet {
  sheet: string
  typologieCode: string
  rows: Record<string, unknown>[]
}

export function parseWorkbook(buffer: ArrayBuffer | Uint8Array): ParsedSheet[] {
  const workbook = XLSX.read(buffer, { type: "array" })
  const results: ParsedSheet[] = []

  for (const sheetName of workbook.SheetNames) {
    const mapping = SHEET_MAPPING[sheetName]
    if (!mapping) continue

    const worksheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null })
    if (json.length > 0) {
      results.push({ sheet: sheetName, rows: json, typologieCode: mapping.typologieCode })
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

export function findHeaderIndex(headers: (string | null)[], headerKeys: string[]): number {
  const normalizedHeaders = headers.map((h) => (h ? normalizeHeader(h) : null))
  for (const key of headerKeys) {
    const normalizedKey = normalizeHeader(key)
    const idx = normalizedHeaders.findIndex((h) => h === normalizedKey)
    if (idx !== -1) return idx
  }
  return -1
}

export function rowToSourceFields(row: Record<string, unknown>): Record<string, unknown> {
  const headers = Object.keys(row).map((h) => (h ? h.trim() : null))
  const result: Record<string, unknown> = {}

  for (const col of SOURCE_COLUMNS) {
    const idx = findHeaderIndex(headers, col.headerKeys)
    if (idx !== -1) {
      const rawKey = Object.keys(row)[idx]
      result[col.field] = row[rawKey]
    }
  }

  return result
}

const SOURCE_HEADER_SET = new Set(
  SOURCE_COLUMNS.flatMap((c) => c.headerKeys.map((h) => normalizeHeader(h)))
)

export function isSourceHeader(header: string): boolean {
  return SOURCE_HEADER_SET.has(normalizeHeader(header))
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
    if (isSourceHeader(header) || isIgnoredHeader(header)) continue
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
