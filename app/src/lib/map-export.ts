import type { SerializedTransaction } from "@/serializers/transaction.serializer"

/** Un pin à dessiner sur la carte statique exportée : uniquement le numéro de vente y est affiché (§7.10). */
export type MapExportPoint = {
  id: string
  lat: number
  lng: number
  numero: string
  /** Taux global ($/ha) de la transaction, ou null : détermine la couleur de la pastille. */
  taux: number | null
}

/** Coordonnées finies : ni null, ni NaN, ni ±Infinity (0 reste une coordonnée valide). */
function isFiniteCoord(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value)
}

/**
 * Ne retient que les transactions géolocalisées, avec le libellé du pin.
 * Par défaut le libellé est le numéro de vente ; avec `numerotation: "ordre"`, c'est le rang dans la liste
 * fournie (1, 2, 3…), compté sur toutes les transactions, géolocalisées ou non.
 */
export function buildMapPoints(
  transactions: Pick<SerializedTransaction, "id" | "latitude" | "longitude" | "fields">[],
  options: { numerotation?: "numero_vente" | "ordre" } = {}
): MapExportPoint[] {
  const points: MapExportPoint[] = []
  for (const [index, t] of transactions.entries()) {
    if (!isFiniteCoord(t.latitude) || !isFiniteCoord(t.longitude)) continue
    const numeroVente = t.fields.numero_inscription
    const numero =
      options.numerotation === "ordre"
        ? String(index + 1)
        : typeof numeroVente === "string"
          ? numeroVente
          : ""
    const taux = t.fields.taux_global
    const tauxNombre = typeof taux === "number" ? taux : typeof taux === "string" && taux.trim() !== "" ? Number(taux) : NaN
    points.push({
      id: t.id,
      lat: t.latitude,
      lng: t.longitude,
      numero,
      taux: Number.isFinite(tauxNombre) ? tauxNombre : null,
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
