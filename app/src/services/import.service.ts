import Decimal from "decimal.js"
import { geocodeLotCadastral } from "@/lib/cadastre"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import { parseBooleanish, parseFrenchNumber } from "@/lib/normalization/parsing"
import { normalizeEnrichmentText } from "@/lib/normalization/transforms"
import { findChampByCodeMachine } from "@/repositories/enrichment.repository"
import { incrementImportationCounters } from "@/repositories/import.repository"
import {
  createImportedTransaction,
  findExistingTransaction,
} from "@/repositories/transaction.repository"
import type {
  EnrichmentChamp,
  EnrichmentValueInput,
  ImportSheetResult,
  ParsedRow,
} from "@/types/import"

const BUSINESS_FIELD_CODES = [
  "numero_inscription",
  "date_vente",
  "vendeur",
  "acheteur",
  "lots_cadastraux",
  "prix_vente",
  "mrc",
  "municipalite",
  "adresse",
  "superficie_totale_hectare",
] as const

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === "number") {
    return new Date(Math.round((value - 25569) * 86400 * 1000))
  }
  if (typeof value === "string") {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function parseNumber(value: unknown): number | null {
  return parseFrenchNumber(value)
}

function parseLots(value: unknown): string[] {
  if (value === null || value === undefined || value === "") return []
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === "number") return [String(value)]
  if (typeof value === "string") return value.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  return []
}

function normalizeNumeroInscription(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  const normalized = String(value).replace(/\s+/g, "").trim()
  return normalized || null
}

function isBlank(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  )
}

type ParsedFieldValue = Omit<EnrichmentValueInput, "champId">

const EMPTY_FIELD_VALUE: ParsedFieldValue = {
  valeurNombre: null,
  valeurTexte: null,
  valeurTexteMultiple: [],
  valeurBooleen: null,
  valeurDate: null,
}

/** Routes a raw spreadsheet cell to the single typed `ValeurChamp` column matching the field's data type. */
export function parseFieldValue(champ: EnrichmentChamp, rawValue: unknown): ParsedFieldValue {
  if (isBlank(rawValue)) return { ...EMPTY_FIELD_VALUE }

  switch (champ.typeDonnees) {
    case "DATE":
      return { ...EMPTY_FIELD_VALUE, valeurDate: parseDate(rawValue) }
    case "BOOLEAN":
      return { ...EMPTY_FIELD_VALUE, valeurBooleen: parseBooleanish(rawValue) }
    case "TEXTE_MULTIPLE":
      return { ...EMPTY_FIELD_VALUE, valeurTexteMultiple: parseLots(rawValue) }
    case "TEXTE":
    case "LISTE":
    case "MULTI_SELECT":
      // LISTE/MULTI_SELECT values are stored as text too, so a catalogued field (e.g. cptaq -> Oui/Non/Partiel)
      // still runs its canonicalizer even though its type is no longer TEXTE.
      return { ...EMPTY_FIELD_VALUE, valeurTexte: normalizeEnrichmentText(champ.codeMachine, rawValue) }
    case "DECIMAL":
    case "ENTIER":
    default: {
      const n = parseFrenchNumber(rawValue)
      if (n !== null) return { ...EMPTY_FIELD_VALUE, valeurNombre: new Decimal(n) }
      return { ...EMPTY_FIELD_VALUE, valeurTexte: String(rawValue) }
    }
  }
}

function hasParsedValue(parsed: ParsedFieldValue): boolean {
  return (
    (parsed.valeurNombre !== undefined && parsed.valeurNombre !== null) ||
    (parsed.valeurTexte !== undefined && parsed.valeurTexte !== null && parsed.valeurTexte !== "") ||
    (parsed.valeurTexteMultiple !== undefined && parsed.valeurTexteMultiple.length > 0) ||
    (parsed.valeurBooleen !== undefined && parsed.valeurBooleen !== null) ||
    (parsed.valeurDate !== undefined && parsed.valeurDate !== null)
  )
}

function hasSourceValue(raw: ParsedRow, field: string): boolean {
  const v = (raw as Record<string, unknown>)[field]
  return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
}

function hasAnySourceValue(raw: ParsedRow): boolean {
  return IMPORTED_FIELDS.some((field) => hasSourceValue(raw, field.code))
}

