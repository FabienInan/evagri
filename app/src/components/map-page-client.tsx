"use client"

import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import dynamic from "next/dynamic"
import { PanelLeftClose, PanelLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TransactionFilters } from "@/components/transaction-filters"
import { TransactionViewToggle } from "@/components/transaction-view-toggle"

const TransactionMap = dynamic(
  () => import("@/components/transaction-map").then((m) => m.TransactionMap),
  { ssr: false }
)

const FILTERS_PARAM = "filters"

function parseFiltersParam(raw: string | null): any[] {
  if (!raw) return []
  try {
    return JSON.parse(decodeURIComponent(raw))
  } catch {
    return []
  }
}

function stringifyFilters(filters: any[]): string {
  return encodeURIComponent(JSON.stringify(filters))
}

export function MapPageClient({
  filtersConfig,
}: {
  filtersConfig: any[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const initialFilters = parseFiltersParam(searchParams.get(FILTERS_PARAM))

  const [filters, setFilters] = useState<any[]>(initialFilters)
  const [showFilters, setShowFilters] = useState(true)

  function updateUrl(filters: any[]) {
    const params = new URLSearchParams(searchParams.toString())
    if (filters.length) {
      params.set(FILTERS_PARAM, stringifyFilters(filters))
    } else {
      params.delete(FILTERS_PARAM)
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  function handleSearch(newFilters: any[]) {
    setFilters(newFilters)
    updateUrl(newFilters)
  }

  function handleGeoFilter(geoFilter: any) {
    const withoutGeo = filters.filter((f) => f.id !== "zone-geo")
    const next = [...withoutGeo, geoFilter]
    setFilters(next)
    updateUrl(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Carte des transactions</h2>
          <p className="text-sm text-muted-foreground">Visualisation géographique des ventes agricoles</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
            <TransactionFilters filtersConfig={filtersConfig} onSearch={handleSearch} initialFilters={initialFilters} />
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
