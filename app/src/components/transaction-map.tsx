"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer } from "react-leaflet"
import { DrawControl } from "@/components/transaction-map/draw-control"
import { ClusterLayer } from "@/components/transaction-map/cluster-layer"
import { TransactionMapSelectedPanel } from "@/components/transaction-map/selected-panel"
import type { FilterInput } from "@/types/filter"
import { pointInPolygon } from "@/lib/geo"
import type { MapTransaction } from "@/components/transaction-map/types"
import { useSelectedTransactions } from "@/components/selected-transactions-context"
import "@/components/transaction-map/leaflet-plugins"

interface TransactionMapProps {
  filters?: FilterInput[]
  onGeoFilter?: (filter: FilterInput) => void
}

// Module-level cache: makes list->map view switches instant after the first load.
const mapDataCache = new Map<string, MapTransaction[]>()

export function TransactionMap({ filters, onGeoFilter }: TransactionMapProps) {
  const filtersCacheKey = JSON.stringify(filters ?? [])
  const [transactions, setTransactions] = useState<MapTransaction[]>(
    () => mapDataCache.get(filtersCacheKey) ?? []
  )
  const [polygon, setPolygon] = useState<{ lat: number; lng: number }[] | null>(null)
  const { selectedIds: pickedIds, toggleSelected } = useSelectedTransactions()

  useEffect(() => {
    const cached = mapDataCache.get(filtersCacheKey)
    if (cached) {
      setTransactions(cached)
      return
    }
    let cancelled = false
    const query = filters?.length
      ? `?filters=${encodeURIComponent(JSON.stringify(filters))}`
      : ""
    fetch(`/api/transactions/map${query}`)
      .then((res) => res.json())
      .then((data) => {
        mapDataCache.set(filtersCacheKey, data)
        if (!cancelled) setTransactions(data)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersCacheKey])

  const polygonIds = useMemo(() => {
    if (!polygon || polygon.length < 3) return new Set<string>()
    const ids = new Set<string>()
    for (const t of transactions) {
      if (pointInPolygon({ lat: t.latitude, lng: t.longitude }, polygon)) {
        ids.add(t.id)
      }
    }
    return ids
  }, [transactions, polygon])

  const selectedIds = useMemo(
    () => new Set([...polygonIds, ...pickedIds]),
    [polygonIds, pickedIds]
  )

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
        center={[52.0, -72.0]}
        zoom={6}
        scrollWheelZoom={true}
        className="h-full w-full"
      >
        <TileLayer
          attribution='© OpenStreetMap contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClusterLayer
          transactions={transactions}
          selectedIds={selectedIds}
          onMarkerClick={toggleSelected}
        />
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
