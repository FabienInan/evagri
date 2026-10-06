import { describe, it, expect } from "vitest"
import { ENRICHMENT_CHAMP_CATALOG, enrichmentChampDef } from "@/lib/enrichment-champ-catalog"
import {
  CULTURE_OPTIONS,
  CPTAQ_ZONE_OPTIONS,
  FEUILLUS_RESINEUX_OPTIONS,
  SOL_OPTIONS,
  TOPOGRAPHY_OPTIONS,
} from "@/lib/normalization/transforms"

describe("enrichmentChampDef", () => {
  it("types the closed-vocabulary fields as LISTE with their canonical options", () => {
    expect(enrichmentChampDef("topographie")).toEqual({ typeDonnees: "LISTE", optionsListe: TOPOGRAPHY_OPTIONS })
    expect(enrichmentChampDef("feuillusrsineux")).toEqual({ typeDonnees: "LISTE", optionsListe: FEUILLUS_RESINEUX_OPTIONS })
    expect(enrichmentChampDef("cptaq")).toEqual({ typeDonnees: "LISTE", optionsListe: CPTAQ_ZONE_OPTIONS })
    expect(enrichmentChampDef("zone_agricole_cptaq")).toEqual({ typeDonnees: "LISTE", optionsListe: CPTAQ_ZONE_OPTIONS })
  })

  it("types the multi-value fields as MULTI_SELECT", () => {
    expect(enrichmentChampDef("type_de_culture")).toEqual({ typeDonnees: "MULTI_SELECT", optionsListe: CULTURE_OPTIONS })
    expect(enrichmentChampDef("type_de_sol")).toEqual({ typeDonnees: "MULTI_SELECT", optionsListe: SOL_OPTIONS })
  })

  it("types the mistyped money/area fields as DECIMAL without options", () => {
    for (const code of [
      "superficie_plantation",
      "prix_de_vente_redress_au_temps_",
      "valeur_autres_inclusions_",
      "valeur_contributive_btiments_agricoles_",
      "valeur_contributive_maisons_terrain_",
    ]) {
      expect(enrichmentChampDef(code)).toEqual({ typeDonnees: "DECIMAL", optionsListe: null })
    }
  })

  it("returns null for an uncatalogued code", () => {
    expect(enrichmentChampDef("observations")).toBeNull()
  })

  it("only catalogues fields whose options are non-empty for the option-based types", () => {
    for (const def of Object.values(ENRICHMENT_CHAMP_CATALOG)) {
      if (def.typeDonnees === "LISTE" || def.typeDonnees === "MULTI_SELECT") {
        expect(def.optionsListe && def.optionsListe.length).toBeGreaterThan(0)
      }
    }
  })
})
