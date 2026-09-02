const CADASTRE_QUERY_URL =
  "https://geo.environnement.gouv.qc.ca/donnees/rest/services/Reference/Cadastre_allege/MapServer/0/query"

const cache = new Map<string, { latitude: number; longitude: number } | null>()

// Le champ NO_LOT du service exige le format avec espaces tous les 3 chiffres (ex: "4 128 182")
function formatLotNumber(lot: string): string {
  const digits = lot.replace(/\D/g, "")
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

type Ring = number[][]
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] }

function collectVertices(geometry: Geometry): number[][] {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat()
  return rings.flat()
}

export async function geocodeLotCadastral(
  lotNumber: string
): Promise<{ latitude: number; longitude: number } | null> {
  const formatted = formatLotNumber(lotNumber)
  if (!formatted) return null

  const cached = cache.get(formatted)
  if (cached !== undefined) return cached

  const url = new URL(CADASTRE_QUERY_URL)
  url.searchParams.set("where", `NO_LOT='${formatted}'`)
  url.searchParams.set("outFields", "NO_LOT")
  url.searchParams.set("outSR", "4326")
  url.searchParams.set("f", "geojson")

  try {
    const res = await fetch(url.toString())
    if (!res.ok) {
      cache.set(formatted, null)
      return null
    }
    const data = (await res.json()) as { features?: { geometry: Geometry }[] }
    const vertices = (data.features ?? []).flatMap((f) => collectVertices(f.geometry))
    if (vertices.length === 0) {
      cache.set(formatted, null)
      return null
    }

    const sum = vertices.reduce(
      (acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }),
      { lon: 0, lat: 0 }
    )
    const result = { latitude: sum.lat / vertices.length, longitude: sum.lon / vertices.length }
    cache.set(formatted, result)
    return result
  } catch (e) {
    console.warn("Cadastre lookup error:", (e as Error).message)
    cache.set(formatted, null)
    return null
  }
}

export function clearCadastreCache() {
  cache.clear()
}
