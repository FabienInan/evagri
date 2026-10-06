"use server"

import { filterByPolygon, findGeoFilter, findRenteFilter, orderRenteTransactions } from "@/lib/filters"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  buildTransactionWhere,
  countTransactions,
  findRenteLotNumbers,
  findTransactions,
  withRenteLots,
  type TransactionSourceOrderByInput,
} from "@/repositories/transaction.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import type { FilterInput } from "@/types/filter"
import type { TransactionSearchInput } from "@/types/transaction"

export { type EnrichmentValues } from "@/serializers/transaction.serializer"

export async function searchTransactions(input: TransactionSearchInput) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 10
  const orgId = getCurrentOrganisationId()
  const filters = input.filters || []
  const geoFilter = findGeoFilter(filters)
  const duplicatedLots = findRenteFilter(filters) ? await findRenteLotNumbers(orgId) : null

  let where = buildTransactionWhere(filters, orgId)
  if (duplicatedLots) where = withRenteLots(where, duplicatedLots)

  const orderBy: TransactionSourceOrderByInput = input.sortField
    ? { [input.sortField]: input.sortOrder ?? "asc" }
    : { dateVente: "desc" }

  // A geo polygon and the revente grouping both need the whole matching set in memory (to filter or to
  // order it), so pagination is applied after that post-processing rather than in the query.
  if (!geoFilter && !duplicatedLots) {
    const [transactions, total] = await Promise.all([
      findTransactions({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
      }),
      countTransactions(where),
    ])

    return {
      transactions: transactions.map(serializeTransaction),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  const allTransactions = await findTransactions({ where, orderBy })
  let serialized = allTransactions.map(serializeTransaction)
  if (geoFilter) serialized = filterByPolygon(serialized, geoFilter.value)
  // Keep the vente and its revente(s) on consecutive rows without altering either row.
  if (duplicatedLots) serialized = orderRenteTransactions(serialized, new Set(duplicatedLots))

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
