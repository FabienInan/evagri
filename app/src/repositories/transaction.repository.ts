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

export type TransactionSourceOrderByInput =
  Prisma.TransactionSourceOrderByWithRelationInput

type FindManyArgs = {
  where?: Prisma.TransactionSourceWhereInput
  orderBy?: TransactionSourceOrderByInput
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

export type MapTransaction = {
  id: string
  numeroInscription: string | null
  dateVente: Date | null
  prixVente: Prisma.Decimal | null
  superficieTotaleHectare: Prisma.Decimal | null
  latitude: number | null
  longitude: number | null
  municipalite: string | null
}

function extractCoordinate(
  values: { valeurNombre: Prisma.Decimal | null; champEnrichissable: { codeMachine: string } | null }[]
): { latitude: number | null; longitude: number | null } {
  let latitude: number | null = null
  let longitude: number | null = null
  for (const v of values) {
    const code = v.champEnrichissable?.codeMachine
    if (!code || v.valeurNombre === null || v.valeurNombre === undefined) continue
    const n = new Decimal(v.valeurNombre.toString()).toNumber()
    if (code === "latitude") latitude = n
    if (code === "longitude") longitude = n
  }
  return { latitude, longitude }
}

export async function findTransactionsForMap(
  filters: FilterInput[],
  organisationId: string
): Promise<MapTransaction[]> {
  const filterWhere = buildWhereClause(filters)

  const rows = await prisma.transactionSource.findMany({
    where: {
      organisationId,
      ...filterWhere,
    },
    select: {
      id: true,
      numeroInscription: true,
      dateVente: true,
      prixVente: true,
      superficieTotaleHectare: true,
      municipalite: true,
      enrichie: {
        select: {
          valeurs: {
            select: {
              valeurNombre: true,
              champEnrichissable: {
                select: { codeMachine: true },
              },
            },
          },
        },
      },
    },
  })

  return rows
    .map((row) => {
      const { latitude, longitude } = extractCoordinate(row.enrichie?.valeurs ?? [])
      return {
        ...row,
        latitude,
        longitude,
      }
    })
    .filter((row) => row.latitude !== null && row.longitude !== null) as MapTransaction[]
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
