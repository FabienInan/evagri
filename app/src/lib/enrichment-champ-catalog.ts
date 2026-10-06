import {
  CULTURE_OPTIONS,
  CPTAQ_ZONE_OPTIONS,
  FEUILLUS_RESINEUX_OPTIONS,
  SOL_OPTIONS,
  TOPOGRAPHY_OPTIONS,
} from "@/lib/normalization/transforms"
import type { TypeDonneesChamp } from "@/types/champ"

/**
 * Canonical definition of the enrichment champs whose type/data cannot be trusted to value-shape inference
 * (`inferType`, which only sees a single sample and can never emit LISTE/MULTI_SELECT or set options).
 *
 * Serves as the single source of truth for two things:
 *  - the live import (`ensureEnrichmentChamps`) creates those champs with the right type + options instead
 *    of re-deriving them from a spreadsheet cell;
 *  - the one-off backfill (`scripts/backfill-champ-types.ts`) aligns existing rows.
 *
 * The option lists are imported from the normalizers so a field's dropdown and its stored canonical values
 * can never drift apart.
 */
export interface EnrichmentChampDef {
  typeDonnees: TypeDonneesChamp
  optionsListe: string[] | null
}

export const ENRICHMENT_CHAMP_CATALOG: Record<string, EnrichmentChampDef> = {
  topographie: { typeDonnees: "LISTE", optionsListe: TOPOGRAPHY_OPTIONS },
  feuillusrsineux: { typeDonnees: "LISTE", optionsListe: FEUILLUS_RESINEUX_OPTIONS },
  cptaq: { typeDonnees: "LISTE", optionsListe: CPTAQ_ZONE_OPTIONS },
  zone_agricole_cptaq: { typeDonnees: "LISTE", optionsListe: CPTAQ_ZONE_OPTIONS },
  type_de_culture: { typeDonnees: "MULTI_SELECT", optionsListe: CULTURE_OPTIONS },
  type_de_sol: { typeDonnees: "MULTI_SELECT", optionsListe: SOL_OPTIONS },
  superficie_plantation: { typeDonnees: "DECIMAL", optionsListe: null },
  prix_de_vente_redress_au_temps_: { typeDonnees: "DECIMAL", optionsListe: null },
  valeur_autres_inclusions_: { typeDonnees: "DECIMAL", optionsListe: null },
  valeur_contributive_btiments_agricoles_: { typeDonnees: "DECIMAL", optionsListe: null },
  valeur_contributive_maisons_terrain_: { typeDonnees: "DECIMAL", optionsListe: null },
}

export function enrichmentChampDef(codeMachine: string): EnrichmentChampDef | null {
  return ENRICHMENT_CHAMP_CATALOG[codeMachine] ?? null
}
