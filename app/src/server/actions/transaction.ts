"use server"

import { filterByPolygon, findGeoFilter, findRenteFilter, orderRenteTransactions } from "@/lib/filters"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  buildTransactionWhere,
  findRenteLotNumbers,
  findTransactions,
  withRenteLots,
} from "@/repositories/transaction.repository"
import { serializeTransaction, type SerializedTransaction, type SerializedValue } from "@/serializers/transaction.serializer"
import type { TransactionSearchInput } from "@/types/transaction"

/** Normalizes a serialized value for comparison: arrays join with ",", booleans become 0/1, null/undefined stay null. */
function normalizeSortValue(value: SerializedValue): string | number | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.join(",")
  if (typeof value === "boolean") return value ? 1 : 0
  return value
}

/**
 * Orders serialized transactions by a business field held in `fields`. There is no sortable column on the
 * unified model, so ordering happens in memory. Nulls sink to the end regardless of direction; numeric
 * values compare numerically, everything else as locale strings (ISO dates therefore sort chronologically).
 * Ties fall back to createdAt descending (newest first).
 */
function compareByField(
  a: SerializedTransaction,
  b: SerializedTransaction,
  sortField: string,
  dir: 1 | -1
): number {
  const av = normalizeSortValue(a.fields[sortField])
  const bv = normalizeSortValue(b.fields[sortField])

  if (av === null && bv === null) return b.createdAt.localeCompare(a.createdAt)
  if (av === null) return 1
  if (bv === null) return -1

  const an = typeof av === "number" ? av : Number(av)
  const bn = typeof bv === "number" ? bv : Number(bv)
  if (Number.isFinite(an) && Number.isFinite(bn)) {
    if (an !== bn) return (an - bn) * dir
    return b.createdAt.localeCompare(a.createdAt)
  }

  const cmp = String(av).localeCompare(String(bv), "fr")
  if (cmp !== 0) return cmp * dir
  return b.createdAt.localeCompare(a.createdAt)
}

export async function searchTransactions(input: TransactionSearchInput) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 10
  const orgId = getCurrentOrganisationId()
  const filters = input.filters || []
  const geoFilter = findGeoFilter(filters)
  const duplicatedLots = findRenteFilter(filters) ? await findRenteLotNumbers(orgId) : null

  let where = buildTransactionWhere(filters, orgId)
  if (duplicatedLots) where = withRenteLots(where, duplicatedLots)

  const sortField = input.sortField ?? "date_vente"
  const dir: 1 | -1 = (input.sortOrder ?? "desc") === "asc" ? 1 : -1

  // No sortable business column exists on the unified model, so every matching row is loaded, serialized
  // and ordered in memory; the geo polygon and revente grouping post-processing runs on the same collection
  // before pagination is applied (a geo/rente set needs the whole set in memory anyway).
  const allTransactions = await findTransactions({ where })
  let serialized: SerializedTransaction[] = allTransactions.map(serializeTransaction)
  serialized.sort((a, b) => compareByField(a, b, sortField, dir))

  if (geoFilter) serialized = filterByPolygon(serialized, geoFilter.value)
  // Keep the vente and its revente(s) on consecutive rows without altering either row. The serializer
  // exposes the lots under `fields.lots_cadastraux`; project them to the shape the helper expects.
  if (duplicatedLots) {
    const withLots = serialized.map((row) => ({
      ...row,
      lotsCadastraux: Array.isArray(row.fields.lots_cadastraux) ? row.fields.lots_cadastraux : [],
    }))
    serialized = orderRenteTransactions(withLots, new Set(duplicatedLots))
  }

  const total = serialized.length
  const paginated = serialized.slice((page - 1) * pageSize, page * pageSize)

  return {
    transactions: paginated,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
