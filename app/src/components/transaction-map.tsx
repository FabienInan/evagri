"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import { Trash2, MapPin, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { FilterInput } from "@/lib/filters"
import { pointInPolygon } from "@/lib/geo"
import "leaflet/dist/leaflet.css"
import "leaflet-draw/dist/leaflet.draw.css"

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("leaflet.markercluster")
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("leaflet-draw")

type MapTransaction = {
  id: string
  numeroInscription: string | null
  dateVente: string | null
  prixVente: number | null
  superficieTotaleHectare: number | null
  latitude: number
  longitude: number
  municipalite: string | null
}

const pinIcon = new L.Icon({
  iconUrl: "/pin.svg",
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

const selectedPinIcon = new L.Icon({
  iconUrl: "/pin-selected.svg",
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

function DrawControl({
  onPolygonChange,
}: {
  onPolygonChange: (polygon: { lat: number; lng: number }[] | null) => void
}) {
  const map = useMap()

  useEffect(() => {
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
      draw: {
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
        polygon: {
          allowIntersection: false,
          showArea: false,
          drawError: {
            color: "#dc2626",
            timeout: 1000,
          },
          shapeOptions: {
            color: "#6b8e4e",
            fillColor: "#6b8e4e",
            fillOpacity: 0.2,
            weight: 2,
          },
        },
      },
      edit: {
        featureGroup: drawnItems,
        remove: true,
      },
    })
    map.addControl(drawControl)

    const handleCreated = (event: L.LeafletEvent) => {
      const e = event as L.DrawEvents.Created
      const layer = e.layer as L.Polygon
      drawnItems.addLayer(layer)
      const latlngs = layer.getLatLngs()
      const flat = Array.isArray(latlngs[0]) ? (latlngs[0] as L.LatLng[]) : (latlngs as L.LatLng[])
      onPolygonChange(
        flat.map((ll) => ({ lat: ll.lat, lng: ll.lng }))
      )
    }

    const handleDeleted = () => {
      onPolygonChange(null)
    }

    const handleEdited = (event: L.LeafletEvent) => {
      const e = event as L.DrawEvents.Edited
      const layers = e.layers
      layers.eachLayer((layer) => {
        if (layer instanceof L.Polygon) {
          const latlngs = layer.getLatLngs()
          const flat = Array.isArray(latlngs[0])
            ? (latlngs[0] as L.LatLng[])
            : (latlngs as L.LatLng[])
          onPolygonChange(flat.map((ll) => ({ lat: ll.lat, lng: ll.lng })))
        }
      })
    }

    map.on("draw:created", handleCreated)
    map.on("draw:deleted", handleDeleted)
    map.on("draw:edited", handleEdited)

    return () => {
      map.off("draw:created", handleCreated)
      map.off("draw:deleted", handleDeleted)
      map.off("draw:edited", handleEdited)
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
    }
  }, [map, onPolygonChange])

  return null
}

function ClusterLayer({
  transactions,
  selectedIds,
}: {
  transactions: MapTransaction[]
  selectedIds: Set<string>
}) {
  const map = useMap()

  useEffect(() => {
    const group = L.markerClusterGroup()
    transactions.forEach((t) => {
      const isSelected = selectedIds.has(t.id)
      const marker = L.marker([t.latitude, t.longitude], {
        icon: isSelected ? selectedPinIcon : pinIcon,
      })
      marker.bindPopup(
        `<div>
          <strong>${t.numeroInscription ?? "—"}</strong>
          <p>${t.municipalite || ""}</p>
          <p>Date: ${t.dateVente ? new Date(t.dateVente).toLocaleDateString("fr-CA") : "—"}</p>
          <p>Prix: ${t.prixVente ? t.prixVente.toLocaleString("fr-CA") : "-"} $</p>
          <p>Superficie: ${t.superficieTotaleHectare ?? "-"} ha</p>
        </div>`
      )
      group.addLayer(marker)
    })
    map.addLayer(group)
    return () => {
      map.removeLayer(group)
    }
  }, [map, transactions, selectedIds])

  return null
}

export function TransactionMap({
  filters,
  onGeoFilter,
}: {
  filters?: FilterInput[]
  onGeoFilter?: (filter: FilterInput) => void
}) {
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
        <Card className="absolute bottom-4 left-4 z-[9999] w-80 border-border shadow-lg">
          <CardContent className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span className="text-foreground">
                  <strong>{selectedIds.size}</strong>{" "}
                  transaction{selectedIds.size > 1 ? "s" : ""} sélectionnée
                  {selectedIds.size > 1 ? "s" : ""}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => setPolygon(null)}
                title="Effacer la sélection"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <Button
              size="sm"
              className="w-full gap-2"
              onClick={() => {
                if (!polygon || polygon.length < 3) return
                onGeoFilter?.({
                  id: "zone-geo",
                  typeFiltre: "ZONE_GEO",
                  field: "polygon",
                  operator: "in",
                  value: JSON.stringify(polygon),
                })
              }}
            >
              <Filter className="h-4 w-4" />
              Filtrer dans la liste
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
