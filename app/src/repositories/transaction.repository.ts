import { prisma } from "@/lib/prisma"
import { buildWhereClause, FilterInput, findRenteFilter } from "@/lib/filters"
import type { Prisma, StatutTransaction } from "@prisma/client"
import Decimal from "decimal.js"
import type { CreateImportedTransactionInput } from "@/types/import"

export const TRANSACTION_INCLUDE = {
  valeurs: { include: { champ: true } },
} as const

// Kept under the historical name to limit churn; it now aliases the unified Transaction order-by input.
export type TransactionSourceOrderByInput =
  Prisma.TransactionOrderByWithRelationInput

type FindManyArgs = {
  where?: Prisma.TransactionWhereInput
  orderBy?: TransactionSourceOrderByInput
  skip?: number
  take?: number
}

export async function findTransactions(args: FindManyArgs) {
  return prisma.transaction.findMany({
    ...args,
    include: TRANSACTION_INCLUDE,
  })
}

export async function countTransactions(where?: Prisma.TransactionWhereInput) {
  return prisma.transaction.count({ where })
}

export function buildTransactionWhere(
  filters: FilterInput[],
  organisationId: string
): Prisma.TransactionWhereInput {
  const filterWhere = buildWhereClause(filters)
  return {
    organisationId,
    ...filterWhere,
  }
}

/**
 * Lot numbers sold more than once in the organisation. A cadastral lot appearing in ≥ 2 transactions is, by
 * definition, involved in a revente (the original sale plus at least one resale). Returned as the distinct lot
 * values so the caller can constrain `lots_cadastraux` with `hasSome`.
 */
export async function findRenteLotNumbers(organisationId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ lot: string }[]>`
    SELECT lot
    FROM valeur_champ vc
    JOIN champ c ON c.id = vc.id_champ
    JOIN transaction t ON t.id = vc.id_transaction
    CROSS JOIN unnest(vc.valeur_texte_multiple) AS lot
    WHERE t.id_organisation = ${organisationId}
      AND c.code_machine = 'lots_cadastraux'
      AND lot <> ''
    GROUP BY lot
    HAVING count(*) > 1
  `
  return rows.map((row) => row.lot)
}

/** Adds the revente constraint (transactions whose `lots_cadastraux` overlaps the lots sold ≥ 2 times) to an
 *  already-built where clause. An empty `lots` matches nothing, the correct outcome when nothing was resold. */
export function withRenteLots(
  where: Prisma.TransactionWhereInput,
  lots: string[]
): Prisma.TransactionWhereInput {
  const reventeClause: Prisma.TransactionWhereInput = {
    valeurs: { some: { champ: { codeMachine: "lots_cadastraux" }, valeurTexteMultiple: { hasSome: lots } } },
  }
  const existingAnd = where.AND
  return { ...where, AND: [...(Array.isArray(existingAnd) ? existingAnd : existingAnd ? [existingAnd] : []), reventeClause] }
}

/** Adds the revente constraint only when a REVENTE filter is active, computing the duplicated lots in the DB. */
export async function applyRenteWhere(
  where: Prisma.TransactionWhereInput,
  filters: FilterInput[],
  organisationId: string
): Promise<Prisma.TransactionWhereInput> {
  if (!findRenteFilter(filters)) return where
  return withRenteLots(where, await findRenteLotNumbers(organisationId))
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

// Codes machine for the fields the map popup consumes; only these values are loaded per transaction.
const MAP_POPUP_CODES = [
  "latitude",
  "longitude",
  "numero_inscription",
  "date_vente",
  "prix_vente",
  "superficie_totale_hectare",
  "municipalite",
] as const

type MapValue = {
  valeurNombre: Prisma.Decimal | null
  valeurTexte: string | null
  valeurDate: Date | null
  champ: { codeMachine: string } | null
}

/** Indexes a transaction's selected values by `champ.codeMachine` so each popup field can be read by code. */
function indexValuesByCode(
  values: MapValue[]
): Record<string, { nombre: Prisma.Decimal | null; texte: string | null; date: Date | null }> {
  const index: Record<string, { nombre: Prisma.Decimal | null; texte: string | null; date: Date | null }> = {}
  for (const v of values) {
    const code = v.champ?.codeMachine
    if (!code) continue
    index[code] = { nombre: v.valeurNombre ?? null, texte: v.valeurTexte ?? null, date: v.valeurDate ?? null }
  }
  return index
}

function toNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return new Decimal(value.toString()).toNumber()
}

