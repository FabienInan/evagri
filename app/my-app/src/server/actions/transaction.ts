"use server"

import { prisma } from "@/lib/prisma"
import { buildWhereClause, FilterInput } from "@/lib/filters"
import Decimal from "decimal.js"

export async function searchTransactions(input: {
  page?: number
  pageSize?: number
  filters?: FilterInput[]
  sortField?: string
  sortOrder?: "asc" | "desc"
}) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 10
  const orgId = process.env.DEFAULT_ORGANISATION_ID || ""

  const filterWhere = buildWhereClause(input.filters || [])
  const where = {
    organisationId: orgId,
    ...filterWhere,
  }

  const orderBy: any = input.sortField
    ? { [input.sortField]: input.sortOrder ?? "asc" }
    : { dateVente: "desc" }

  const [transactions, total] = await Promise.all([
    prisma.transactionSource.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      include: { enrichie: true },
    }),
    prisma.transactionSource.count({ where }),
  ])

  return {
    transactions: transactions.map((t) => ({
      ...t,
      dateVente: t.dateVente.toISOString(),
      prixVente: t.prixVente ? new Decimal(t.prixVente.toString()).toNumber() : null,
      superficieTotaleHectare: t.superficieTotaleHectare ? new Decimal(t.superficieTotaleHectare.toString()).toNumber() : null,
      latitude: t.latitude ? new Decimal(t.latitude.toString()).toNumber() : null,
      longitude: t.longitude ? new Decimal(t.longitude.toString()).toNumber() : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
