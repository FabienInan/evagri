"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { searchTransactions } from "@/server/actions/transaction"
import { TransactionTable } from "@/components/transaction-table"
import { TransactionFilters } from "@/components/transaction-filters"
import { useTransactionFilters } from "@/hooks/use-transaction-filters"
import { useSelectedTransactions } from "@/components/selected-transactions-context"
import { useFilterPanelVisibility } from "@/hooks/use-filter-panel-visibility"
import { buildTransactionDetailQuery } from "@/lib/transaction-filters"
import type { FilterConfig, FilterInput } from "@/types/filter"
import type { ImportedField } from "@/lib/imported-fields"
import type { ChampEnrichissableConfig } from "@/types/champ"

type TableData = Awaited<ReturnType<typeof searchTransactions>>
type TransactionRow = TableData["transactions"][number]

const PAGE_SIZE = 25

interface TransactionsPageClientProps {
  initialData: TableData
  filtersConfig: FilterConfig[]
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
}

export function TransactionsPageClient({
  initialData,
  filtersConfig,
  importedFields,
  champs,
}: TransactionsPageClientProps) {
  // Précharge le code de la carte pendant que la liste s'affiche : le premier passage à la carte n'attend plus
  // son téléchargement. Le même module sert au chargement dynamique de la page carte : rien n'est téléchargé deux fois.
  useEffect(() => {
    const precharger = () => {
      void import("@/components/transaction-map")
    }
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(precharger)
      return () => window.cancelIdleCallback(id)
    }
    const id = window.setTimeout(precharger, 1000)
    return () => window.clearTimeout(id)
  }, [])

  const { filters, setFilters } = useTransactionFilters()
  const { selectedIds, toggleSelected } = useSelectedTransactions()

  const [transactions, setTransactions] = useState<TransactionRow[]>(initialData.transactions)
  const [total, setTotal] = useState(initialData.total)
  const [sortField, setSortField] = useState("date_vente")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialData.transactions.length < initialData.total)
  const [loading, setLoading] = useState(false)
  const { visible: showFilters } = useFilterPanelVisibility()
  const sentinelRef = useRef<HTMLDivElement>(null)

  // Resync with fresh server data (router.refresh) only while unfiltered: initialData is always the
  // unfiltered first page, so applying it under an active filter would silently drop that filter.
  // Ajustement pendant le rendu (et non dans un effet) : pas d'affichage intermédiaire périmé.
  const [syncedFrom, setSyncedFrom] = useState({ initialData, filters })
  if (syncedFrom.initialData !== initialData || syncedFrom.filters !== filters) {
    setSyncedFrom({ initialData, filters })
    if (!filters.length) {
      setTransactions(initialData.transactions)
      setTotal(initialData.total)
      setPage(1)
      setHasMore(initialData.transactions.length < initialData.total)
    }
  }

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

  // Volontaire : on ne recharge que lorsque les filtres changent (ex. filtre posé depuis la carte, par l'URL).
  // Dépendre de loadPage relancerait la requête à chaque changement de tri, alors que handleSort recharge déjà la
  // première page. Le chargement de données à la suite d'un changement externe justifie l'effet ici.
  useEffect(() => {
    if (filters.length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement déclenché par un changement de filtre
      loadPage(1, filters, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- voir le commentaire ci-dessus
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
    setHasMore(res.transactions.length === PAGE_SIZE && PAGE_SIZE < res.total)
  }

  // Contexte transmis aux fiches : la navigation précédent/suivant doit rester dans la liste filtrée.
  const detailQuery = buildTransactionDetailQuery({ filters, sortField, sortOrder })

  return (
    <div
      className={`grid grid-cols-1 gap-4 lg:min-h-0 lg:flex-1 ${
        showFilters ? "lg:grid-cols-[300px_minmax(0,1fr)]" : ""
      }`}
    >
      {showFilters && (
        <div className="lg:min-h-0 lg:overflow-hidden">
          <TransactionFilters
            filtersConfig={filtersConfig}
            onSearch={handleSearch}
            initialFilters={filters}
            scrollable
          />
        </div>
      )}
      <TransactionTable
        data={{ transactions, total }}
        importedFields={importedFields}
        champs={champs}
        onSort={handleSort}
        sortField={sortField}
        sortOrder={sortOrder}
        detailQuery={detailQuery}
        hasMore={hasMore}
        loading={loading}
        sentinelRef={sentinelRef}
        selectedIds={selectedIds}
        onSelectRow={(row) => toggleSelected(row.id)}
        fillHeight
      />
    </div>
  )
}
