"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { PanelLeftClose, PanelLeft, ShoppingCart } from "lucide-react"
import { Button } from "@/components/ui/button"
import { searchTransactions } from "@/server/actions/transaction"
import { TransactionTable } from "@/components/transaction-table"
import { TransactionFilters } from "@/components/transaction-filters"
import { TransactionViewToggle } from "@/components/transaction-view-toggle"
import { useTransactionFilters } from "@/hooks/use-transaction-filters"
import type { FilterConfig, FilterInput } from "@/types/filter"
import type { TransactionSourceField } from "@/lib/transaction-source-fields"
import type { EnrichmentField } from "@/repositories/enrichment.repository"

type TableData = Awaited<ReturnType<typeof searchTransactions>>
type TransactionRow = TableData["transactions"][number]

const PAGE_SIZE = 25

interface TransactionsPageClientProps {
  initialData: TableData
  filtersConfig: FilterConfig[]
  sourceFields: TransactionSourceField[]
  enrichmentFields: EnrichmentField[]
}

export function TransactionsPageClient({
  initialData,
  filtersConfig,
  sourceFields,
  enrichmentFields,
}: TransactionsPageClientProps) {
  const { filters, setFilters } = useTransactionFilters()

  const [transactions, setTransactions] = useState<TransactionRow[]>(initialData.transactions)
  const [total, setTotal] = useState(initialData.total)
  const [sortField, setSortField] = useState("dateVente")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialData.transactions.length < initialData.total)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadPage = useCallback(
    async (pageNum: number, activeFilters: FilterInput[], reset = false) => {
      setLoading(true)
      const res = await searchTransactions({
        page: pageNum,
        pageSize: PAGE_SIZE,
        filters: activeFilters,
        sortField,
        sortOrder,
      })
      setTotal(res.total)
      if (reset) {
        setTransactions(res.transactions)
        setPage(1)
      } else {
        setTransactions((prev) => [...prev, ...res.transactions])
        setPage(pageNum)
      }
      setHasMore(res.transactions.length === PAGE_SIZE && (pageNum * PAGE_SIZE) < res.total)
      setLoading(false)
      return res
    },
    [sortField, sortOrder]
  )

  useEffect(() => {
    if (filters.length) {
      loadPage(1, filters, true)
    }
  }, [filters])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return

    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0]
        if (target.isIntersecting && hasMore && !loading) {
          loadPage(page + 1, filters)
        }
      },
      { rootMargin: "200px" }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [sentinelRef, hasMore, loading, page, loadPage, filters])

  async function handleSearch(newFilters: FilterInput[]) {
    setFilters(newFilters)
    await loadPage(1, newFilters, true)
  }

  async function handleSort(field: string) {
    const nextOrder = sortField === field && sortOrder === "asc" ? "desc" : "asc"
    setSortField(field)
    setSortOrder(nextOrder)
    const res = await searchTransactions({
      page: 1,
      pageSize: PAGE_SIZE,
      filters,
      sortField: field,
      sortOrder: nextOrder,
    })
    setTransactions(res.transactions)
    setTotal(res.total)
    setPage(1)
    setHasMore(res.transactions.length === PAGE_SIZE && res.transactions.length < res.total)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Liste des transactions</h2>
          <p className="text-sm text-muted-foreground">Consultez et filtrez les ventes agricoles</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" className="gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
            <ShoppingCart className="h-4 w-4" />
            Paniers
          </Button>
          <TransactionViewToggle />
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={() => setShowFilters((prev) => !prev)}
        >
          {showFilters ? (
            <>
              <PanelLeftClose className="h-4 w-4" />
              Cacher les filtres
            </>
          ) : (
            <>
              <PanelLeft className="h-4 w-4" />
              Afficher les filtres
            </>
          )}
        </Button>
      </div>

      <div
        className={`grid grid-cols-1 items-start gap-4 ${
          showFilters ? "lg:grid-cols-[300px_1fr] lg:gap-4" : ""
        }`}
      >
        {showFilters && (
          <div className="self-start">
            <TransactionFilters
              filtersConfig={filtersConfig}
              onSearch={handleSearch}
              initialFilters={filters}
            />
          </div>
        )}
        <TransactionTable
          data={{ transactions, total }}
          sourceFields={sourceFields}
          enrichmentFields={enrichmentFields}
          onSort={handleSort}
          sortField={sortField}
          sortOrder={sortOrder}
          hasMore={hasMore}
          loading={loading}
          sentinelRef={sentinelRef}
        />
      </div>
    </div>
  )
}
