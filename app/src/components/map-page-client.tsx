"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { PanelLeftClose, PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TransactionFilters } from "@/components/transaction-filters"
import { useTransactionFilters } from "@/hooks/use-transaction-filters"
import { useFilterPanelVisibility } from "@/hooks/use-filter-panel-visibility"
import type { FilterConfig, FilterInput } from "@/types/filter"

const TransactionMap = dynamic(
  () => import("@/components/transaction-map").then((m) => m.TransactionMap),
  { ssr: false }
)

interface MapPageClientProps {
  filtersConfig: FilterConfig[]
}

export function MapPageClient({ filtersConfig }: MapPageClientProps) {
  const { filters, addOrReplaceFilter } = useTransactionFilters()
  const { visible: showFilters, toggle: toggleFilters } = useFilterPanelVisibility()

  function handleSearch(newFilters: FilterInput[]) {
    // Map page only supports geo + simple filters through URL; no server reload needed.
    // TransactionFilters updates its own local state and calls onSearch.
    // We intentionally do not call setFilters here because TransactionFilters owns local state.
  }

  function handleGeoFilter(geoFilter: FilterInput) {
    addOrReplaceFilter(geoFilter)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Carte des transactions</h2>
          <p className="text-sm text-muted-foreground">Visualisation géographique des ventes agricoles</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          size="sm"
          className="w-fit gap-2"
          onClick={toggleFilters}
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
        <Card className="h-[calc(100vh-8rem)] overflow-hidden">
          <CardContent className="p-0 h-full w-full">
            <TransactionMap filters={filters} onGeoFilter={handleGeoFilter} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
