"use client"

import { useEffect, useRef } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import "./leaflet-plugins"
import { getThemeColors } from "@/lib/theme-colors"

type DrawControlProps = {
  polygon: { lat: number; lng: number }[] | null
  onPolygonChange: (polygon: { lat: number; lng: number }[] | null) => void
}

export function DrawControl({ polygon, onPolygonChange }: DrawControlProps) {
  const map = useMap()
  const drawnItemsRef = useRef<L.FeatureGroup | null>(null)

  useEffect(() => {
    const colors = getThemeColors()
    const drawnItems = new L.FeatureGroup()
    drawnItemsRef.current = drawnItems
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
            color: colors.destructive,
            timeout: 1000,
          },
          shapeOptions: {
            color: colors.primary,
            fillColor: colors.primary,
            // Zone sélectionnée bien visible au-dessus des tuiles de la carte.
            fillOpacity: 0.6,
            weight: 4,
          },
        },
      },
      edit: {
        featureGroup: drawnItems,
        // Bouton « Modifier les couches » masqué : seule la suppression reste disponible.
        edit: false,
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
      onPolygonChange(flat.map((ll) => ({ lat: ll.lat, lng: ll.lng })))
    }

    const handleDeleted = () => {
      onPolygonChange(null)
    }

    map.on("draw:created", handleCreated)
    map.on("draw:deleted", handleDeleted)

    return () => {
      map.off("draw:created", handleCreated)
      map.off("draw:deleted", handleDeleted)
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
      drawnItemsRef.current = null
    }
  }, [map, onPolygonChange])

  // Quand l'état part à null (effacement depuis le panneau), la zone dessinée disparaît aussi de la carte.
  useEffect(() => {
    if (!polygon) drawnItemsRef.current?.clearLayers()
  }, [polygon])

  return null
}
