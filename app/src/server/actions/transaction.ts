"use server"

import { filterByPolygon, findGeoFilter, findRenteFilter, orderRenteTransactions } from "@/lib/filters"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  buildTransactionWhere,
  findRenteLotNumbers,
  findTransactions,
  withRenteLots,
} from "@/repositories/transaction.repository"
import { serializeTransaction, type SerializedTransaction } from "@/serializers/transaction.serializer"
import type { TransactionSearchInput } from "@/types/transaction"
import { sortTransactionRows } from "@/lib/transaction-sort"

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
  const sortOrder = input.sortOrder ?? "desc"

  // No sortable business column exists on the unified model, so every matching row is loaded, serialized
  // and ordered in memory; the geo polygon and revente grouping post-processing runs on the same collection
  // before pagination is applied (a geo/rente set needs the whole set in memory anyway).
  const allTransactions = await findTransactions({ where })
  let serialized: SerializedTransaction[] = sortTransactionRows(
    allTransactions.map(serializeTransaction),
    sortField,
    sortOrder
  )

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
