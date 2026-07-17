import * as fs from "fs"
import * as path from "path"
import { fileURLToPath } from "url"
import * as XLSX from "xlsx"
import assert from "assert"
import {
  normalizeTopography,
  normalizeFeuillusResineux,
  normalizeZoneAgricoleCptaq,
  normalizeTypeCulture,
  normalizeTypeSol,
  normalizeDensitePlantation,
  discretizeProportion,
} from "../src/lib/normalization/transforms"
import { cleanText, toKey } from "../src/lib/normalization/mappings"
import { createReport, incrementCounter, type NormalizationReport } from "../src/lib/normalization/report"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const INPUT_PATH = path.resolve(__dirname, "../../base_donnees_evagri.xlsx")
const OUTPUT_PATH = path.resolve(__dirname, "../../base_donnees_evagri_normalise.xlsx")
const REPORT_PATH = path.resolve(__dirname, "../../base_donnees_evagri_normalise_report.json")

const TRANSACTION_SHEETS = ["Bois", "Terre"]

const DROPPED_COLUMNS = ["Source superficie drainée", "Source superficie cultivée"]

function isEmptyRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every((v) => v === null || v === undefined || v === "")
}

function cleanHeaders(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    const cleanedKey = key.trim()
    if (!cleanedKey || /^__EMPTY/i.test(cleanedKey)) continue
    result[cleanedKey] = value
  }
  return result
}

function normalizeHeaderName(header: string): string {
  const normalized = (cleanText(header) ?? "").toLowerCase()
  if (normalized.includes("prix") && normalized.includes("vente")) return "Prix de vente ($)"
  return header.trim()
}

function normalizeTransactionRow(
  row: Record<string, unknown>,
  sheetName: string,
  report: NormalizationReport
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {}

  for (const [header, value] of Object.entries(row)) {
    const canonicalHeader = normalizeHeaderName(header)

    if (DROPPED_COLUMNS.includes(canonicalHeader)) {
      report.columnsDropped[sheetName] ??= []
      if (!report.columnsDropped[sheetName].includes(canonicalHeader)) {
        report.columnsDropped[sheetName].push(canonicalHeader)
      }
      continue
    }

    if (canonicalHeader === "Superficie boisée" && row["Superficie boisée (ha)"] !== undefined) {
      report.columnsDropped[sheetName] ??= []
      if (!report.columnsDropped[sheetName].includes(canonicalHeader)) {
        report.columnsDropped[sheetName].push(canonicalHeader)
      }
      continue
    }

    switch (canonicalHeader) {
      case "Topographie": {
        const result = normalizeTopography(value)
        normalized[canonicalHeader] = result.normalized
        if (result.hasCombination) {
          normalized["Topographie (combiné brute)"] = result.detail
          incrementCounter(report, "topographie", "combination_flagged")
        }
        if (result.normalized && toKey(result.normalized) !== toKey(value)) {
          incrementCounter(report, "topographie", "mapped")
        }
        break
      }
      case "Feuillus/Résineux": {
        const proportion = discretizeProportion(row["Proportion feuillus"])
        normalized[canonicalHeader] = normalizeFeuillusResineux(value, proportion)
        if (normalized[canonicalHeader] && toKey(normalized[canonicalHeader]) !== toKey(value)) {
          incrementCounter(report, "feuillusrsineux", "mapped")
        }
        break
      }
      case "Proportion feuillus":
      case "Proporition résineux": {
        normalized[canonicalHeader] = discretizeProportion(value)
        break
      }
      case "Zone agricole (CPTAQ)": {
        const result = normalizeZoneAgricoleCptaq(value)
        normalized[canonicalHeader] = result.zone
        if (result.autorisations && result.autorisations.length > 0) {
          normalized["Autorisation CPTAQ"] = result.autorisations.join(" / ")
          incrementCounter(report, "zone_agricole_cptaq", "authorization_extracted")
        }
        if (result.zone && toKey(result.zone) !== toKey(value)) {
          incrementCounter(report, "zone_agricole_cptaq", "normalized")
        }
        break
      }
      case "Sous-classe dominante": {
        const cleaned = cleanText(value)
        normalized[canonicalHeader] = cleaned === "0" ? null : cleaned
        break
      }
      case "Type de culture": {
        normalized[canonicalHeader] = normalizeTypeCulture(value)
        if (normalized[canonicalHeader] && toKey(normalized[canonicalHeader]) !== toKey(value)) {
          incrementCounter(report, "type_de_culture", "mapped")
        }
        break
      }
      case "Densité plantation": {
        normalized[canonicalHeader] = normalizeDensitePlantation(value)
        if (normalized[canonicalHeader] !== value) {
          incrementCounter(report, "densit_plantation", "converted_to_number")
        }
        break
      }
      case "Type de sol": {
        normalized[canonicalHeader] = normalizeTypeSol(value)
        if (normalized[canonicalHeader] && toKey(normalized[canonicalHeader]) !== toKey(value)) {
          incrementCounter(report, "type_de_sol", "mapped")
        }
        break
      }
      case "No d'enr.": {
        normalized[canonicalHeader] =
          typeof value === "string" || typeof value === "number"
            ? String(value).replace(/\s+/g, "")
            : value
        break
      }
      default: {
        normalized[canonicalHeader] = typeof value === "string" ? value.trim() : value
      }
    }
  }

  const hasMunicipalite = Boolean(normalized["Ville/Municipalité"])
  const hasAdresse = Boolean(normalized["Adresse complète"])
  if (!hasMunicipalite && !hasAdresse) {
    normalized["Revue"] = "Localisation manquante"
    incrementCounter(report, "_row", "missing_location")
  }

  return normalized
}

