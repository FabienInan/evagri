import type { SerializedTransaction } from "@/serializers/transaction.serializer"

/** Un pin à dessiner sur la carte statique exportée : uniquement le numéro de vente y est affiché (§7.10). */
export type MapExportPoint = {
  id: string
  lat: number
  lng: number
  numero: string
}

/** Coordonnées finies : ni null, ni NaN, ni ±Infinity (0 reste une coordonnée valide). */
function isFiniteCoord(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/** Ne retient que les transactions géolocalisées, avec le libellé du pin (numéro de vente, vide si absent). */
export function buildMapPoints(
  transactions: Pick<SerializedTransaction, "id" | "latitude" | "longitude" | "fields">[]
): MapExportPoint[] {
  const points: MapExportPoint[] = []
  for (const t of transactions) {
    if (!isFiniteCoord(t.latitude) || !isFiniteCoord(t.longitude)) continue
    const numero = t.fields.numero_inscription
    points.push({
      id: t.id,
      lat: t.latitude,
      lng: t.longitude,
      numero: typeof numero === "string" ? numero : "",
    })
  }
  return points
}

/** Rectangle englobant [[minLat, minLng], [maxLat, maxLng]] des points, ou null si la liste est vide. */
export function pointsToBounds(
  points: Pick<MapExportPoint, "lat" | "lng">[]
): [[number, number], [number, number]] | null {
  if (points.length === 0) return null
  let minLat = points[0].lat
  let minLng = points[0].lng
  let maxLat = points[0].lat
  let maxLng = points[0].lng
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }
  return [
    [minLat, minLng],
    [maxLat, maxLng],
  ]
}
