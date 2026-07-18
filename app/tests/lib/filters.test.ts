import { describe, it, expect } from "vitest"
import { recommendFilterType, DEFAULT_OPERATEURS } from "@/lib/filters"
import type { FilterType } from "@/types/filter"

describe("recommendFilterType", () => {
  it("recommends LISTE for topography", () => {
    const result = recommendFilterType({
      codeMachine: "topographie",
      nomAffichage: "Topographie",
      typeDonnees: "TEXTE",
      nature: "SAISISSABLE",
    })
    expect(result).toBe("LISTE")
  })

  it("recommends PLAGE_NUMERIQUE for price", () => {
    const result = recommendFilterType({
      codeMachine: "prixVente",
      nomAffichage: "Prix de vente",
      typeDonnees: "DECIMAL",
      nature: "SOURCE",
    })
    expect(result).toBe("PLAGE_NUMERIQUE")
  })

  it("recommends LISTE for mrc", () => {
    const result = recommendFilterType({
      codeMachine: "mrc",
      nomAffichage: "MRC",
      typeDonnees: "TEXTE",
      nature: "SOURCE",
    })
    expect(result).toBe("LISTE")
  })

  it("recommends MULTI_SELECT for type_de_culture", () => {
    const result = recommendFilterType({
      codeMachine: "type_de_culture",
      nomAffichage: "Type de culture",
      typeDonnees: "TEXTE",
      nature: "SAISISSABLE",
    })
    expect(result).toBe("MULTI_SELECT")
  })

  it("recommends RECHERCHE_TEXTE for source numeroInscription", () => {
    const result = recommendFilterType({
      codeMachine: "numeroInscription",
      nomAffichage: "No d'enr.",
      typeDonnees: "TEXTE",
      nature: "SOURCE",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends PLAGE_DATE for source dateVente", () => {
    const result = recommendFilterType({
      codeMachine: "dateVente",
      nomAffichage: "Date de vente",
      typeDonnees: "DATE",
      nature: "SOURCE",
    })
    expect(result).toBe("PLAGE_DATE")
  })

  it("recommends BOOLEEN for boolean saisissable", () => {
    const result = recommendFilterType({
      codeMachine: "nouveauChamp",
      nomAffichage: "Nouveau champ",
      typeDonnees: "BOOLEAN",
      nature: "SAISISSABLE",
    })
    expect(result).toBe("BOOLEEN")
  })

  it("recommends TYPE_TRANSACTION for typeTransaction", () => {
    const result = recommendFilterType({
      codeMachine: "typeTransaction",
      nomAffichage: "Type de transaction",
      typeDonnees: "TEXTE",
      nature: "SAISISSABLE",
    })
    expect(result).toBe("TYPE_TRANSACTION")
  })

  it("recommends NUMERO_LOT for lotsCadastraux", () => {
    const result = recommendFilterType({
      codeMachine: "lotsCadastraux",
      nomAffichage: "Lots",
      typeDonnees: "TEXTE",
      nature: "SOURCE",
    })
    expect(result).toBe("NUMERO_LOT")
  })

  it("recommends RECHERCHE_TEXTE for sousclasse_dominante", () => {
    const result = recommendFilterType({
      codeMachine: "sousclasse_dominante",
      nomAffichage: "Sous-classe dominante",
      typeDonnees: "TEXTE",
      nature: "SAISISSABLE",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends RECHERCHE_TEXTE for entaille", () => {
    const result = recommendFilterType({
      codeMachine: "entaille",
      nomAffichage: "$/entaille",
      typeDonnees: "ENTIER",
      nature: "SAISISSABLE",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends RECHERCHE_TEXTE for mls", () => {
    const result = recommendFilterType({
      codeMachine: "mls",
      nomAffichage: "# MLS",
      typeDonnees: "ENTIER",
      nature: "SAISISSABLE",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends PLAGE_NUMERIQUE for superficie_cultive_ha", () => {
    const result = recommendFilterType({
      codeMachine: "superficie_cultive_ha",
      nomAffichage: "Superficie cultivée (ha)",
      typeDonnees: "DECIMAL",
      nature: "SAISISSABLE",
    })
    expect(result).toBe("PLAGE_NUMERIQUE")
  })
})

describe("DEFAULT_OPERATEURS", () => {
  it("has operators for every filter type", () => {
    const types: FilterType[] = [
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
    ]
    for (const t of types) {
      expect(DEFAULT_OPERATEURS[t]).toBeDefined()
      expect(DEFAULT_OPERATEURS[t].length).toBeGreaterThan(0)
    }
  })
})
