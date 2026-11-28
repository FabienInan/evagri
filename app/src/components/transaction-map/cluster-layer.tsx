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
  /** Ajuste la vue sur les transactions sélectionnées au premier affichage ; faux quand une vue a déjà été choisie. */
  ajusterAuSelection?: boolean
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

/** Valeur par défaut stable : un tableau neuf à chaque rendu relancerait les effets. */
const AUCUNE_CLASSE: TauxClasse[] = []

/** Un marqueur et son état courant : seule la sélection et les classes de taux le modifient après sa construction. */
type Pin = {
  marker: L.Marker
  transaction: MapTransaction
  selected: boolean
  icon: L.Icon | L.DivIcon
}

function iconePour(selected: boolean, classe: TauxClasse | null): L.Icon | L.DivIcon {
  return selected ? selectedPinIcon : classe ? tauxPinIcon(classe.color) : pinIcon
}

/**
 * Met un pin à jour sans le reconstruire : icône, options lues par les clusters, et bulle permanente
 * (ajoutée à la sélection, retirée à la désélection). Leaflet ouvre la bulle d'un pin déjà affiché.
 */
function appliquerEtat(pin: Pin, selected: boolean, tauxClasses: TauxClasse[]) {
  const icon = iconePour(selected, tauxClasseFor(pin.transaction.tauxGlobal, tauxClasses))
  if (icon !== pin.icon) {
    pin.marker.setIcon(icon)
    pin.icon = icon
  }
  if (selected === pin.selected) return
  pin.selected = selected
  ;(pin.marker.options as MarkerOptionsWithSelection).selected = selected
  if (selected) {
    pin.marker.bindTooltip(detailHtml(pin.transaction), {
      permanent: true,
      direction: "top",
      offset: L.point(0, -36),
    })
  } else {
    pin.marker.unbindTooltip()
  }
}

export function ClusterLayer({
  transactions,
  selectedIds,
  onMarkerClick,
  tauxClasses = AUCUNE_CLASSE,
  ajusterAuSelection = true,
}: ClusterLayerProps) {
  const map = useMap()
  // One-shot per map mount: don't re-center on every subsequent pin toggle.
  const hasAutoFittedRef = useRef(false)
  const groupRef = useRef<L.MarkerClusterGroup | null>(null)
  const pinsRef = useRef<Pin[]>([])
  // Dernières valeurs, lues à la construction : la construction ne dépend pas de la sélection.
  const selectedIdsRef = useRef(selectedIds)
  const tauxClassesRef = useRef(tauxClasses)
  const onMarkerClickRef = useRef(onMarkerClick)

  useEffect(() => {
    selectedIdsRef.current = selectedIds
    tauxClassesRef.current = tauxClasses
    onMarkerClickRef.current = onMarkerClick
  }, [selectedIds, tauxClasses, onMarkerClick])

  // Construction : seulement quand les transactions changent (filtres, rechargement).
  useEffect(() => {
    const group = L.markerClusterGroup({
      iconCreateFunction: createClusterIcon(getThemeColors()),
      chunkedLoading: true,
    })
    const pins: Pin[] = transactions.map((t) => {
      const selected = selectedIdsRef.current.has(t.id)
      const icon = iconePour(selected, tauxClasseFor(t.tauxGlobal, tauxClassesRef.current))
      const marker = L.marker([t.latitude, t.longitude], {
        icon,
        selected,
      } as MarkerOptionsWithSelection)
      if (selected) {
        // Bulle permanente : Leaflet l'ouvre à chaque ajout du marqueur à la carte (événement « add »), donc
        // elle suit le pin à travers les clusters, à tout niveau de zoom, et disparaît avec lui.
        marker.bindTooltip(detailHtml(t), {
          permanent: true,
          direction: "top",
          offset: L.point(0, -36),
        })
      }
      marker.on("click", () => onMarkerClickRef.current?.(t.id))
      group.addLayer(marker)
      return { marker, transaction: t, selected, icon }
    })
    map.addLayer(group)
    groupRef.current = group
    pinsRef.current = pins

    if (ajusterAuSelection && !hasAutoFittedRef.current && transactions.length > 0) {
      hasAutoFittedRef.current = true
      const selectedCoords = transactions
        .filter((t) => selectedIdsRef.current.has(t.id))
        .map((t) => [t.latitude, t.longitude] as [number, number])
      if (selectedCoords.length > 0) {
        map.fitBounds(L.latLngBounds(selectedCoords), { padding: [60, 60], maxZoom: 12 })
      }
    }

    return () => {
      map.removeLayer(group)
      groupRef.current = null
      pinsRef.current = []
    }
  }, [map, transactions, ajusterAuSelection])

  // Sélection et classes de taux : mise à jour des pins existants, puis recalcul des couleurs de cluster.
  useEffect(() => {
    for (const pin of pinsRef.current) {
      appliquerEtat(pin, selectedIds.has(pin.transaction.id), tauxClasses)
    }
    groupRef.current?.refreshClusters()
  }, [selectedIds, tauxClasses])

  return null
}
