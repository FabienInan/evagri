import { describe, it, expect } from "vitest"
import { parseFieldValue } from "@/services/import.service"
import type { EnrichmentChamp } from "@/types/import"

function champ(codeMachine: string, typeDonnees: string): EnrichmentChamp {
  return { id: "c1", header: codeMachine, codeMachine, typeDonnees }
}

describe("parseFieldValue", () => {
  it("canonicalizes a cptaq value to Oui/Non/Partiel even when the champ is typed LISTE", () => {
    expect(parseFieldValue(champ("cptaq", "LISTE"), "oui").valeurTexte).toBe("Oui")
    expect(parseFieldValue(champ("cptaq", "LISTE"), "en partie").valeurTexte).toBe("Partiel")
    expect(parseFieldValue(champ("cptaq", "TEXTE"), "non").valeurTexte).toBe("Non")
  })

  it("keeps a combined MULTI_SELECT answer as its raw delimited text", () => {
    expect(parseFieldValue(champ("type_de_culture", "MULTI_SELECT"), "Cultures annuelles, Prairie").valeurTexte).toBe(
      "Cultures annuelles, Prairie"
    )
  })

  it("routes decimals and booleans to their columns", () => {
    expect(parseFieldValue(champ("superficie_boise_ha", "DECIMAL"), "12,5").valeurNombre?.toString()).toBe("12.5")
    expect(parseFieldValue(champ("droit_acquis", "BOOLEAN"), "Non").valeurBooleen).toBe(false)
  })

  it("splits a TEXTE_MULTIPLE cell into valeurTexteMultiple", () => {
    expect(parseFieldValue(champ("lots_cadastraux", "TEXTE_MULTIPLE"), "5433069; 5433070").valeurTexteMultiple).toEqual([
      "5433069",
      "5433070",
    ])
    expect(parseFieldValue(champ("lots_cadastraux", "TEXTE_MULTIPLE"), 5433069).valeurTexteMultiple).toEqual([
      "5433069",
    ])
  })

  it("parses a DATE cell into valeurDate", () => {
    const parsed = parseFieldValue(champ("date_vente", "DATE"), 42507)
    expect(parsed.valeurDate).toBeInstanceOf(Date)
    expect(parsed.valeurDate?.toISOString().slice(0, 10)).toBe("2016-05-17")
  })

  it("returns an all-null quintuplet for a blank cell", () => {
    expect(parseFieldValue(champ("observations", "TEXTE"), "")).toEqual({
      valeurNombre: null,
      valeurTexte: null,
      valeurTexteMultiple: [],
      valeurBooleen: null,
      valeurDate: null,
    })
  })
})
