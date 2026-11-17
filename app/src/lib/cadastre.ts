import { formatNumeroLot } from "@/lib/lot-cadastral"

const CADASTRE_QUERY_URL =
  "https://geo.environnement.gouv.qc.ca/donnees/rest/services/Reference/Cadastre_allege/MapServer/0/query"

const cache = new Map<string, { latitude: number; longitude: number } | null>()

/** Nombre maximal de lots géocodés pour un même dossier ou un même import. */
const MAX_LOTS_GEOCODES = 5

type Ring = number[][]
type Geometry = { type: "Polygon"; coordinates: Ring[] } | { type: "MultiPolygon"; coordinates: Ring[][] }

function collectVertices(geometry: Geometry): number[][] {
  const rings = geometry.type === "Polygon" ? geometry.coordinates : geometry.coordinates.flat()
  return rings.flat()
}

export async function geocodeLotCadastral(
  lotNumber: string
): Promise<{ latitude: number; longitude: number } | null> {
  // Le champ NO_LOT du service exige le format avec espaces tous les 3 chiffres (ex: "4 128 182")
  const formatted = formatNumeroLot(lotNumber)
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

/** Moyenne des coordonnées trouvées ; null si la liste est vide. */
export function moyenneCoordonnees(
  points: { latitude: number; longitude: number }[]
): { latitude: number; longitude: number } | null {
  if (points.length === 0) return null
  const sum = points.reduce((acc, p) => ({ lat: acc.lat + p.latitude, lon: acc.lon + p.longitude }), { lat: 0, lon: 0 })
  return { latitude: sum.lat / points.length, longitude: sum.lon / points.length }
}

/** Géocode chaque lot (5 premiers au plus) et renvoie le détail par lot ainsi que la moyenne des lots trouvés. */
export async function geocodeLotsDetail(lots: string[]): Promise<{
  parLot: { lot: string; coordonnees: { latitude: number; longitude: number } | null }[]
  moyenne: { latitude: number; longitude: number } | null
}> {
  const parLot = await Promise.all(
    lots.slice(0, MAX_LOTS_GEOCODES).map(async (lot) => ({ lot, coordonnees: await geocodeLotCadastral(lot) }))
  )
  const trouves = parLot.flatMap((p) => (p.coordonnees ? [p.coordonnees] : []))
  return { parLot, moyenne: moyenneCoordonnees(trouves) }
}

/** Géocode plusieurs lots (5 premiers au plus) et fait la moyenne de ceux trouvés. Null si aucun n'est trouvé. */
export async function geocodeLotsCadastraux(
  lots: string[]
): Promise<{ latitude: number; longitude: number } | null> {
  return (await geocodeLotsDetail(lots)).moyenne
}

export function clearCadastreCache() {
  cache.clear()
}
