"use server"

import { filterByPolygon, findGeoFilter } from "@/lib/filters"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  buildTransactionWhere,
  countTransactions,
  findTransactions,
} from "@/repositories/transaction.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import type { FilterInput } from "@/types/filter"
import type { Prisma } from "@prisma/client"
import type { TransactionSearchInput } from "@/types/transaction"

export { type EnrichmentValues } from "@/serializers/transaction.serializer"

export async function searchTransactions(input: TransactionSearchInput) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 10
  const orgId = getCurrentOrganisationId()
  const filters = input.filters || []
  const geoFilter = findGeoFilter(filters)

  const where = buildTransactionWhere(filters, orgId)

  const orderBy: Prisma.TransactionSourceOrderByWithRelationInput = input.sortField
    ? { [input.sortField]: input.sortOrder ?? "asc" }
    : { dateVente: "desc" }

  if (!geoFilter) {
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
  const filtered = filterByPolygon(allTransactions, geoFilter.value)
  const total = filtered.length
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)

  return {
    transactions: paginated.map(serializeTransaction),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
