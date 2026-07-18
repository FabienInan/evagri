import { Prisma } from "@prisma/client"
import { parsePolygon, pointInPolygon } from "./geo"
import type { FilterInput, FilterOperator, FilterType } from "@/types/filter"

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

export const DEFAULT_OPERATEURS: Record<FilterType, FilterOperator[]> = {
  PLAGE_NUMERIQUE: ["=", "+", "-", "entre"],
  PLAGE_DATE: ["=", "+", "-", "entre"],
  LISTE: ["in"],
  MULTI_SELECT: ["in"],
  RECHERCHE_TEXTE: ["contient"],
  BOOLEEN: ["="],
  NUMERO_LOT: ["has"],
  TYPE_TRANSACTION: ["in"],
  STATUT: ["="],
  ZONE_GEO: ["in"],
}

export interface RecommendFilterTypeInput {
  codeMachine: string
  nomAffichage: string
  typeDonnees: string
  nature: string
}

const LISTE_FIELDS = new Set([
  "topographie",
  "feuillusrsineux",
  "zone_agricole_cptaq",
  "classe_de_sol_dominante",
  "mrc",
  "municipalite",
  "maisons",
])

const NUMERO_LOT_FIELDS = new Set(["lotscadastraux"])

const MULTI_SELECT_FIELDS = new Set([
  "type_de_culture",
  "type_de_sol",
])

const PLAGE_NUMERIQUE_FIELDS = new Set([
  "prixvente",
  "prix_de_vente_redress_au_temps_",
  "superficietotalehectare",
  "superficie_boise_ha",
  "superficie_cultive_ha",
  "superficie_draine_ha",
  "superficie_plantation",
  "superficie_terrain_rsidentiel_m",
  "superficie_acricole_ha",
  "zones_humides_ha",
  "densit_plantation",
  "proportion_feuillus",
  "proporition_rsineux",
  "nombre_dentailles",
  "contingent_acricole_livres",
  "taux_unitaire_global_ha",
  "valeur_contributive_maisons_terrain_",
  "valeur_contributive_btiments_agricoles_",
  "valeur_autres_inclusions_",
])

const RECHERCHE_TEXTE_FIELDS = new Set([
  "numeroInscription",
  "vendeur",
  "acheteur",
  "adresse",
  "sia",
  "mls",
  "autorisation_cptaq",
  "dcisions_cptaq",
  "observations",
  "btiments_agricoles",
  "quipements",
  "autres_inclusions",
  "droit_acquis",
  "source_valeur_constributive_maisons_terrain_",
  "source_valeur_constributive_btiments_agricoles",
  "topographie_combin_brute",
  "revue",
  "sousclasse_dominante",
  "zones_humides_types",
  "entaille",
])

export function recommendFilterType(champ: RecommendFilterTypeInput): FilterType {
  const code = champ.codeMachine.toLowerCase().trim()
  const name = champ.nomAffichage.toLowerCase().trim()
  const dataType = champ.typeDonnees.toUpperCase()

  // Filtres virtuels / spéciaux
  if (code === "typetransaction" || name.includes("type de transaction")) {
    return "TYPE_TRANSACTION"
  }
  if (code === "statut") {
    return "STATUT"
  }
  if (code === "latitude" || code === "longitude") {
    return "ZONE_GEO"
  }

  if (LISTE_FIELDS.has(code)) {
    return "LISTE"
  }

  if (MULTI_SELECT_FIELDS.has(code)) {
    return "MULTI_SELECT"
  }

  if (PLAGE_NUMERIQUE_FIELDS.has(code)) {
    return "PLAGE_NUMERIQUE"
  }

  if (NUMERO_LOT_FIELDS.has(code)) {
    return "NUMERO_LOT"
  }

  if (RECHERCHE_TEXTE_FIELDS.has(code)) {
    return "RECHERCHE_TEXTE"
  }

  if (champ.nature === "SOURCE") {
    if (dataType === "DATE") return "PLAGE_DATE"
    if (["DECIMAL", "ENTIER"].includes(dataType)) return "PLAGE_NUMERIQUE"
    return "RECHERCHE_TEXTE"
  }

  switch (dataType) {
    case "BOOLEAN":
      return "BOOLEEN"
    case "DATE":
      return "PLAGE_DATE"
    case "DECIMAL":
    case "ENTIER":
      return "PLAGE_NUMERIQUE"
    case "LISTE":
      return "LISTE"
    case "TEXTE":
    default:
      return "RECHERCHE_TEXTE"
  }
}
