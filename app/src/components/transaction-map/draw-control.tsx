"use client"

import { useEffect } from "react"
import { useMap } from "react-leaflet"
import L from "leaflet"
import "./leaflet-plugins"

type DrawControlProps = {
  onPolygonChange: (polygon: { lat: number; lng: number }[] | null) => void
}

export function DrawControl({ onPolygonChange }: DrawControlProps) {
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
      onPolygonChange(flat.map((ll) => ({ lat: ll.lat, lng: ll.lng })))
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
