"use client"

import { useCallback, useMemo, useRef, useState } from "react"
import { MapContainer, Marker, TileLayer } from "react-leaflet"
import L from "leaflet"
import { toPng } from "html-to-image"
import { Download, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { buildMapPoints, pointsToBounds } from "@/lib/map-export"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"
import "@/components/transaction-map/leaflet-plugins"

// Dimensions fixes de l'image exportée (rapport 3:2), indépendantes de la fenêtre du navigateur.
const EXPORT_IMAGE_WIDTH = 1200
const EXPORT_IMAGE_HEIGHT = 800
// On laisse aux tuiles le temps d'arriver, sans bloquer l'export si le réseau traîne ou est absent
// (dans ce cas l'image ne contient que les pins, ce qui reste valide).
const TILE_LOAD_TIMEOUT_MS = 2500

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;"
      case "<":
        return "&lt;"
      case ">":
        return "&gt;"
      case '"':
        return "&quot;"
      default:
        return "&#39;"
    }
  })
}

/** Pastille arrondie portant le numéro de vente, centrée sur la coordonnée (ancre 0,0 + translate CSS). */
function createPinIcon(numero: string): L.DivIcon {
  return L.divIcon({
    className: "panier-export-pin",
    html: `<div class="panier-export-pin-inner">${escapeHtml(numero || "—")}</div>`,
    iconSize: [0, 0],
  })
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * Bouton « Exporter la carte » de la vue Panier (§7.10) : rend une carte Leaflet hors écran avec un pin
 * par transaction géolocalisée (numéro de vente seul), la capture en PNG et déclenche le téléchargement.
 */
export function PanierMapExport({
  transactions,
  nom,
}: {
  transactions: SerializedTransaction[]
  nom: string
}) {
  const points = useMemo(() => buildMapPoints(transactions), [transactions])
  const bounds = useMemo(() => pointsToBounds(points), [points])
  const containerRef = useRef<HTMLDivElement>(null)
  const tilesReadyRef = useRef(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const waitForTiles = useCallback(async () => {
    if (tilesReadyRef.current) return
    const start = Date.now()
    while (!tilesReadyRef.current && Date.now() - start < TILE_LOAD_TIMEOUT_MS) {
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
  }, [])

  async function handleExport() {
    const node = containerRef.current
    if (!node || points.length === 0) return
    setExporting(true)
    setError(null)
    try {
      await waitForTiles()
      const dataUrl = await toPng(node, {
        width: EXPORT_IMAGE_WIDTH,
        height: EXPORT_IMAGE_HEIGHT,
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        skipFonts: true,
      })
      const link = document.createElement("a")
      link.download = `carte-${slugify(nom) || "panier"}.png`
      link.href = dataUrl
      link.click()
    } catch {
      setError("Impossible de générer l'image de la carte.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-xs"
        onClick={handleExport}
        disabled={exporting || points.length === 0}
        title={points.length === 0 ? "Aucune transaction géolocalisée dans ce panier" : undefined}
      >
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Exporter la carte
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}

      {points.length > 0 && bounds && (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            top: 0,
            left: "-100000px",
            width: EXPORT_IMAGE_WIDTH,
            height: EXPORT_IMAGE_HEIGHT,
            pointerEvents: "none",
          }}
        >
          {/* Le nœud capturé porte un positionnement neutre : html-to-image clone ses styles, donc un
              `left: -100000px` sur ce nœud décalerait le rendu hors du canvas et donnerait une image vide. */}
          <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
            <MapContainer
              bounds={bounds}
              boundsOptions={{ padding: [50, 50], maxZoom: 12 }}
              zoomControl={false}
              dragging={false}
              scrollWheelZoom={false}
              doubleClickZoom={false}
              boxZoom={false}
              keyboard={false}
              touchZoom={false}
              style={{ width: "100%", height: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
                crossOrigin="anonymous"
                eventHandlers={{
                  load: () => {
                    tilesReadyRef.current = true
                  },
                }}
              />
              {points.map((p) => (
                <Marker key={p.id} position={[p.lat, p.lng]} icon={createPinIcon(p.numero)} />
              ))}
            </MapContainer>
          </div>
        </div>
      )}
    </>
  )
}
