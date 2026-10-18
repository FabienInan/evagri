import type { FilterConfig, FilterType } from "@/types/filter"

export const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  PLAGE_NUMERIQUE: "Plage de valeurs",
  PLAGE_DATE: "Plage de dates",
  LISTE: "Liste",
  MULTI_SELECT: "Multi-sélection",
  RECHERCHE_TEXTE: "Recherche texte",
  BOOLEEN: "Booléen",
  NUMERO_LOT: "Numéro de lot",
  TYPE_TRANSACTION: "Type de transaction",
  STATUT: "Statut",
  ZONE_GEO: "Zone géographique",
  // Type virtuel piloté par l'interrupteur « Reventes » du panneau de filtres, pas par un filtre configurable.
  REVENTE: "Reventes (lots vendus 2 fois)",
}

// Dérivé des libellés : la liste déroulante et les libellés ne peuvent plus diverger, et tous les types
// (y compris ceux recommandés pour les sources : NUMERO_LOT, ZONE_GEO, ...) restent sélectionnables.
export const FILTER_TYPE_OPTIONS: { value: FilterType; label: string }[] = (
  [
    "PLAGE_NUMERIQUE",
    "PLAGE_DATE",
    "LISTE",
    "MULTI_SELECT",
    "RECHERCHE_TEXTE",
    "BOOLEEN",
    "NUMERO_LOT",
    "TYPE_TRANSACTION",
    "STATUT",
    "ZONE_GEO",
  ] as FilterType[]
).map((value) => ({ value, label: FILTER_TYPE_LABELS[value] }))

export const DATA_TYPE_LABELS: Record<string, string> = {
  TEXTE: "Texte",
  DECIMAL: "Décimal",
  ENTIER: "Entier",
  DATE: "Date",
  LISTE: "Liste",
  BOOLEAN: "Booléen",
}

export const VIRTUAL_FILTERS = [
  { codeMachine: "statut", nomFiltre: "Statut d'analyse", typeFiltre: "LISTE" as const },
]

export type Champ = {
  id: string
  codeMachine: string
  nomAffichage: string
  typeDonnees: string
  unite: string
  typeFiltreRecommande: string | null
}

export type Filter = FilterConfig
