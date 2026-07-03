import { Prisma } from "@prisma/client"
import Decimal from "decimal.js"

export type EnrichmentValues = Record<string, string | number | boolean | null>

export type SerializedTransaction = {
  id: string
  numeroInscription: string | null
  dateVente: string | null
  prixVente: number | null
  superficieTotaleHectare: number | null
  latitude: number | null
  longitude: number | null
  vendeur: string | null
  acheteur: string | null
  lotsCadastraux: string[]
  mrc: string | null
  municipalite: string | null
  adresse: string | null
  importationId: string | null
  createdAt: string
  enrichment: EnrichmentValues
  enrichie: { statut: string } | null
}

type TransactionWithEnrichie = Prisma.TransactionSourceGetPayload<{
  include: {
    enrichie: {
      include: {
        valeurs: {
          include: {
            champEnrichissable: true
          }
        }
      }
    }
  }
}>

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return new Decimal(value.toString()).toNumber()
}

function extractEnrichmentValues(
  transaction: TransactionWithEnrichie
): EnrichmentValues {
  const enrichment: EnrichmentValues = {}

  for (const v of transaction.enrichie?.valeurs ?? []) {
    const code = v.champEnrichissable?.codeMachine
    if (!code) continue

    if (v.valeurNombre !== null && v.valeurNombre !== undefined) {
      enrichment[code] = decimalToNumber(v.valeurNombre)
    } else if (v.valeurBooleen !== null && v.valeurBooleen !== undefined) {
      enrichment[code] = v.valeurBooleen
    } else {
      enrichment[code] = v.valeurTexte ?? null
    }
  }

  return enrichment
}

export function serializeTransaction(
  transaction: TransactionWithEnrichie
): SerializedTransaction {
  return {
    id: transaction.id,
    numeroInscription: transaction.numeroInscription ?? null,
    dateVente: transaction.dateVente ? transaction.dateVente.toISOString() : null,
    prixVente: decimalToNumber(transaction.prixVente),
    superficieTotaleHectare: decimalToNumber(transaction.superficieTotaleHectare),
    latitude: decimalToNumber(transaction.latitude),
    longitude: decimalToNumber(transaction.longitude),
    vendeur: transaction.vendeur ?? null,
    acheteur: transaction.acheteur ?? null,
    lotsCadastraux: transaction.lotsCadastraux ?? [],
    mrc: transaction.mrc ?? null,
    municipalite: transaction.municipalite ?? null,
    adresse: transaction.adresse ?? null,
    importationId: transaction.importationId ?? null,
    createdAt: transaction.createdAt.toISOString(),
    enrichment: extractEnrichmentValues(transaction),
    enrichie: transaction.enrichie
      ? {
          statut: transaction.enrichie.statut,
        }
      : null,
  }
}