export async function findTransactionsForMap(
  filters: FilterInput[],
  organisationId: string
): Promise<MapTransaction[]> {
  const filterWhere = await applyRenteWhere(buildWhereClause(filters), filters, organisationId)

  const rows = await prisma.transaction.findMany({
    where: {
      organisationId,
      ...filterWhere,
    },
    select: {
      id: true,
      valeurs: {
        // Only the fields the map popup renders: avoids loading every field value per transaction.
        where: {
          champ: { codeMachine: { in: [...MAP_POPUP_CODES] } },
        },
        select: {
          valeurNombre: true,
          valeurTexte: true,
          valeurDate: true,
          champ: {
            select: { codeMachine: true },
          },
        },
      },
    },
  })

  const transactions: MapTransaction[] = []
  for (const row of rows) {
    const values = indexValuesByCode(row.valeurs)
    const latitude = toNumber(values.latitude?.nombre)
    const longitude = toNumber(values.longitude?.nombre)
    // Skip rows without usable coordinates: the map cannot place them.
    if (latitude === null || longitude === null) continue
    transactions.push({
      id: row.id,
      numeroInscription: values.numero_inscription?.texte ?? null,
      dateVente: values.date_vente?.date ?? null,
      prixVente: values.prix_vente?.nombre ?? null,
      superficieTotaleHectare: values.superficie_totale_hectare?.nombre ?? null,
      latitude,
      longitude,
      municipalite: values.municipalite?.texte ?? null,
    })
  }
  return transactions
}

export async function findExistingTransaction(
  organisationId: string,
  numeroInscription: string | null | undefined,
  dateVente: Date | null | undefined
) {
  if (!numeroInscription) return null
  return prisma.transaction.findFirst({
    where: {
      organisationId,
      AND: [
        { valeurs: { some: { champ: { codeMachine: "numero_inscription" }, valeurTexte: numeroInscription } } },
        dateVente
          ? { valeurs: { some: { champ: { codeMachine: "date_vente" }, valeurDate: dateVente } } }
          : { NOT: { valeurs: { some: { champ: { codeMachine: "date_vente" }, valeurDate: { not: null } } } } },
      ],
    },
  })
}

export async function createImportedTransaction(
  input: CreateImportedTransactionInput
) {
  return prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        organisationId: input.organisationId,
        importationId: input.importationId ?? null,
        systemeSource: input.systemeSource,
        statut: input.statut as StatutTransaction,
      },
    })

    const values = input.enrichmentValues.map((v) => ({
      transactionId: transaction.id,
      champId: v.champId,
      valeurNombre: v.valeurNombre ?? null,
      valeurTexte: v.valeurTexte ?? null,
      valeurTexteMultiple: v.valeurTexteMultiple ?? [],
      valeurBooleen: v.valeurBooleen ?? null,
      valeurDate: v.valeurDate ?? null,
    }))

    if (input.typologieValue) {
      values.push({
        transactionId: transaction.id,
        champId: input.typologieValue.champId,
        valeurNombre: null,
        valeurTexte: input.typologieValue.valeurTexte,
        valeurTexteMultiple: [],
        valeurBooleen: null,
        valeurDate: null,
      })
    }

    if (values.length > 0) {
      await tx.valeurChamp.createMany({ data: values })
    }

    return { transactionId: transaction.id }
  })
}
