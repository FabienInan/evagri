import Decimal from "decimal.js"
import { findChampByCodeMachine } from "@/repositories/enrichment.repository"
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

const SOURCE_FIELDS: (keyof ParsedRow)[] = [
  "numeroInscription",
  "dateVente",
  "vendeur",
  "acheteur",
  "lotsCadastraux",
  "prixVente",
  "mrc",
  "municipalite",
  "adresse",
  "superficieTotaleHectare",
]

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
  if (value === null || value === undefined || value === "") return null
  const normalized = String(value).trim().replace(",", ".").replace(/\s/g, "")
  const n = Number(normalized)
  return isNaN(n) ? null : n
}

function parseLots(value: unknown): string[] {
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

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && value === 0) return null
  const normalized = String(value).trim()
  return normalized || null
}

function parseEnrichmentValue(
  champ: EnrichmentChamp,
  rawValue: unknown
): Omit<EnrichmentValueInput, "champEnrichissableId"> {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return { valeurNombre: null, valeurTexte: null, valeurBooleen: null }
  }
  if (champ.typeDonnees === "BOOLEAN") {
    return { valeurNombre: null, valeurTexte: null, valeurBooleen: Boolean(rawValue) }
  }
  if (champ.typeDonnees === "TEXTE") {
    return { valeurNombre: null, valeurTexte: String(rawValue), valeurBooleen: null }
  }
  const n = Number(String(rawValue).replace(",", "."))
  if (!isNaN(n)) {
    return { valeurNombre: new Decimal(n), valeurTexte: null, valeurBooleen: null }
  }
  return { valeurNombre: null, valeurTexte: String(rawValue), valeurBooleen: null }
}

function hasSourceValue(raw: ParsedRow, field: keyof ParsedRow): boolean {
  const v = raw[field]
  return v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)
}

function hasAnySourceValue(raw: ParsedRow): boolean {
  return SOURCE_FIELDS.some((field) => hasSourceValue(raw, field))
}

function isVenteAAnalyser(raw: ParsedRow): boolean {
  const minimalFields: (keyof ParsedRow)[] = [
    "numeroInscription",
    "dateVente",
    "mrc",
    "lotsCadastraux",
  ]

  // At least one of the minimal fields must be present
  if (!minimalFields.some((field) => hasSourceValue(raw, field))) return false

  // No supplementary source information should be filled
  const supplementaryFields: (keyof ParsedRow)[] = [
    "vendeur",
    "acheteur",
    "prixVente",
    "adresse",
    "superficieTotaleHectare",
    "municipalite",
  ]
  return supplementaryFields.every((field) => !hasSourceValue(raw, field))
}

export interface ImportSheetInput {
  organisationId: string
  rows: ParsedRow[]
  rawRows: Record<string, unknown>[]
  enrichmentChamps: EnrichmentChamp[]
  systemeSource: string
  importationId: string
  typologieNom?: string
}

export async function importSheet(
  input: ImportSheetInput
): Promise<ImportSheetResult> {
  const { organisationId, rows, rawRows, enrichmentChamps, systemeSource, importationId, typologieNom } = input

  let inserted = 0
  let ignored = 0
  const errors: { row: number; message: string }[] = []

  const typeChamp = await findChampByCodeMachine(organisationId, "typeTransaction")

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    const rawRow = rawRows[i]

    try {
      const numeroInscription = normalizeNumeroInscription(raw.numeroInscription)
      const hasNumero = numeroInscription !== null
      const hasAnySource = hasAnySourceValue(raw)

      const siaChamp = enrichmentChamps.find((c: EnrichmentChamp) => c.codeMachine === "sia")
      const siaValue = siaChamp ? rawRow?.[siaChamp.header] : undefined
      const hasSia = siaValue !== undefined && siaValue !== null && siaValue !== ""

      if (!hasNumero && !raw.dateVente && !hasAnySource && !hasSia) {
        ignored++
        continue
      }

      if (!hasNumero && !hasSia) {
        const context = SOURCE_FIELDS.map((field) => {
          const value = raw[field]
          return `${field}=${
            value === undefined || value === null || value === ""
              ? "(empty)"
              : String(value).slice(0, 50)
          }`
        }).join(", ")
        throw new Error(`Missing numeroInscription or SIA [${context}]`)
      }

      const dateVente = raw.dateVente ? parseDate(raw.dateVente) : null
      if (raw.dateVente && !dateVente) throw new Error(`Invalid date: ${raw.dateVente}`)
      const lots = parseLots(raw.lotsCadastraux)
      const prixVente = parseNumber(raw.prixVente)
      const superficieTotaleHectare = parseNumber(raw.superficieTotaleHectare)

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
        systemeSource === "EXISTANT_EVAGRI" && isVenteAAnalyser(raw)
          ? "A_ANALYSER"
          : "ANALYSEE"

      const enrichmentValues: EnrichmentValueInput[] = enrichmentChamps
        .map((champ: EnrichmentChamp) => {
          const parsed = parseEnrichmentValue(champ, rawRow?.[champ.header])
          if (
            parsed.valeurNombre !== null ||
            parsed.valeurTexte !== null ||
            parsed.valeurBooleen !== null
          ) {
            return { champEnrichissableId: champ.id, ...parsed }
          }
          return null
        })
        .filter(Boolean) as EnrichmentValueInput[]

      await createImportedTransaction({
        organisationId,
        importationId,
        systemeSource,
        numeroInscription,
        dateVente,
        prixVente,
        vendeur: normalizeText(raw.vendeur),
        acheteur: normalizeText(raw.acheteur),
        lotsCadastraux: lots,
        adresse: normalizeText(raw.adresse),
        municipalite: normalizeText(raw.municipalite),
        mrc: normalizeText(raw.mrc),
        superficieTotaleHectare,
        statut,
        enrichmentValues,
        typologieValue:
          typeChamp && typologieNom
            ? { champEnrichissableId: typeChamp.id, valeurTexte: typologieNom }
            : null,
      })

      inserted++
    } catch (e) {
      errors.push({ row: i + 2, message: (e as Error).message })
    }
  }

  return { inserted, ignored, errors }
}
