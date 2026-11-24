"use server"

import { utilisateurPourZone } from "@/lib/session"
import { findTransactions } from "@/repositories/transaction.repository"
import {
  serializeTransaction,
  type SerializedTransaction,
} from "@/serializers/transaction.serializer"
import type { TransactionSearchInput } from "@/types/transaction"
import { getOrderedTransactionIds } from "@/server/transaction-order"

export async function searchTransactions(input: TransactionSearchInput) {
  // Empty result for a caller without the zone: the route answers 403 before this runs, and no row leaks.
  const utilisateur = await utilisateurPourZone("evaluation")
  if (!utilisateur) return { transactions: [], total: 0, page: 1, pageSize: 10, totalPages: 0 }
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 10
  const orgId = utilisateur.organisationId
  const filters = input.filters || []
  const sortField = input.sortField ?? "date_vente"
  const sortOrder = input.sortOrder ?? "desc"

  // No sortable business column exists on the unified model, so every matching row is ordered in memory.
  // Only the ids are needed here; the displayed page is then fetched with its full set of values.
  const orderedIds = await getOrderedTransactionIds(orgId, filters, sortField, sortOrder)

  const total = orderedIds.length
  const pageIds = orderedIds.slice((page - 1) * pageSize, page * pageSize)
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
