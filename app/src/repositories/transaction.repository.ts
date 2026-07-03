import { prisma } from "@/lib/prisma"
import { buildWhereClause, FilterInput, findGeoFilter } from "@/lib/filters"
import type { Prisma } from "@prisma/client"
import Decimal from "decimal.js"
import type { CreateImportedTransactionInput } from "@/types/import"

export const TRANSACTION_INCLUDE = {
  enrichie: {
    include: {
      valeurs: {
        include: {
          champEnrichissable: true,
        },
      },
    },
  },
} as const

type FindManyArgs = {
  where?: Prisma.TransactionSourceWhereInput
  orderBy?: Prisma.TransactionSourceOrderByWithRelationInput
  skip?: number
  take?: number
}

export async function findTransactions(args: FindManyArgs) {
  return prisma.transactionSource.findMany({
    ...args,
    include: TRANSACTION_INCLUDE,
  })
}

export async function countTransactions(where?: Prisma.TransactionSourceWhereInput) {
  return prisma.transactionSource.count({ where })
}

export function buildTransactionWhere(
  filters: FilterInput[],
  organisationId: string
): Prisma.TransactionSourceWhereInput {
  const filterWhere = buildWhereClause(filters)
  return {
    organisationId,
    ...filterWhere,
  }
}

export type MapTransaction = Prisma.TransactionSourceGetPayload<{
  select: {
    id: true
    numeroInscription: true
    dateVente: true
    prixVente: true
    superficieTotaleHectare: true
    latitude: true
    longitude: true
    municipalite: true
  }
}>

export async function findTransactionsForMap(
  filters: FilterInput[],
  organisationId: string
): Promise<MapTransaction[]> {
  const filterWhere = buildWhereClause(filters)
  const geoFilter = findGeoFilter(filters)

  return prisma.transactionSource.findMany({
    where: {
      organisationId,
      latitude: { not: null },
      longitude: { not: null },
      ...filterWhere,
    },
    select: {
      id: true,
      numeroInscription: true,
      dateVente: true,
      prixVente: true,
      superficieTotaleHectare: true,
      latitude: true,
      longitude: true,
      municipalite: true,
    },
  })
}

export async function findExistingTransaction(
  organisationId: string,
  numeroInscription: string | null | undefined,
  dateVente: Date | null | undefined
) {
  if (!numeroInscription) return null

  const where: Prisma.TransactionSourceWhereInput = {
    organisationId,
    numeroInscription,
  }
  if (dateVente) where.dateVente = dateVente

  return prisma.transactionSource.findFirst({ where })
}

export async function createImportedTransaction(
  input: CreateImportedTransactionInput
) {
  return prisma.$transaction(async (tx) => {
    const txSource = await tx.transactionSource.create({
      data: {
        organisation: { connect: { id: input.organisationId } },
        ...(input.importationId
          ? { importation: { connect: { id: input.importationId } } }
          : {}),
        systemeSource: input.systemeSource,
        ...(input.numeroInscription ? { numeroInscription: input.numeroInscription } : {}),
        ...(input.dateVente ? { dateVente: input.dateVente } : {}),
        prixVente: input.prixVente !== null && input.prixVente !== undefined
          ? new Decimal(input.prixVente)
          : null,
        vendeur: input.vendeur ?? null,
        acheteur: input.acheteur ?? null,
        lotsCadastraux: input.lotsCadastraux,
        adresse: input.adresse ?? null,
        municipalite: input.municipalite ?? null,
        mrc: input.mrc ?? null,
        superficieTotaleHectare:
          input.superficieTotaleHectare !== null && input.superficieTotaleHectare !== undefined
            ? new Decimal(input.superficieTotaleHectare)
            : null,
        latitude:
          input.latitude !== null && input.latitude !== undefined
            ? new Decimal(input.latitude)
            : null,
        longitude:
          input.longitude !== null && input.longitude !== undefined
            ? new Decimal(input.longitude)
            : null,
      },
    })

    const enrichie = await tx.transactionEnrichie.create({
      data: {
        organisationId: input.organisationId,
        transactionSourceId: txSource.id,
        statut: input.statut,
      },
    })

    const valuesToCreate = input.enrichmentValues.filter(
      (v) =>
        v.valeurNombre !== null ||
        v.valeurTexte !== null ||
        v.valeurBooleen !== null
    )

    if (input.typologieValue) {
      valuesToCreate.push({
        champEnrichissableId: input.typologieValue.champEnrichissableId,
        valeurNombre: null,
        valeurTexte: input.typologieValue.valeurTexte,
        valeurBooleen: null,
      })
    }

    if (valuesToCreate.length > 0) {
      await tx.valeurEnrichissement.createMany({
        data: valuesToCreate.map((v) => ({
          transactionEnrichieId: enrichie.id,
          champEnrichissableId: v.champEnrichissableId,
          valeurNombre: v.valeurNombre ?? null,
          valeurTexte: v.valeurTexte ?? null,
          valeurBooleen: v.valeurBooleen ?? null,
        })),
      })
    }

    return { transactionSourceId: txSource.id, transactionEnrichieId: enrichie.id }
  })
}