function normalizeSheet(
  rows: Record<string, unknown>[],
  sheetName: string,
  report: NormalizationReport
): Record<string, unknown>[] {
  report.sheetTotals[sheetName] = rows.length
  const cleanedRows = rows.map(cleanHeaders).filter((r) => !isEmptyRow(r))
  report.rowsDropped[sheetName] = rows.length - cleanedRows.length

  return cleanedRows.map((row) => normalizeTransactionRow(row, sheetName, report))
}

async function main() {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input file not found: ${INPUT_PATH}`)
  }

  const buffer = fs.readFileSync(INPUT_PATH)
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const report = createReport()
  const outputSheets: Record<string, Record<string, unknown>[]> = {}

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      raw: true,
      defval: null,
    })

    if (TRANSACTION_SHEETS.includes(sheetName)) {
      outputSheets[sheetName] = normalizeSheet(rows, sheetName, report)
    } else {
      outputSheets[sheetName] = rows
    }
  }

  const outWorkbook = XLSX.utils.book_new()
  for (const [sheetName, rows] of Object.entries(outputSheets)) {
    const worksheet = XLSX.utils.json_to_sheet(rows)
    XLSX.utils.book_append_sheet(outWorkbook, worksheet, sheetName)
  }

  XLSX.writeFile(outWorkbook, OUTPUT_PATH)
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2))

  console.log(`Normalized workbook written to: ${OUTPUT_PATH}`)
  console.log(`Report written to: ${REPORT_PATH}`)

  verifyOutput()
}

function verifyOutput() {
  const outputBuffer = fs.readFileSync(OUTPUT_PATH)
  const wb = XLSX.read(outputBuffer, { type: "buffer", cellDates: true })
  const bois = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Bois"], { raw: true })
  const terre = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets["Terre"], { raw: true })

  const all = [...bois, ...terre]
  const planeRow = all.find((r) => toKey(r["Topographie"]) === "plane")
  assert.ok(planeRow, "Expected at least one row with topography 'Plane'")
  assert.strictEqual(planeRow["Topographie"], "Plane")

  const resineuxRow = bois.find((r) => toKey(r["Feuillus/Résineux"]) === "resineux")
  if (resineuxRow) {
    assert.strictEqual(resineuxRow["Feuillus/Résineux"], "Résineux")
  }

  const inputBuffer = fs.readFileSync(INPUT_PATH)
  const hasRangeDensity = bois.some((r) => r["Densité plantation"] === 0.745)
  assert.ok(hasRangeDensity, "Expected at least one density range converted to median 0.745")

  assert.ok(!bois[0]?.hasOwnProperty("Source superficie drainée"), "Expected source drainée column to be dropped")
  assert.ok(!terre[0]?.hasOwnProperty("Source superficie cultivée"), "Expected source cultivée column to be dropped")

  const feuil1 = XLSX.utils.sheet_to_json(wb.Sheets["Feuil1"])
  assert.ok(feuil1.length > 0, "Expected Feuil1 sheet to remain unchanged")

  console.log("Verification passed")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
