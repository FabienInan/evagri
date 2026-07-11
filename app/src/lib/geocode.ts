const LAST_CALL_MS = 1100
let lastCallAt = 0

export async function geocodeAddress(
  query: string
): Promise<{ latitude: number; longitude: number } | null> {
  if (!query || !query.trim()) return null

  const normalized = query.trim()
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
      return null
    }
    const data = (await res.json()) as Array<{ lat: string; lon: string }>
    if (!data || data.length === 0) return null
    const latitude = Number(data[0].lat)
    const longitude = Number(data[0].lon)
    if (isNaN(latitude) || isNaN(longitude)) return null
    return { latitude, longitude }
  } catch (e) {
    console.warn("Geocoding error:", (e as Error).message)
    return null
  }
}
