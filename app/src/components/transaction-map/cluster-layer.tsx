"use client"

import { useEffect } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import "./leaflet-plugins"
import type { MapTransaction } from "./types"

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

type ClusterLayerProps = {
  transactions: MapTransaction[]
  selectedIds: Set<string>
}

export function ClusterLayer({ transactions, selectedIds }: ClusterLayerProps) {
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