function isVenteAAnalyser(
  raw: ParsedRow,
  rawRow: Record<string, unknown>,
  enrichmentChamps: EnrichmentChamp[],
  coords: ResolvedCoordinates,
  typologieCode: string
): boolean {
  const terreRequiredSource: readonly string[] = BUSINESS_FIELD_CODES
  const boisRequiredSource: readonly string[] = BUSINESS_FIELD_CODES

  const requiredSource = typologieCode === "TERRES_CULTIVEES" ? terreRequiredSource : boisRequiredSource
  const missingSourceField = requiredSource.some((field) => !hasSourceValue(raw, field))

  function hasEnrichment(codeMachine: string): boolean {
    const champ = enrichmentChamps.find((c) => c.codeMachine === codeMachine)
    if (!champ) return false
    const v = rawRow[champ.header]
    return v !== undefined && v !== null && v !== ""
  }

  const terreRequiredEnrichment = [
    "zone_agricole_cptaq",
    "topographie",
    "classe_de_sol_dominante",
    "sousclasse_dominante",
    "superficie_cultive_ha",
  ]

  const boisRequiredEnrichment = [
    "zone_agricole_cptaq",
    "topographie",
    "proportion_feuillus",
    "densit_plantation",
  ]

  const requiredEnrichment = typologieCode === "TERRES_CULTIVEES" ? terreRequiredEnrichment : boisRequiredEnrichment
  const missingEnrichmentField = requiredEnrichment.some((code) => !hasEnrichment(code))

  const missingCoords = coords === null

  return missingSourceField || missingEnrichmentField || missingCoords
}

export interface ImportSheetInput {
  organisationId: string
  rows: ParsedRow[]
  rawRows: Record<string, unknown>[]
  enrichmentChamps: EnrichmentChamp[]
  systemeSource: string
  importationId: string
  typologieNom?: string
  typologieCode?: string
}

type ResolvedCoordinates = { latitude: number; longitude: number; fromFile: boolean } | null

async function geocodeFromLots(lots: string[]): Promise<{ latitude: number; longitude: number } | null> {
  const results = await Promise.all(lots.slice(0, 5).map((lot) => geocodeLotCadastral(lot)))
  const found = results.filter((r): r is { latitude: number; longitude: number } => r !== null)
  if (found.length === 0) return null
  const sum = found.reduce((acc, r) => ({ lat: acc.lat + r.latitude, lon: acc.lon + r.longitude }), { lat: 0, lon: 0 })
  return { latitude: sum.lat / found.length, longitude: sum.lon / found.length }
}

/** Coordinates already present in the file (now imported `latitude`/`longitude` fields), else geocoded from
 *  the cadastral lots. The write of the resolved values happens in `importSheet`, against the imported fields. */
async function resolveCoordinates(raw: ParsedRow): Promise<ResolvedCoordinates> {
  const latitude = parseNumber(raw.latitude)
  const longitude = parseNumber(raw.longitude)
  if (latitude !== null && longitude !== null) {
    return { latitude, longitude, fromFile: true }
  }

  // parseLots: raw rows may hold the unparsed Excel cell (string/number), not string[]
  const lots = parseLots(raw.lots_cadastraux)
  const lotCoords = lots.length ? await geocodeFromLots(lots) : null
  if (!lotCoords) return null
  return { ...lotCoords, fromFile: false }
}

