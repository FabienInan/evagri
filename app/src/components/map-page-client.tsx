"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
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
  const { filters, setFilters, addOrReplaceFilter } = useTransactionFilters()
  const { visible: showFilters } = useFilterPanelVisibility()

  function handleSearch(newFilters: FilterInput[]) {
    setFilters(newFilters)
  }

  function handleGeoFilter(geoFilter: FilterInput) {
    addOrReplaceFilter(geoFilter)
  }

  return (
    <div className="space-y-4">
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
