"use client"

import { useEffect } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import "./leaflet-plugins"
import type { MapTransaction } from "./types"
import { getThemeColors } from "@/lib/theme-colors"

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
  onMarkerClick?: (id: string) => void
}

interface MarkerOptionsWithSelection extends L.MarkerOptions {
  selected?: boolean
}

function createClusterIcon(colors: ReturnType<typeof getThemeColors>) {
  return function iconCreateFunction(cluster: L.MarkerCluster): L.DivIcon {
    const count = cluster.getChildCount()
    const size = count < 10 ? 28 : count < 100 ? 36 : 44
    const hasSelected = cluster
      .getAllChildMarkers()
      .some((marker) => (marker.options as MarkerOptionsWithSelection).selected)
    const background = hasSelected ? colors.accent : colors.primary
    return L.divIcon({
      html: `<div style="
        width:${size}px;
        height:${size}px;
        background:${background};
        color:${colors.primaryForeground};
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:${count < 100 ? 12 : 10}px;
        font-weight:600;
        border:2px solid ${colors.primaryForeground};
        box-shadow:0 2px 6px ${colors.shadow};
      ">${count}</div>`,
      className: "marker-cluster-custom",
      iconSize: L.point(size, size),
      iconAnchor: L.point(size / 2, size / 2),
    })
  }
}

export function ClusterLayer({ transactions, selectedIds, onMarkerClick }: ClusterLayerProps) {
  const map = useMap()

  useEffect(() => {
    const group = L.markerClusterGroup({
      iconCreateFunction: createClusterIcon(getThemeColors()),
    })
    transactions.forEach((t) => {
      const isSelected = selectedIds.has(t.id)
      const marker = L.marker([t.latitude, t.longitude], {
        icon: isSelected ? selectedPinIcon : pinIcon,
        selected: isSelected,
      } as MarkerOptionsWithSelection)
      marker.bindPopup(
        `<div>
          <strong>${t.numeroInscription ?? "—"}</strong>
          <p>${t.municipalite || ""}</p>
          <p>Date: ${t.dateVente ? new Date(t.dateVente).toLocaleDateString("fr-CA") : "—"}</p>
          <p>Prix: ${t.prixVente ? t.prixVente.toLocaleString("fr-CA") : "-"} $</p>
          <p>Superficie: ${t.superficieTotaleHectare ?? "-"} ha</p>
        </div>`
      )
      if (onMarkerClick) {
        marker.on("click", () => onMarkerClick(t.id))
      }
      group.addLayer(marker)
    })
    map.addLayer(group)
    return () => {
      map.removeLayer(group)
    }
  }, [map, transactions, selectedIds, onMarkerClick])

  return null
}
