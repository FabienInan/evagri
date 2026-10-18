"use server"

import { filterByPolygon, findGeoFilter, findRenteFilter, orderRenteTransactions } from "@/lib/filters"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  buildTransactionWhere,
  findRenteLotNumbers,
  findTransactions,
  findTransactionsForSorting,
  withRenteLots,
} from "@/repositories/transaction.repository"
import {
  serializeTransaction,
  serializeTransactionSummary,
  type SerializedTransaction,
} from "@/serializers/transaction.serializer"
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

  // No sortable business column exists on the unified model, so every matching row is ordered in memory.
  // Only the codes needed for that order and the post-filters (geo polygon, revente grouping) are loaded;
  // the displayed page is then fetched with its full set of values. Loading every value of every matching
  // row just to render 25 of them was the dominant cost of returning to the list.
  const codes = new Set<string>([sortField])
  if (geoFilter) {
    codes.add("latitude")
    codes.add("longitude")
  }
  if (duplicatedLots) codes.add("lots_cadastraux")

  let ordered: SerializedTransaction[] = sortTransactionRows(
    (await findTransactionsForSorting(orgId, where, [...codes])).map(serializeTransactionSummary),
    sortField,
    sortOrder
  )

  if (geoFilter) ordered = filterByPolygon(ordered, geoFilter.value)
  // Keep the vente and its revente(s) on consecutive rows without altering either row. The serializer
  // exposes the lots under `fields.lots_cadastraux`; project them to the shape the helper expects.
  if (duplicatedLots) {
    const withLots = ordered.map((row) => ({
      ...row,
      lotsCadastraux: Array.isArray(row.fields.lots_cadastraux) ? row.fields.lots_cadastraux : [],
    }))
    ordered = orderRenteTransactions(withLots, new Set(duplicatedLots))
  }

  const total = ordered.length
  const pageIds = ordered
    .slice((page - 1) * pageSize, page * pageSize)
    .map((row) => row.id)
  const transactions: SerializedTransaction[] = []
  if (pageIds.length > 0) {
    const fullRows = await findTransactions({ where: { id: { in: pageIds } } })
    const byId = new Map(fullRows.map((row) => [row.id, serializeTransaction(row)]))
    for (const id of pageIds) {
      const row = byId.get(id)
      if (row) transactions.push(row)
    }
  }

  return {
    transactions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
