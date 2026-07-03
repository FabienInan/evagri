"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer } from "react-leaflet"
import { DrawControl } from "@/components/transaction-map/draw-control"
import { ClusterLayer } from "@/components/transaction-map/cluster-layer"
import { TransactionMapSelectedPanel } from "@/components/transaction-map/selected-panel"
import type { FilterInput } from "@/types/filter"
import { pointInPolygon } from "@/lib/geo"
import type { MapTransaction } from "@/components/transaction-map/types"
import "@/components/transaction-map/leaflet-plugins"

interface TransactionMapProps {
  filters?: FilterInput[]
  onGeoFilter?: (filter: FilterInput) => void
}

export function TransactionMap({ filters, onGeoFilter }: TransactionMapProps) {
  const [transactions, setTransactions] = useState<MapTransaction[]>([])
  const [polygon, setPolygon] = useState<{ lat: number; lng: number }[] | null>(null)
  const [filtersKey, setFiltersKey] = useState(0)

  useEffect(() => {
    const query = filters?.length
      ? `?filters=${encodeURIComponent(JSON.stringify(filters))}`
      : ""
    fetch(`/api/transactions/map${query}`)
      .then((res) => res.json())
      .then((data) => {
        setTransactions(data)
        setFiltersKey((k) => k + 1)
      })
  }, [filters])

  const selectedIds = useMemo(() => {
    if (!polygon || polygon.length < 3) return new Set<string>()
    const ids = new Set<string>()
    for (const t of transactions) {
      if (pointInPolygon({ lat: t.latitude, lng: t.longitude }, polygon)) {
        ids.add(t.id)
      }
    }
    return ids
  }, [transactions, polygon])

  function handleFilter() {
    if (!polygon || polygon.length < 3) return
    onGeoFilter?.({
      id: "zone-geo",
      typeFiltre: "ZONE_GEO",
      field: "polygon",
      operator: "in",
      value: JSON.stringify(polygon),
    })
  }

  return (
    <div className="relative h-full w-full">
      <MapContainer
        key={filtersKey}
        center={[52.0, -72.0]}
        zoom={6}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='© OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusterLayer transactions={transactions} selectedIds={selectedIds} />
        <DrawControl onPolygonChange={setPolygon} />
      </MapContainer>

      {polygon && (
        <TransactionMapSelectedPanel
          selectedCount={selectedIds.size}
          onClear={() => setPolygon(null)}
          onFilter={handleFilter}
        />
      )}
    </div>
  )
}
