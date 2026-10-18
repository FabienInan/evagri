import { parsePolygon, pointInPolygon } from "@/lib/geo"
import type { FilterInput } from "@/types/filter"

export function findGeoFilter(filters: FilterInput[]): FilterInput | undefined {
  return filters.find((f) => f.typeFiltre === "ZONE_GEO")
}

export function filterByPolygon<T extends { latitude: number | null; longitude: number | null }>(
  items: T[],
  polygonValue: string
): T[] {
  const polygon = parsePolygon(polygonValue)
  if (!polygon || polygon.length < 3) return items
  return items.filter((item) => {
    const lat = item.latitude === null || item.latitude === undefined ? null : Number(item.latitude)
    const lng = item.longitude === null || item.longitude === undefined ? null : Number(item.longitude)
    if (lat === null || lng === null || isNaN(lat) || isNaN(lng)) return false
    return pointInPolygon({ lat, lng }, polygon)
  })
}
