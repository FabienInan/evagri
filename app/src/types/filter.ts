export const FILTER_OPERATORS = [
  "=",
  "!=",
  "<",
  ">",
  "+",
  "-",
  "entre",
  "in",
  "contient",
  "has",
] as const

export type FilterOperator = (typeof FILTER_OPERATORS)[number]

export const FILTER_TYPES = [
  "RECHERCHE_TEXTE",
  "PLAGE_NUMERIQUE",
  "PLAGE_DATE",
  "LISTE",
  "MULTI_SELECT",
  "BOOLEEN",
  "NUMERO_LOT",
  "TYPE_TRANSACTION",
  "STATUT",
  "ZONE_GEO",
] as const

export type FilterType = (typeof FILTER_TYPES)[number]

export interface FilterInput {
  id: string
  typeFiltre: FilterType
  field: string
  operator: FilterOperator
  value: string
}

export interface FilterConfig {
  id: string
  nomFiltre: string
  typeFiltre: FilterType | string
  estActif: boolean
  codeMachine?: string | null
  champEnrichissable?:
    | {
        id: string
        codeMachine: string
        nomAffichage: string
        typeDonnees: string
        nature: string
        unite?: string | null
        optionsListe?: unknown
      }
    | null
  operateursDisponibles?: FilterOperator[] | null
  ordreAffichage: number
}
