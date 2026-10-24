import Decimal from "decimal.js"
import { geocodeLotCadastral } from "@/lib/cadastre"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import { parseBooleanish, parseFrenchNumber } from "@/lib/normalization/parsing"
import { normalizeEnrichmentText, normalizeNumeroInscription } from "@/lib/normalization/transforms"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { findChampByCodeMachine } from "@/repositories/enrichment.repository"
import { incrementImportationCounters } from "@/repositories/import.repository"
import {
  createImportedTransactions,
  findDedupKeysByNumeros,
} from "@/repositories/transaction.repository"
import { computeCalculatedEnrichment } from "@/services/calcul.service"
import type {
  CreateImportedTransactionInput,
  EnrichmentChamp,
  EnrichmentValueInput,
  ImportSheetResult,
  ParsedRow,
} from "@/types/import"

const WRITE_BATCH_SIZE = 200

/** Dedup key of the importer: a re-import matches a stored transaction on numero and on date de vente. */
function dedupKeyOf(numero: string, date: Date | null): string {
  return `${numero}|${date ? date.getTime() : ""}`
}

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
  const champsCatalogue = await listChampsEnrichissablesByOrganisation(organisationId)

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

  // Dedup keys of the sheet's numeros, loaded once. Rows queued below join the set, so a repeated row in the
  // same file is ignored as a re-import would be.
  const numeros = [
    ...new Set(rows.map((raw) => normalizeNumeroInscription(raw.numero_inscription)).filter((n): n is string => n !== null)),
  ]
  const existingKeys = new Set(
    (await findDedupKeysByNumeros(organisationId, numeros)).map((k) => dedupKeyOf(k.numero, k.date))
  )

  // Rows are validated one by one, then written in batches: a failing batch is retried row by row so that
  // only the faulty rows are reported.
  type PendingRow = { row: number; input: CreateImportedTransactionInput; key: string | null }
  let pending: PendingRow[] = []

  async function flushBatch() {
    if (pending.length === 0) return
    const batch = pending
    pending = []
    try {
      await createImportedTransactions(batch.map((p) => p.input))
      inserted += batch.length
    } catch {
      for (const item of batch) {
        try {
          await createImportedTransactions([item.input])
          inserted++
        } catch (e) {
          if (item.key) existingKeys.delete(item.key)
          errors.push({ row: item.row, message: (e as Error).message })
        }
      }
    }
  }

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

      const key = numeroInscription ? dedupKeyOf(numeroInscription, dateVente) : null
      if (key && existingKeys.has(key)) {
        ignored++
        continue
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

      // CALCULE values are derived from the imported figures, so they are stored like any other value.
      const withCalcul = new Set(enrichmentValues.map((v) => v.champId))
      for (const calcul of computeCalculatedEnrichment(champsCatalogue, enrichmentValues)) {
        if (!withCalcul.has(calcul.champId)) enrichmentValues.push(calcul)
      }

      if (key) existingKeys.add(key)
      pending.push({
        row: i + 2,
        key,
        input: {
          organisationId,
          importationId,
          systemeSource,
          statut,
          enrichmentValues,
          typologieValue:
            typeChamp && typologieNom
              ? { champId: typeChamp.id, valeurTexte: typologieNom }
              : null,
        },
      })
      if (pending.length >= WRITE_BATCH_SIZE) await flushBatch()
    } catch (e) {
      errors.push({ row: i + 2, message: (e as Error).message })
    }

    if ((i + 1) % PROGRESS_FLUSH_EVERY === 0) {
      await flushProgress()
    }
  }

  await flushBatch()
  await flushProgress()

  return { inserted, ignored, errors }
}
