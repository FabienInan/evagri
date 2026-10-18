import { Prisma } from "@prisma/client"
import Decimal from "decimal.js"
import type { SerializedTransaction, SerializedValue } from "@/types/transaction"

export type { SerializedTransaction, SerializedValue } from "@/types/transaction"

type TransactionWithValeurs = Prisma.TransactionGetPayload<{
  include: { valeurs: { include: { champ: true } } }
}>

type ValueRow = {
  valeurNombre: Prisma.Decimal | null
  valeurTexte: string | null
  valeurTexteMultiple: string[]
  valeurBooleen: boolean | null
  valeurDate: Date | null
  champ: { codeMachine: string } | null
}

type TransactionBase = {
  id: string
  statut: string
  importationId: string | null
  createdAt: Date
}

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return new Decimal(value.toString()).toNumber()
}

function hydrateFields(valeurs: ValueRow[]): Record<string, SerializedValue> {
  const fields: Record<string, SerializedValue> = {}

  for (const v of valeurs) {
    const code = v.champ?.codeMachine
    if (!code) continue
    if (v.valeurNombre !== null && v.valeurNombre !== undefined) fields[code] = decimalToNumber(v.valeurNombre)
    else if (v.valeurBooleen !== null && v.valeurBooleen !== undefined) fields[code] = v.valeurBooleen
    else if (v.valeurTexteMultiple.length > 0) fields[code] = v.valeurTexteMultiple
    else if (v.valeurDate !== null && v.valeurDate !== undefined) fields[code] = v.valeurDate.toISOString()
    else fields[code] = v.valeurTexte ?? null
  }

  return fields
}

function toSerialized(base: TransactionBase, fields: Record<string, SerializedValue>): SerializedTransaction {
  return {
    id: base.id,
    statut: base.statut,
    fields,
    latitude: typeof fields.latitude === "number" ? fields.latitude : null,
    longitude: typeof fields.longitude === "number" ? fields.longitude : null,
    importationId: base.importationId ?? null,
    createdAt: base.createdAt.toISOString(),
  }
}

export function serializeTransaction(transaction: TransactionWithValeurs): SerializedTransaction {
  return toSerialized(transaction, hydrateFields(transaction.valeurs))
}

/**
 * Variante allégée pour le tri : `valeurs` ne contient que les codes nécessaires au tri et aux post-filtres
 * (géométrie, lots), donc `fields` est partiel. Utilisée par la première passe de `searchTransactions`.
 */
export function serializeTransactionSummary(
  transaction: TransactionBase & { valeurs: ValueRow[] }
): SerializedTransaction {
  return toSerialized(transaction, hydrateFields(transaction.valeurs))
}
