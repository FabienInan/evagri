export type GeoPoint = { lat: number; lng: number }
export type GeoPolygon = GeoPoint[]

export function pointInPolygon(point: GeoPoint, polygon: GeoPolygon): boolean {
  if (polygon.length < 3) return false
  let inside = false
  const { lat: x, lng: y } = point
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat
    const yi = polygon[i].lng
    const xj = polygon[j].lat
    const yj = polygon[j].lng
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export function polygonBounds(polygon: GeoPolygon): {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
} | null {
  if (polygon.length === 0) return null
  let minLat = polygon[0].lat
  let maxLat = polygon[0].lat
  let minLng = polygon[0].lng
  let maxLng = polygon[0].lng
  for (const p of polygon) {
    if (p.lat < minLat) minLat = p.lat
    if (p.lat > maxLat) maxLat = p.lat
    if (p.lng < minLng) minLng = p.lng
    if (p.lng > maxLng) maxLng = p.lng
  }
  return { minLat, maxLat, minLng, maxLng }
}

export function parsePolygon(value: string): GeoPolygon | null {
  try {
    const parsed = JSON.parse(value)
    if (
      Array.isArray(parsed) &&
      parsed.every(
        (p) =>
          typeof p === "object" &&
          p !== null &&
          typeof p.lat === "number" &&
          typeof p.lng === "number"
      )
    ) {
      return parsed
    }
  } catch {
    // ignore
  }
  return null
}
