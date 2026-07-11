import { Prisma } from "@prisma/client"
import { parsePolygon, pointInPolygon } from "./geo"
import type { FilterInput, FilterType } from "@/types/filter"

export type { FilterInput }

export function buildWhereClause(filters: FilterInput[]): Prisma.TransactionSourceWhereInput {
  const andClauses: Prisma.TransactionSourceWhereInput[] = []

  for (const f of filters) {
    if (!f.value && f.value !== "0") continue

    const field = f.field as keyof Prisma.TransactionSourceWhereInput
    let clause: Prisma.TransactionSourceWhereInput = {}

    switch (f.typeFiltre as FilterType) {
      case "RECHERCHE_TEXTE":
        clause = {
          OR: [
            { numeroInscription: { contains: f.value, mode: "insensitive" } },
            { vendeur: { contains: f.value, mode: "insensitive" } },
            { acheteur: { contains: f.value, mode: "insensitive" } },
            { municipalite: { contains: f.value, mode: "insensitive" } },
          ],
        }
        break
      case "PLAGE_NUMERIQUE":
        if (f.operator === "entre") {
          const [min, max] = f.value.split("-").map(Number)
          clause = { [field]: { gte: min, lte: max } }
        } else if (f.operator === "+") {
          clause = { [field]: { gte: Number(f.value) } }
        } else if (f.operator === "-") {
          clause = { [field]: { lte: Number(f.value) } }
        } else {
          clause = { [field]: { equals: Number(f.value) } }
        }
        break
      case "PLAGE_DATE":
        if (f.operator === "entre") {
          const [start, end] = f.value.split(",").map((s) => new Date(s.trim()))
          clause = { [field]: { gte: start, lte: end } }
        } else if (f.operator === "+") {
          clause = { [field]: { gte: new Date(f.value) } }
        } else if (f.operator === "-") {
          clause = { [field]: { lte: new Date(f.value) } }
        } else {
          clause = { [field]: { equals: new Date(f.value) } }
        }
        break
      case "LISTE":
      case "MULTI_SELECT":
        clause = { [field]: { in: f.value.split(",") } }
        break
      case "BOOLEEN":
        clause = { [field]: f.value === "true" }
        break
      case "NUMERO_LOT":
        clause = { lotsCadastraux: { has: f.value } }
        break
      case "TYPE_TRANSACTION":
        clause = {
          enrichie: {
            valeurs: {
              some: {
                champEnrichissable: { codeMachine: "typeTransaction" },
                valeurTexte: { in: f.value.split(",") },
              },
            },
          },
        }
        break
      case "STATUT":
        clause = {
          enrichie: {
            statut: f.operator === "=" ? f.value : { in: f.value.split(",") },
          },
        }
        break
      case "ZONE_GEO":
        // Filtre géographique appliqué de manière applicative après la requête Prisma
        break
    }

    if (Object.keys(clause).length > 0) {
      andClauses.push(clause)
    }
  }

  return andClauses.length > 0 ? { AND: andClauses } : {}
}

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
