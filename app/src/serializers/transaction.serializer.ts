import { Prisma } from "@prisma/client"
import Decimal from "decimal.js"

export type SerializedValue = string | number | boolean | string[] | null
export type SerializedTransaction = {
  id: string
  statut: string
  fields: Record<string, SerializedValue>
  latitude: number | null
  longitude: number | null
  importationId: string | null
  createdAt: string
}

type TransactionWithValeurs = Prisma.TransactionGetPayload<{
  include: { valeurs: { include: { champ: true } } }
}>

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return new Decimal(value.toString()).toNumber()
}

export function serializeTransaction(transaction: TransactionWithValeurs): SerializedTransaction {
  const fields: Record<string, SerializedValue> = {}

  for (const v of transaction.valeurs) {
    const code = v.champ?.codeMachine
    if (!code) continue
    if (v.valeurNombre !== null && v.valeurNombre !== undefined) fields[code] = decimalToNumber(v.valeurNombre)
    else if (v.valeurBooleen !== null && v.valeurBooleen !== undefined) fields[code] = v.valeurBooleen
    else if (v.valeurTexteMultiple.length > 0) fields[code] = v.valeurTexteMultiple
    else if (v.valeurDate !== null && v.valeurDate !== undefined) fields[code] = v.valeurDate.toISOString()
    else fields[code] = v.valeurTexte ?? null
  }

  return {
    id: transaction.id,
    statut: transaction.statut,
    fields,
    latitude: typeof fields.latitude === "number" ? fields.latitude : null,
    longitude: typeof fields.longitude === "number" ? fields.longitude : null,
    importationId: transaction.importationId ?? null,
    createdAt: transaction.createdAt.toISOString(),
  }
}
