import { describe, it, expect } from "vitest"
import { parseEnrichmentValue } from "@/services/import.service"
import type { EnrichmentChamp } from "@/types/import"

function champ(codeMachine: string, typeDonnees: string): EnrichmentChamp {
  return { id: "c1", header: codeMachine, codeMachine, typeDonnees }
}

describe("parseEnrichmentValue", () => {
  it("canonicalizes a cptaq value to Oui/Non/Partiel even when the champ is typed LISTE", () => {
    expect(parseEnrichmentValue(champ("cptaq", "LISTE"), "oui").valeurTexte).toBe("Oui")
    expect(parseEnrichmentValue(champ("cptaq", "LISTE"), "en partie").valeurTexte).toBe("Partiel")
    expect(parseEnrichmentValue(champ("cptaq", "TEXTE"), "non").valeurTexte).toBe("Non")
  })

  it("keeps a combined MULTI_SELECT answer as its raw delimited text", () => {
    expect(parseEnrichmentValue(champ("type_de_culture", "MULTI_SELECT"), "Cultures annuelles, Prairie").valeurTexte).toBe(
      "Cultures annuelles, Prairie"
    )
  })

  it("routes decimals and booleans to their columns", () => {
    expect(parseEnrichmentValue(champ("superficie_boise_ha", "DECIMAL"), "12,5").valeurNombre?.toString()).toBe("12.5")
    expect(parseEnrichmentValue(champ("droit_acquis", "BOOLEAN"), "Non").valeurBooleen).toBe(false)
  })

  it("returns an all-null triple for a blank cell", () => {
    expect(parseEnrichmentValue(champ("observations", "TEXTE"), "")).toEqual({
      valeurNombre: null,
      valeurTexte: null,
      valeurBooleen: null,
    })
  })
})
