import { Prisma } from "@prisma/client"
import { parsePolygon, pointInPolygon } from "./geo"
import { booleanTextMatches } from "./normalization/parsing"
import type { FilterInput, FilterOperator, FilterType } from "@/types/filter"
import { isSourceFieldCode, sourceColumnOf, SOURCE_FIELD_BY_CODE } from "./transaction-source-fields"

export type { FilterInput }

/** Prisma column key for a source field code. The catalogue bounds the value, so it doubles as a whitelist. */
function sourceColumnKey(field: string): keyof Prisma.TransactionSourceWhereInput | null {
  const column = sourceColumnOf(field)
  return column ? (column as keyof Prisma.TransactionSourceWhereInput) : null
}

function buildEnrichmentWhereClause(
  field: string,
  typeFiltre: FilterType,
  operator: FilterOperator,
  value: string
): Prisma.TransactionSourceWhereInput {
  let valeurClause: Prisma.ValeurEnrichissementWhereInput = { champEnrichissable: { codeMachine: field } }

  switch (typeFiltre) {
    case "RECHERCHE_TEXTE":
      valeurClause = {
        ...valeurClause,
        valeurTexte: { contains: value, mode: "insensitive" },
      }
      break
    case "PLAGE_NUMERIQUE":
      if (operator === "entre") {
        const [min, max] = value.split("-").map(Number)
        valeurClause = { ...valeurClause, valeurNombre: { gte: min, lte: max } }
      } else if (operator === "+") {
        valeurClause = { ...valeurClause, valeurNombre: { gte: Number(value) } }
      } else if (operator === "-") {
        valeurClause = { ...valeurClause, valeurNombre: { lte: Number(value) } }
      } else {
        valeurClause = { ...valeurClause, valeurNombre: { equals: Number(value) } }
      }
      break
    case "PLAGE_DATE":
      if (operator === "entre") {
        const [start, end] = value.split(",").map((s) => new Date(s.trim()))
        valeurClause = { ...valeurClause, valeurTexte: { gte: start.toISOString(), lte: end.toISOString() } }
      } else if (operator === "+") {
        valeurClause = { ...valeurClause, valeurTexte: { gte: new Date(value).toISOString() } }
      } else if (operator === "-") {
        valeurClause = { ...valeurClause, valeurTexte: { lte: new Date(value).toISOString() } }
      } else {
        valeurClause = { ...valeurClause, valeurTexte: { equals: new Date(value).toISOString() } }
      }
      break
    case "LISTE":
    case "MULTI_SELECT":
      valeurClause = { ...valeurClause, valeurTexte: { in: value.split(","), mode: "insensitive" } }
      break
    case "BOOLEEN": {
      // Le champ ciblé peut être un vrai BOOLEAN (valeur_booleen) ou un champ TEXTE dont la réponse est
      // stockée telle quelle (« Oui »/« Non » dans valeur_texte). On matche les deux, sinon un filtre
      // booléen posé sur un champ texte renvoie zéro résultat en silence.
      const truthy = value === "true"
      valeurClause = {
        ...valeurClause,
        OR: [
          { valeurBooleen: truthy },
          { valeurTexte: { in: booleanTextMatches(truthy), mode: "insensitive" } },
        ],
      }
      break
    }
    case "NUMERO_LOT":
      valeurClause = { ...valeurClause, valeurTexte: { contains: value, mode: "insensitive" } }
      break
    default:
      valeurClause = { ...valeurClause, valeurTexte: { contains: value, mode: "insensitive" } }
  }

  return {
    enrichie: {
      valeurs: {
        some: valeurClause,
      },
    },
  }
}

export function buildWhereClause(filters: FilterInput[]): Prisma.TransactionSourceWhereInput {
  const andClauses: Prisma.TransactionSourceWhereInput[] = []

  for (const f of filters) {
    if (!f.value && f.value !== "0") continue

    const field = f.field
    const isSource = isSourceFieldCode(field)
    const column = isSource ? sourceColumnKey(field) : null
    let clause: Prisma.TransactionSourceWhereInput = {}

    switch (f.typeFiltre as FilterType) {
      case "RECHERCHE_TEXTE":
        if (column) {
          clause = { [column]: { contains: f.value, mode: "insensitive" } } as Prisma.TransactionSourceWhereInput
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, "RECHERCHE_TEXTE", f.operator as FilterOperator, f.value)
        }
        break
      case "PLAGE_NUMERIQUE":
        if (column) {
          if (f.operator === "entre") {
            const [min, max] = f.value.split("-").map(Number)
            clause = { [column]: { gte: min, lte: max } }
          } else if (f.operator === "+") {
            clause = { [column]: { gte: Number(f.value) } }
          } else if (f.operator === "-") {
            clause = { [column]: { lte: Number(f.value) } }
          } else {
            clause = { [column]: { equals: Number(f.value) } }
          }
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, "PLAGE_NUMERIQUE", f.operator as FilterOperator, f.value)
        }
        break
      case "PLAGE_DATE":
        if (column) {
          if (f.operator === "entre") {
            const [start, end] = f.value.split(",").map((s) => new Date(s.trim()))
            clause = { [column]: { gte: start, lte: end } }
          } else if (f.operator === "+") {
            clause = { [column]: { gte: new Date(f.value) } }
          } else if (f.operator === "-") {
            clause = { [column]: { lte: new Date(f.value) } }
          } else {
            clause = { [column]: { equals: new Date(f.value) } }
          }
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, "PLAGE_DATE", f.operator as FilterOperator, f.value)
        }
        break
      case "LISTE":
      case "MULTI_SELECT":
        if (column) {
          clause = { [column]: { in: f.value.split(","), mode: "insensitive" } } as Prisma.TransactionSourceWhereInput
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, f.typeFiltre as FilterType, "in", f.value)
        }
        break
      case "BOOLEEN":
        if (column) {
          clause = { [column]: f.value === "true" }
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, "BOOLEEN", "=", f.value)
        }
        break
      case "NUMERO_LOT":
        if (column && SOURCE_FIELD_BY_CODE[field]?.array) {
          clause = { [column]: { has: f.value } }
        } else {
          clause = buildEnrichmentWhereClause(field, "NUMERO_LOT", "has", f.value)
        }
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
      case "REVENTE":
        // Cible un ensemble de lots calculé en amont (findRenteLotNumbers) : la clause est ajoutée par
        // l'appelant, qui seul a accès à la base. Ici on ne produit aucune clause directe.
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

