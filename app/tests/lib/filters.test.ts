import { describe, it, expect } from "vitest"
import { recommendFilterType, DEFAULT_OPERATEURS, buildWhereClause, moveItemToIndex } from "@/lib/filters"
import type { FilterInput, FilterType } from "@/types/filter"

describe("recommendFilterType", () => {
  it("recommends LISTE for topography", () => {
    const result = recommendFilterType({
      codeMachine: "topographie",
      nomAffichage: "Topographie",
      typeDonnees: "TEXTE",
    })
    expect(result).toBe("LISTE")
  })

  it("recommends MULTI_SELECT for type_de_culture", () => {
    const result = recommendFilterType({
      codeMachine: "type_de_culture",
      nomAffichage: "Type de culture",
      typeDonnees: "TEXTE",
    })
    expect(result).toBe("MULTI_SELECT")
  })

  it("recommends BOOLEEN for boolean saisissable", () => {
    const result = recommendFilterType({
      codeMachine: "nouveauChamp",
      nomAffichage: "Nouveau champ",
      typeDonnees: "BOOLEAN",
    })
    expect(result).toBe("BOOLEEN")
  })

  it("recommends TYPE_TRANSACTION for typeTransaction", () => {
    const result = recommendFilterType({
      codeMachine: "typeTransaction",
      nomAffichage: "Type de transaction",
      typeDonnees: "TEXTE",
    })
    expect(result).toBe("TYPE_TRANSACTION")
  })

  it("recommends RECHERCHE_TEXTE for sousclasse_dominante", () => {
    const result = recommendFilterType({
      codeMachine: "sousclasse_dominante",
      nomAffichage: "Sous-classe dominante",
      typeDonnees: "TEXTE",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends RECHERCHE_TEXTE for entaille", () => {
    const result = recommendFilterType({
      codeMachine: "entaille",
      nomAffichage: "$/entaille",
      typeDonnees: "ENTIER",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends RECHERCHE_TEXTE for mls", () => {
    const result = recommendFilterType({
      codeMachine: "mls",
      nomAffichage: "# MLS",
      typeDonnees: "ENTIER",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends PLAGE_NUMERIQUE for superficie_cultive_ha", () => {
    const result = recommendFilterType({
      codeMachine: "superficie_cultive_ha",
      nomAffichage: "Superficie cultivée (ha)",
      typeDonnees: "DECIMAL",
    })
    expect(result).toBe("PLAGE_NUMERIQUE")
  })

  it("recommends PLAGE_DATE for a date field", () => {
    const result = recommendFilterType({
      codeMachine: "date_inspection",
      nomAffichage: "Date d'inspection",
      typeDonnees: "DATE",
    })
    expect(result).toBe("PLAGE_DATE")
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

describe("buildWhereClause", () => {
  it("maps a source LISTE filter to its TransactionSource column", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "LISTE", field: "mrc", operator: "in", value: "Drummond" },
    ]
    expect(buildWhereClause(filters)).toEqual({
      AND: [{ mrc: { in: ["Drummond"], mode: "insensitive" } }],
    })
  })

  it("narrows a source text search to its own column", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "RECHERCHE_TEXTE", field: "vendeur", operator: "contient", value: "Gagnon" },
    ]
    expect(buildWhereClause(filters)).toEqual({
      AND: [{ vendeur: { contains: "Gagnon", mode: "insensitive" } }],
    })
  })

  it("maps a source PLAGE_NUMERIQUE filter to its column", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "PLAGE_NUMERIQUE", field: "prix_vente", operator: "+", value: "100000" },
    ]
    expect(buildWhereClause(filters)).toEqual({ AND: [{ prixVente: { gte: 100000 } }] })
  })

  it("maps a source NUMERO_LOT filter to the lotsCadastraux array column", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "NUMERO_LOT", field: "lots_cadastraux", operator: "has", value: "123" },
    ]
    expect(buildWhereClause(filters)).toEqual({ AND: [{ lotsCadastraux: { has: "123" } }] })
  })

  it("keeps enrichment filters on the valeur_enrichissement relation", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "RECHERCHE_TEXTE", field: "topographie", operator: "contient", value: "plat" },
    ]
    expect(buildWhereClause(filters)).toEqual({
      AND: [
        {
          enrichie: {
            valeurs: {
              some: {
                champEnrichissable: { codeMachine: "topographie" },
                valeurTexte: { contains: "plat", mode: "insensitive" },
              },
            },
          },
        },
      ],
    })
  })
})

describe("moveItemToIndex", () => {
  const items = [
    { id: "a", ordreAffichage: 0 },
    { id: "b", ordreAffichage: 1 },
    { id: "c", ordreAffichage: 2 },
  ]

  it("appends at the end when the slot is the list length", () => {
    const result = moveItemToIndex(items, "a", 3)
    expect(result.map((i) => i.id)).toEqual(["b", "c", "a"])
    expect(result.map((i) => i.ordreAffichage)).toEqual([0, 1, 2])
  })

  it("moves an item to the top (slot 0)", () => {
    expect(moveItemToIndex(items, "c", 0).map((i) => i.id)).toEqual(["c", "a", "b"])
  })

  it("inserts before a middle item", () => {
    expect(moveItemToIndex(items, "c", 1).map((i) => i.id)).toEqual(["a", "c", "b"])
  })

  it("normalizes non-contiguous starting orders", () => {
    const spaced = [
      { id: "a", ordreAffichage: 10 },
      { id: "b", ordreAffichage: 20 },
      { id: "c", ordreAffichage: 30 },
    ]
    expect(moveItemToIndex(spaced, "c", 0).map((i) => i.ordreAffichage)).toEqual([0, 1, 2])
  })

  it("returns the list unchanged for an unknown id", () => {
    expect(moveItemToIndex(items, "x", 0)).toBe(items)
  })
})
