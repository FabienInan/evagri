import { readFile } from "fs/promises"
import * as XLSX from "xlsx"
import { parseWorkbook, rowToSourceFields, extractNonEmptyEnrichmentHeaders, inferType } from "../src/parsers/excel.parser"

const FILE_PATH = "/Users/fabien/Downloads/Bases de données terres et bois.xlsx"

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "(vide)"
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "number") return String(value)
  return String(value)
}

async function main() {
  const buffer = await readFile(FILE_PATH)
  const parsed = parseWorkbook(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))

  console.log("Feuilles reconnues:", parsed.map((s) => ({ sheet: s.sheet, rows: s.rows.length, typologie: s.typologieCode })))

  for (const sheet of parsed) {
    console.log(`\n=== Feuille: ${sheet.sheet} (${sheet.rows.length} lignes) ===`)
    const headers = Object.keys(sheet.rows[0] || {})
    console.log("Headers bruts:", headers)

    const sourceCols = [
      { field: "numeroInscription", headers: ["No d'enregistrement", "No d'enr."] },
      { field: "dateVente", headers: ["Date de L'acte", "Date de l'acte ou de l'avant contrat"] },
      { field: "vendeur", headers: ["Vendeur"] },
      { field: "acheteur", headers: ["Acheteur"] },
      { field: "lotsCadastraux", headers: ["Lots"] },
      { field: "prixVente", headers: ["Prix de vente", "Prix de vente ($)", "Prixdevente($)"] },
      { field: "mrc", headers: ["MRC"] },
      { field: "municipalite", headers: ["Ville/Municipalité"] },
      { field: "adresse", headers: ["Adresse complete", "Adresse complète"] },
      { field: "superficieTotaleHectare", headers: ["Superficie Totale (ha)", "Superficie totale (ha)"] },
      { field: "latitude", headers: ["Latitude"] },
      { field: "longitude", headers: ["Longitude"] },
    ]

    for (const col of sourceCols) {
      const found = headers.find((h) => col.headers.some((k) => h?.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim() === k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim()))
      console.log(`  ${col.field}: ${found ?? "NON TROUVÉ"}`)
    }

    const enrichmentHeaders = extractNonEmptyEnrichmentHeaders(sheet.rows)
    console.log("Champs enrichissables détectés:", enrichmentHeaders.map((h) => h.header))

    let withPriceAndArea = 0
    let withPrice = 0
    let withArea = 0
    let withNeither = 0
    let emptyNumero = 0
    let emptySia = 0

    const mappedRows = sheet.rows.map((r) => rowToSourceFields(r))
    for (let i = 0; i < mappedRows.length; i++) {
      const r = mappedRows[i]
      const prix = r.prixVente
      const sup = r.superficieTotaleHectare
      const hasPrix = prix !== null && prix !== undefined && prix !== ""
      const hasSup = sup !== null && sup !== undefined && sup !== ""
      if (hasPrix && hasSup) withPriceAndArea++
      else if (hasPrix) withPrice++
      else if (hasSup) withArea++
      else withNeither++

      const rawSia = enrichmentHeaders.find((h) => h.header.toLowerCase().includes("sia"))
      const siaValue = rawSia ? sheet.rows[i][rawSia.header] : undefined
      const numero = r.numeroInscription
      const hasNumero = numero !== null && numero !== undefined && numero !== ""
      const hasSia = siaValue !== null && siaValue !== undefined && siaValue !== ""
      if (!hasNumero) emptyNumero++
      if (!hasSia) emptySia++
    }

    console.log("\nComplétude source:")
    console.log(`  Prix + superficie: ${withPriceAndArea}`)
    console.log(`  Prix seulement: ${withPrice}`)
    console.log(`  Superficie seulement: ${withArea}`)
    console.log(`  Ni l'un ni l'autre: ${withNeither}`)
    console.log(`  Lignes sans n° inscription: ${emptyNumero}`)
    console.log(`  Lignes sans SIA: ${emptySia}`)

    console.log("\nExemple des 5 premières lignes source:")
    for (let i = 0; i < Math.min(5, sheet.rows.length); i++) {
      const mapped = mappedRows[i]
      const rawSia = enrichmentHeaders.find((h) => h.header.toLowerCase().includes("sia"))
      console.log(`  Ligne ${i + 2}:`, {
        numeroInscription: formatValue(mapped.numeroInscription),
        dateVente: formatValue(mapped.dateVente),
        prixVente: formatValue(mapped.prixVente),
        superficieTotaleHectare: formatValue(mapped.superficieTotaleHectare),
        sia: rawSia ? formatValue(sheet.rows[i][rawSia.header]) : "(pas de colonne SIA)",
      })
    }
  }

  // Comparaison directe avec xlsx pour quelques cellules
  const workbook = XLSX.read(buffer, { type: "buffer" })
  const firstSheet = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheet]
  const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: null })
  console.log("\n=== Comparaison XLSX brut ===")
  console.log("Headers bruts xlsx:", Object.keys(rawJson[0] || {}))
  for (let i = 0; i < Math.min(3, rawJson.length); i++) {
    console.log(`Ligne ${i + 2} brut:`, rawJson[i])
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