export function findRenteFilter(filters: FilterInput[]): FilterInput | undefined {
  return filters.find((f) => f.typeFiltre === "REVENTE")
}

/**
 * Reorders already-sorted transactions so that those linked by a shared duplicated lot are contiguous —
 * a vente and its revente(s) end up one after the other. Linked means sharing any lot from `duplicatedLots`
 * (the lots sold ≥ 2 times), transitively: a transaction carrying two resold lots bridges both groups, so
 * chains stay together instead of splitting. Input order is preserved within a group, and groups are emitted
 * by the position of their best-ranked member, so the caller's sort still drives the overall order. Rows are
 * never duplicated: a transaction stays on a single line.
 */
export function orderRenteTransactions<T extends { id: string; lotsCadastraux: string[] }>(
  transactions: T[],
  duplicatedLots: Set<string>
): T[] {
  const n = transactions.length
  if (n === 0) return transactions

  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  const lotOwner = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    for (const lot of transactions[i].lotsCadastraux) {
      if (!duplicatedLots.has(lot)) continue
      const owner = lotOwner.get(lot)
      if (owner === undefined) lotOwner.set(lot, i)
      else union(i, owner)
    }
  }

  const groups = new Map<number, T[]>()
  const rootsInOrder: number[] = []
  for (let i = 0; i < n; i++) {
    const root = find(i)
    let group = groups.get(root)
    if (!group) {
      group = []
      groups.set(root, group)
      rootsInOrder.push(root)
    }
    group.push(transactions[i])
  }

  return rootsInOrder.flatMap((root) => groups.get(root)!)
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
  REVENTE: ["="],
}

/**
 * Moves the item `fromId` to insertion slot `toIndex` and renumbers `ordreAffichage` to the resulting
 * positions (0-based). `toIndex` is a slot in the current display order: 0 inserts before the first
 * item, `items.length` appends after the last. Returns the list unchanged when the id is missing.
 */
export function moveItemToIndex<T extends { id: string; ordreAffichage: number }>(
  items: T[],
  fromId: string,
  toIndex: number
): T[] {
  const fromIndex = items.findIndex((i) => i.id === fromId)
  if (fromIndex === -1) return items

  const ordered = [...items]
  const [moved] = ordered.splice(fromIndex, 1)
  // Slot computed against the list including the moved item: past its old position it shifts down by one.
  const insertAt = Math.max(0, Math.min(toIndex > fromIndex ? toIndex - 1 : toIndex, ordered.length))
  ordered.splice(insertAt, 0, moved)
  return ordered.map((item, index) => ({ ...item, ordreAffichage: index }))
}

export interface RecommendFilterTypeInput {
  codeMachine: string
  nomAffichage: string
  typeDonnees: string
}

const LISTE_FIELDS = new Set([
  "topographie",
  "feuillusrsineux",
  "zone_agricole_cptaq",
  "classe_de_sol_dominante",
  "maisons",
])

const MULTI_SELECT_FIELDS = new Set([
  "type_de_culture",
  "type_de_sol",
])

const PLAGE_NUMERIQUE_FIELDS = new Set([
  "prix_de_vente_redress_au_temps_",
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

  if (RECHERCHE_TEXTE_FIELDS.has(code)) {
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
    case "MULTI_SELECT":
      return "MULTI_SELECT"
    case "TEXTE":
    default:
      return "RECHERCHE_TEXTE"
  }
}

export interface RecommendFilterTypeForFieldInput {
  codeMachine?: string | null
  champEnrichissable?: {
    codeMachine: string
    nomAffichage: string
    typeDonnees: string
  } | null
}

/**
 * Recommends a filter type for a configured filter's target, matching the create form's behaviour: a source
 * code uses the catalogue's `typeFiltreRecommande`, an enrichment field uses the heuristic. Returns null for
 * virtual filters (statut, ...) and unknown targets so callers can fall back to their own default.
 */
export function recommendedTypeForField(input: RecommendFilterTypeForFieldInput): FilterType | null {
  if (input.codeMachine && isSourceFieldCode(input.codeMachine)) {
    return SOURCE_FIELD_BY_CODE[input.codeMachine]?.typeFiltreRecommande ?? null
  }
  if (input.champEnrichissable) {
    return recommendFilterType(input.champEnrichissable)
  }
  return null
}
