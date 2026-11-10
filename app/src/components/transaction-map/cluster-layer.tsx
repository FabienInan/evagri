"use client"

import { useEffect, useRef } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import "./leaflet-plugins"
import type { MapTransaction } from "./types"
import { getThemeColors } from "@/lib/theme-colors"
import { tauxClasseFor, type TauxClasse } from "@/lib/taux-classes"

const pinIcon = new L.Icon({
  iconUrl: "/pin.svg",
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  // Above the pin so the popup never sits under the cursor (would flicker mouseout/mouseover).
  popupAnchor: [0, -38],
})

const selectedPinIcon = new L.Icon({
  iconUrl: "/pin-selected.svg",
  iconSize: [24, 36],
  iconAnchor: [12, 36],
  popupAnchor: [0, -38],
})

/** Pin de même forme que pin.svg, rempli de la couleur de sa classe de taux global. */
const tauxPinCache = new Map<string, L.DivIcon>()
export function tauxPinIcon(color: string): L.DivIcon {
  let icon = tauxPinCache.get(color)
  if (!icon) {
    icon = L.divIcon({
      className: "taux-pin",
      html: `<svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path fill="${color}" stroke="#ffffff" stroke-width="1" d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z"/><circle cx="12" cy="12" r="5" fill="#fff"/></svg>`,
      iconSize: [24, 36],
      iconAnchor: [12, 36],
      popupAnchor: [0, -38],
    })
    tauxPinCache.set(color, icon)
  }
  return icon
}

type ClusterLayerProps = {
  transactions: MapTransaction[]
  selectedIds: Set<string>
  onMarkerClick?: (id: string) => void
  /** Classes de taux global (quantiles) ; sans elles, tous les pins gardent la couleur par défaut. */
  tauxClasses?: TauxClasse[]
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

function detailHtml(t: MapTransaction): string {
  return `<div>
    <strong>${t.numeroInscription ?? "—"}</strong>
    <p>${t.municipalite || ""}</p>
    <p>Date: ${t.dateVente ? new Date(t.dateVente).toLocaleDateString("fr-CA") : "—"}</p>
    <p>Prix: ${t.prixVente ? t.prixVente.toLocaleString("fr-CA") : "-"} $</p>
    <p>Superficie: ${t.superficieTotaleHectare ?? "-"} ha</p>
  </div>`
}

export function ClusterLayer({ transactions, selectedIds, onMarkerClick, tauxClasses = [] }: ClusterLayerProps) {
  const map = useMap()
  // One-shot per map mount: don't re-center on every subsequent pin toggle.
  const hasAutoFittedRef = useRef(false)

  useEffect(() => {
    const group = L.markerClusterGroup({
      iconCreateFunction: createClusterIcon(getThemeColors()),
      chunkedLoading: true,
    })
    transactions.forEach((t) => {
      const isSelected = selectedIds.has(t.id)
      const classe = tauxClasseFor(t.tauxGlobal, tauxClasses)
      const marker = L.marker([t.latitude, t.longitude], {
        icon: isSelected ? selectedPinIcon : classe ? tauxPinIcon(classe.color) : pinIcon,
        selected: isSelected,
      } as MarkerOptionsWithSelection)
      if (isSelected) {
        // Bulle permanente : Leaflet l'ouvre à chaque ajout du marqueur à la carte (événement « add »), donc
        // elle suit le pin à travers les clusters, à tout niveau de zoom, et disparaît avec lui.
        marker.bindTooltip(detailHtml(t), {
          permanent: true,
          direction: "top",
          offset: L.point(0, -36),
        })
      }
      if (onMarkerClick) {
        marker.on("click", () => onMarkerClick(t.id))
      }
      group.addLayer(marker)
    })
    map.addLayer(group)

    if (!hasAutoFittedRef.current && transactions.length > 0) {
      hasAutoFittedRef.current = true
      const selectedCoords = transactions
        .filter((t) => selectedIds.has(t.id))
        .map((t) => [t.latitude, t.longitude] as [number, number])
      if (selectedCoords.length > 0) {
        map.fitBounds(L.latLngBounds(selectedCoords), { padding: [60, 60], maxZoom: 12 })
      }
    }

    return () => {
      map.removeLayer(group)
    }
  }, [map, transactions, selectedIds, onMarkerClick, tauxClasses])

  return null
}
