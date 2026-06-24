"use client"

import { useState } from "react"
import { searchTransactions } from "@/server/actions/transaction"
import { TransactionTable } from "@/components/transaction-table"
import { TransactionFilters } from "@/components/transaction-filters"

type TableData = Awaited<ReturnType<typeof searchTransactions>>

export function TransactionsPageClient({
  initialData,
  filtersConfig,
}: {
  initialData: TableData
  filtersConfig: any[]
}) {
  const [data, setData] = useState<TableData>(initialData)
  const [filters, setFilters] = useState<any[]>([])
  const [sortField, setSortField] = useState("dateVente")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  async function loadPage(page: number, activeFilters = filters) {
    const res = await searchTransactions({
      page,
      filters: activeFilters,
      sortField,
      sortOrder,
    })
    setData(res)
  }

  async function handleSearch(newFilters: any[]) {
    setFilters(newFilters)
    await loadPage(1, newFilters)
  }

  async function handleSort(field: string) {
    const nextOrder = sortField === field && sortOrder === "asc" ? "desc" : "asc"
    setSortField(field)
    setSortOrder(nextOrder)
    const res = await searchTransactions({
      page: 1,
      filters,
      sortField: field,
      sortOrder: nextOrder,
    })
    setData(res)
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Liste des transactions</h1>
      <TransactionFilters filtersConfig={filtersConfig} onSearch={handleSearch} />
      <TransactionTable
        data={data}
        onPageChange={loadPage}
        onSort={handleSort}
        sortField={sortField}
        sortOrder={sortOrder}
      />
    </main>
  )
}
