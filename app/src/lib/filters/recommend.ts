import type { FilterType } from "@/types/filter"

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
  champ?: {
    codeMachine: string
    nomAffichage: string
    typeDonnees: string
  } | null
}

/**
 * Recommends a filter type for a configured filter's target, applying the heuristic to its champ. Returns
 * null for virtual filters (statut, ...) and unknown targets so callers can fall back to their own default.
 */
export function recommendedTypeForField(input: RecommendFilterTypeForFieldInput): FilterType | null {
  if (input.champ) return recommendFilterType(input.champ)
  return null
}