async function resolveCoordinatesBatch(
  rows: ParsedRow[],
  concurrency = 10
): Promise<ResolvedCoordinates[]> {
  const results: ResolvedCoordinates[] = new Array(rows.length).fill(null)
  let index = 0

  async function worker() {
    while (index < rows.length) {
      const current = index++
      results[current] = await resolveCoordinates(rows[current])
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker())
  await Promise.all(workers)
  return results
}

export async function importSheet(
  input: ImportSheetInput
): Promise<ImportSheetResult> {
  const { organisationId, rows, rawRows, enrichmentChamps, systemeSource, importationId, typologieNom } = input

  let inserted = 0
  let ignored = 0
  const errors: { row: number; message: string }[] = []

  // Deltas since the last progress flush (UI polls these counters during the run).
  const PROGRESS_FLUSH_EVERY = 25
  let lastFlushed = { inserted: 0, ignored: 0, errors: 0 }
  async function flushProgress() {
    const delta = {
      lignesInserees: inserted - lastFlushed.inserted,
      lignesIgnorees: ignored - lastFlushed.ignored,
      lignesErreurs: errors.length - lastFlushed.errors,
    }
    if (!delta.lignesInserees && !delta.lignesIgnorees && !delta.lignesErreurs) return
    lastFlushed = { inserted, ignored, errors: errors.length }
    try {
      await incrementImportationCounters(importationId, delta)
    } catch {
      // Progress reporting must never break the import itself.
    }
  }

  const typeChamp = await findChampByCodeMachine(organisationId, "typeTransaction")

  // Imported fields are seeded per organisation (nature IMPORTE); resolve their `champId` by `code_machine`
  // once for the whole sheet, rather than per row.
  const importedChampIds = new Map<string, string>()
  await Promise.all(
    IMPORTED_FIELDS.map(async (field) => {
      const champ = await findChampByCodeMachine(organisationId, field.code)
      if (champ) importedChampIds.set(field.code, champ.id)
    })
  )

  const resolvedCoordinates = await resolveCoordinatesBatch(rows, 10)

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rawRow = rawRows[i]
    const coords = resolvedCoordinates[i]

    try {
      const numeroInscription = normalizeNumeroInscription(raw.numero_inscription)
      const hasNumero = numeroInscription !== null
      const hasAnySource = hasAnySourceValue(raw)

      const siaChamp = enrichmentChamps.find((c: EnrichmentChamp) => c.codeMachine === "sia")
      const siaValue = siaChamp ? rawRow?.[siaChamp.header] : undefined
      const hasSia = siaValue !== undefined && siaValue !== null && siaValue !== ""

      if (!hasNumero && !raw.date_vente && !hasAnySource && !hasSia) {
        ignored++
        continue
      }

      if (!hasNumero && !hasSia) {
        const context = IMPORTED_FIELDS.map((field) => {
          const value = (raw as Record<string, unknown>)[field.code]
          return `${field.code}=${isBlank(value) ? "(empty)" : String(value).slice(0, 50)}`
        }).join(", ")
        throw new Error(`Missing numero_inscription or SIA [${context}]`)
      }

      const dateVente = raw.date_vente ? parseDate(raw.date_vente) : null
      if (raw.date_vente && !dateVente) throw new Error(`Invalid date: ${raw.date_vente}`)

      if (dateVente && dateVente > new Date()) {
        throw new Error("V-004: date de vente postérieure à aujourd'hui")
      }

      if (numeroInscription) {
        const existing = await findExistingTransaction(organisationId, numeroInscription, dateVente)
        if (existing) {
          ignored++
          continue
        }
      }

      const statut =
        systemeSource === "EXISTANT_EVAGRI" && isVenteAAnalyser(raw, rawRow, enrichmentChamps, coords, input.typologieCode || "")
          ? "NON_ANALYSEE"
          : "ANALYSEE"

      const enrichmentValues: EnrichmentValueInput[] = []

      // One ValeurChamp per imported field present and non-empty (never an all-null row).
      for (const field of IMPORTED_FIELDS) {
        const champId = importedChampIds.get(field.code)
        if (!champId) continue
        const parsed = parseFieldValue(
          { id: champId, header: field.code, codeMachine: field.code, typeDonnees: field.typeDonnees },
          (raw as Record<string, unknown>)[field.code]
        )
        if (hasParsedValue(parsed)) enrichmentValues.push({ champId, ...parsed })
      }

      // Ad-hoc columns created from unrecognised headers (SAISISSABLE champs) keep their own ids.
      for (const champ of enrichmentChamps) {
        const parsed = parseFieldValue(champ, rawRow?.[champ.header])
        if (hasParsedValue(parsed)) enrichmentValues.push({ champId: champ.id, ...parsed })
      }

      // Geocoded coordinates (not read from the file) fill only the axes the file did not provide.
      if (coords && !coords.fromFile) {
        const latitudeChampId = importedChampIds.get("latitude")
        const longitudeChampId = importedChampIds.get("longitude")
        const alreadyPushed = new Set(enrichmentValues.map((v) => v.champId))
        if (latitudeChampId && !alreadyPushed.has(latitudeChampId)) {
          enrichmentValues.push({ champId: latitudeChampId, valeurNombre: new Decimal(coords.latitude) })
        }
        if (longitudeChampId && !alreadyPushed.has(longitudeChampId)) {
          enrichmentValues.push({ champId: longitudeChampId, valeurNombre: new Decimal(coords.longitude) })
        }
      }

      await createImportedTransaction({
        organisationId,
        importationId,
        systemeSource,
        statut,
        enrichmentValues,
        typologieValue:
          typeChamp && typologieNom
            ? { champId: typeChamp.id, valeurTexte: typologieNom }
            : null,
      })

      inserted++
    } catch (e) {
      errors.push({ row: i + 2, message: (e as Error).message })
    }

    if ((i + 1) % PROGRESS_FLUSH_EVERY === 0) {
      await flushProgress()
    }
  }

  await flushProgress()

  return { inserted, ignored, errors }
}
