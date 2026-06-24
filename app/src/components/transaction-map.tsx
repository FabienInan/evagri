"use client"

import { useEffect, useState } from "react"
import { MapContainer, TileLayer, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("leaflet.markercluster")

type MapTransaction = {
  id: string
  numeroInscription: string
  dateVente: string
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

function ClusterLayer({ transactions }: { transactions: MapTransaction[] }) {
  const map = useMap()

  useEffect(() => {
    const group = L.markerClusterGroup()
    transactions.forEach((t) => {
      const marker = L.marker([t.latitude, t.longitude], { icon: pinIcon })
      marker.bindPopup(
        `<div>
          <strong>${t.numeroInscription}</strong>
          <p>${t.municipalite || ""}</p>
          <p>Date: ${new Date(t.dateVente).toLocaleDateString("fr-CA")}</p>
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
  }, [map, transactions])

  return null
}

export function TransactionMap() {
  const [transactions, setTransactions] = useState<MapTransaction[]>([])

  useEffect(() => {
    fetch("/api/transactions/map")
      .then((res) => res.json())
      .then(setTransactions)
  }, [])

  return (
    <MapContainer
      center={[52.0, -72.0]}
      zoom={6}
      scrollWheelZoom={true}
      style={{ height: "70vh", width: "100%" }}
    >
      <TileLayer
        attribution='© OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClusterLayer transactions={transactions} />
    </MapContainer>
  )
}
