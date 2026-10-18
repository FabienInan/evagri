import { Prisma } from "@prisma/client"
import { booleanTextMatches } from "@/lib/normalization/parsing"
import type { FilterInput, FilterOperator, FilterType } from "@/types/filter"

function buildFieldWhereClause(
  field: string,
  typeFiltre: FilterType,
  operator: FilterOperator,
  value: string
): Prisma.TransactionWhereInput {
  let valeurClause: Prisma.ValeurChampWhereInput = { champ: { codeMachine: field } }

  switch (typeFiltre) {
    case "RECHERCHE_TEXTE":
      valeurClause = { ...valeurClause, valeurTexte: { contains: value, mode: "insensitive" } }
      break
    case "PLAGE_NUMERIQUE":
      if (operator === "entre") {
        const [min, max] = value.split("-").map(Number)
        valeurClause = { ...valeurClause, valeurNombre: { gte: min, lte: max } }
      } else if (operator === "+") valeurClause = { ...valeurClause, valeurNombre: { gte: Number(value) } }
      else if (operator === "-") valeurClause = { ...valeurClause, valeurNombre: { lte: Number(value) } }
      else valeurClause = { ...valeurClause, valeurNombre: { equals: Number(value) } }
      break
    case "PLAGE_DATE":
      if (operator === "entre") {
        const [start, end] = value.split(",").map((s) => new Date(s.trim()))
        valeurClause = { ...valeurClause, valeurDate: { gte: start, lte: end } }
      } else if (operator === "+") valeurClause = { ...valeurClause, valeurDate: { gte: new Date(value) } }
      else if (operator === "-") valeurClause = { ...valeurClause, valeurDate: { lte: new Date(value) } }
      else valeurClause = { ...valeurClause, valeurDate: { equals: new Date(value) } }
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
      valeurClause = { ...valeurClause, valeurTexteMultiple: { has: value } }
      break
    default:
      valeurClause = { ...valeurClause, valeurTexte: { contains: value, mode: "insensitive" } }
  }

  return { valeurs: { some: valeurClause } }
}

export function buildWhereClause(filters: FilterInput[]): Prisma.TransactionWhereInput {
  const andClauses: Prisma.TransactionWhereInput[] = []

  for (const f of filters) {
    if (!f.value && f.value !== "0") continue
    let clause: Prisma.TransactionWhereInput = {}

    switch (f.typeFiltre as FilterType) {
      case "RECHERCHE_TEXTE":
      case "PLAGE_NUMERIQUE":
      case "PLAGE_DATE":
      case "LISTE":
      case "MULTI_SELECT":
      case "BOOLEEN":
      case "NUMERO_LOT":
        clause = buildFieldWhereClause(f.field, f.typeFiltre as FilterType, f.operator as FilterOperator, f.value)
        break
      case "TYPE_TRANSACTION":
        clause = { valeurs: { some: { champ: { codeMachine: "typeTransaction" }, valeurTexte: { in: f.value.split(",") } } } }
        break
      case "STATUT":
        clause = { statut: f.operator === "=" ? (f.value as never) : { in: f.value.split(",") as never } }
        break
      case "ZONE_GEO":
      case "REVENTE":
        // appliqués de manière applicative après la requête
        break
    }

    if (Object.keys(clause).length > 0) andClauses.push(clause)
  }

  return andClauses.length > 0 ? { AND: andClauses } : {}
}
