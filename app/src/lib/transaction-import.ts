import { prisma } from "./prisma"
import { geocodeAddress } from "./geocode"
import Decimal from "decimal.js"

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

export interface ParsedRow {
  numeroInscription: string
  dateVente: string
  vendeur?: string
  acheteur?: string
  lotsCadastraux?: string[]
  prixVente?: number
  mrc?: string
  municipalite?: string
  adresse?: string
  superficieTotaleHectare?: number
  latitude?: number
  longitude?: number
}

export interface EnrichmentChamp {
  id: string
  header: string
  codeMachine: string
  typeDonnees: string
}

function parseEnrichmentValue(
  champ: EnrichmentChamp,
  rawValue: unknown
): { nombre: Decimal | null; texte: string | null; booleen: boolean | null } {
  if (rawValue === null || rawValue === undefined || rawValue === "") {
    return { nombre: null, texte: null, booleen: null }
  }
  if (champ.typeDonnees === "BOOLEAN") return { nombre: null, texte: null, booleen: Boolean(rawValue) }
  if (champ.typeDonnees === "TEXTE") return { nombre: null, texte: String(rawValue), booleen: null }
  const n = Number(String(rawValue).replace(",", "."))
  if (!isNaN(n)) return { nombre: new Decimal(n), texte: null, booleen: null }
  return { nombre: null, texte: String(rawValue), booleen: null }
}

export async function importTransactions(
  organisationId: string,
  rows: ParsedRow[],
  enrichmentChamps: EnrichmentChamp[],
  rawRows: Record<string, unknown>[],
  _typologieId: string,
  systemeSource: string,
  importationId: string
) {
  let inserted = 0
  let ignored = 0
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    try {
      if (!raw.numeroInscription || !raw.dateVente) {
        throw new Error("Missing numeroInscription or dateVente")
      }

      const dateVente = parseDate(raw.dateVente)
      if (!dateVente) throw new Error(`Invalid date: ${raw.dateVente}`)

      const numeroInscription = String(raw.numeroInscription).trim()
      const lots = parseLots(raw.lotsCadastraux)
      const prixVente = parseNumber(raw.prixVente)
      const superficieTotaleHectare = parseNumber(raw.superficieTotaleHectare)
      const latitude = parseNumber(raw.latitude)
      const longitude = parseNumber(raw.longitude)

      if (dateVente > new Date()) {
        throw new Error("V-004: date de vente postérieure à aujourd'hui")
      }

      const existing = await prisma.transactionSource.findUnique({
        where: {
          organisationId_numeroInscription_dateVente: {
            organisationId,
            numeroInscription,
            dateVente,
          },
        },
      })

      if (existing) {
        ignored++
        continue
      }

      let coords: { latitude: number; longitude: number } | null = null
      if (latitude !== null && longitude !== null) {
        coords = { latitude, longitude }
      } else {
        const geoQuery = [raw.adresse, raw.municipalite].filter(Boolean).join(", ")
        coords = geoQuery ? await geocodeAddress(geoQuery) : null
      }

      await prisma.$transaction(async (tx) => {
        const txSource = await tx.transactionSource.create({
          data: {
            organisationId,
            importationId,
            systemeSource,
            numeroInscription,
            dateVente,
            prixVente: prixVente !== null ? new Decimal(prixVente) : null,
            vendeur: raw.vendeur || null,
            acheteur: raw.acheteur || null,
            lotsCadastraux: lots,
            adresse: raw.adresse || null,
            municipalite: raw.municipalite || null,
            mrc: raw.mrc || null,
            superficieTotaleHectare: superficieTotaleHectare !== null ? new Decimal(superficieTotaleHectare) : null,
            latitude: coords?.latitude !== undefined ? new Decimal(coords.latitude) : null,
            longitude: coords?.longitude !== undefined ? new Decimal(coords.longitude) : null,
          },
        })

        const enrichie = await tx.transactionEnrichie.create({
          data: {
            organisationId,
            transactionSourceId: txSource.id,
            statut: "NON_ANALYSEE",
          },
        })

        const rawRow = rawRows[i]
        for (const champ of enrichmentChamps) {
          const parsed = parseEnrichmentValue(champ, rawRow?.[champ.header])
          if (parsed.nombre !== null || parsed.texte !== null || parsed.booleen !== null) {
            await tx.valeurEnrichissement.create({
              data: {
                transactionEnrichieId: enrichie.id,
                champEnrichissableId: champ.id,
                valeurNombre: parsed.nombre,
                valeurTexte: parsed.texte,
                valeurBooleen: parsed.booleen,
              },
            })
          }
        }
      })

      inserted++
    } catch (e) {
      errors.push({ row: i + 2, message: (e as Error).message })
    }
  }

  return { inserted, ignored, errors }
}
