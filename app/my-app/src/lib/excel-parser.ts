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
  { headerKeys: ["Latitude"], field: "latitude" },
  { headerKeys: ["Longitude"], field: "longitude" },
]

export function parseWorkbook(buffer: ArrayBuffer | Uint8Array) {
  const workbook = XLSX.read(buffer, { type: "array" })
  const results: {
    sheet: string
    rows: Record<string, unknown>[]
    typologieCode: string
  }[] = []

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

export function findHeaderIndex(headers: (string | null)[], headerKeys: string[]): number {
  for (const key of headerKeys) {
    const idx = headers.findIndex((h) => h?.trim().toLowerCase() === key.toLowerCase())
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
      const key = headers[idx] as string
      result[col.field] = row[key]
    }
  }

  return result
}

const SOURCE_HEADER_SET = new Set(SOURCE_COLUMNS.flatMap((c) => c.headerKeys.map((h) => h.toLowerCase())))

export function isSourceHeader(header: string): boolean {
  return SOURCE_HEADER_SET.has(header.toLowerCase())
}

function isIgnoredHeader(header: string): boolean {
  const h = header.trim().toLowerCase()
  return h === "" || h.startsWith("__empty") || h.startsWith("column")
}

export function extractNonEmptyEnrichmentHeaders(
  rows: Record<string, unknown>[]
): { header: string; sample: unknown }[] {
  if (rows.length === 0) return []
  const allHeaders = Object.keys(rows[0]).filter(Boolean)
  const candidates: { header: string; sample: unknown }[] = []

  for (const header of allHeaders) {
    if (isSourceHeader(header) || isIgnoredHeader(header)) continue
    const trimmedHeader = header.trim()
    const firstNonEmpty = rows
      .map((r) => r[trimmedHeader])
      .find((v) => v !== null && v !== undefined && v !== "")
    if (firstNonEmpty !== undefined) {
      candidates.push({ header: trimmedHeader, sample: firstNonEmpty })
    }
  }

  return candidates
}

export function inferType(value: unknown): "TEXTE" | "DECIMAL" | "ENTIER" | "BOOLEAN" {
  if (typeof value === "boolean") return "BOOLEAN"
  if (typeof value === "number") return Number.isInteger(value) ? "ENTIER" : "DECIMAL"
  const str = String(value).trim().replace(",", ".")
  if (!isNaN(Number(str)) && str !== "") return Number.isInteger(Number(str)) ? "ENTIER" : "DECIMAL"
  return "TEXTE"
}
