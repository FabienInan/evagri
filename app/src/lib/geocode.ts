const LAST_CALL_MS = 1100
let lastCallAt = 0

const cache = new Map<string, { latitude: number; longitude: number } | null>()

export async function geocodeAddress(
  query: string
): Promise<{ latitude: number; longitude: number } | null> {
  if (!query || !query.trim()) return null

  const normalized = query.trim().toLowerCase()
  const cached = cache.get(normalized)
  if (cached !== undefined) return cached

  const now = Date.now()
  const wait = lastCallAt + LAST_CALL_MS - now
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait))
  }
  lastCallAt = Date.now()

  const url = new URL("https://nominatim.openstreetmap.org/search")
  url.searchParams.set("q", normalized)
  url.searchParams.set("format", "json")
  url.searchParams.set("limit", "1")
  url.searchParams.set("countrycodes", "ca")
  url.searchParams.set("accept-language", "fr-CA")

  try {
    const res = await fetch(url.toString(), {
      headers: {
        "User-Agent": "EvagriApp/1.0 (contact@evagri.ca)",
        "Accept-Language": "fr-CA",
      },
    })
    if (!res.ok) {
      console.warn("Geocoding request failed:", res.status, await res.text())
      cache.set(normalized, null)
      return null
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!data || data.length === 0) {
      cache.set(normalized, null)
      return null
    }
    const latitude = Number(data[0].lat)
    const longitude = Number(data[0].lon)
    if (isNaN(latitude) || isNaN(longitude)) {
      cache.set(normalized, null)
      return null
    }
    const result = { latitude, longitude }
    cache.set(normalized, result)
    return result
  } catch (e) {
    console.warn("Geocoding error:", (e as Error).message)
    cache.set(normalized, null)
    return null
  }
}

export function clearGeocodeCache() {
  cache.clear()
}
