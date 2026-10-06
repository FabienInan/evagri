import { describe, it, expect } from "vitest"
import {
  recommendFilterType,
  recommendedTypeForField,
  DEFAULT_OPERATEURS,
  buildWhereClause,
  moveItemToIndex,
  orderRenteTransactions,
} from "@/lib/filters"
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

describe("recommendedTypeForField", () => {
  it("uses the source catalogue recommendation for a source code", () => {
    expect(recommendedTypeForField({ codeMachine: "mrc" })).toBe("LISTE")
    expect(recommendedTypeForField({ codeMachine: "prix_vente" })).toBe("PLAGE_NUMERIQUE")
    expect(recommendedTypeForField({ codeMachine: "lots_cadastraux" })).toBe("NUMERO_LOT")
  })

  it("prefers the source code over an enrichment champ when both are present", () => {
    const result = recommendedTypeForField({
      codeMachine: "mrc",
      champEnrichissable: { codeMachine: "topographie", nomAffichage: "Topographie", typeDonnees: "TEXTE" },
    })
    expect(result).toBe("LISTE")
  })

  it("recomputes the enrichment recommendation for an enrichment champ", () => {
    const result = recommendedTypeForField({
      champEnrichissable: { codeMachine: "topographie", nomAffichage: "Topographie", typeDonnees: "TEXTE" },
    })
    expect(result).toBe("LISTE")
  })

  it("returns null for a virtual filter or an unknown target", () => {
    expect(recommendedTypeForField({ codeMachine: "statut" })).toBeNull()
    expect(recommendedTypeForField({})).toBeNull()
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
      "REVENTE",
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

  it("produces no clause for a REVENTE filter, which the caller applies after a duplicate-lot lookup", () => {
    const filters: FilterInput[] = [
      { id: "revente", typeFiltre: "REVENTE", field: "revente", operator: "=", value: "true" },
    ]
    expect(buildWhereClause(filters)).toEqual({})
  })

  it("keeps other filters while ignoring a REVENTE filter", () => {
    const filters: FilterInput[] = [
      { id: "revente", typeFiltre: "REVENTE", field: "revente", operator: "=", value: "true" },
      { id: "f1", typeFiltre: "LISTE", field: "mrc", operator: "in", value: "Drummond" },
    ]
    expect(buildWhereClause(filters)).toEqual({
      AND: [{ mrc: { in: ["Drummond"], mode: "insensitive" } }],
    })
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

  it("matches a boolean enrichment for a true BOOLEEN filter, whether stored as boolean or as 'oui' text", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "BOOLEEN", field: "cptaq", operator: "=", value: "true" },
    ]
    expect(buildWhereClause(filters)).toEqual({
      AND: [
        {
          enrichie: {
            valeurs: {
              some: {
                champEnrichissable: { codeMachine: "cptaq" },
                OR: [
                  { valeurBooleen: true },
                  { valeurTexte: { in: ["true", "1", "oui", "yes", "vrai", "o", "y"], mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    })
  })

  it("matches 'non'-like text for a false BOOLEEN filter", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "BOOLEEN", field: "cptaq", operator: "=", value: "false" },
    ]
    expect(buildWhereClause(filters)).toEqual({
      AND: [
        {
          enrichie: {
            valeurs: {
              some: {
                champEnrichissable: { codeMachine: "cptaq" },
                OR: [
                  { valeurBooleen: false },
                  { valeurTexte: { in: ["false", "0", "non", "no", "faux", "n", "aucune", "aucun"], mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ],
    })
  })
})

describe("orderRenteTransactions", () => {
  const tx = (id: string, lots: string[]) => ({ id, lotsCadastraux: lots })

  it("makes rows sharing a duplicated lot consecutive, keeping each group's internal order", () => {
    const input = [tx("a", ["L1"]), tx("b", ["L2"]), tx("c", ["L1"]), tx("d", ["L2"])]
    const result = orderRenteTransactions(input, new Set(["L1", "L2"]))
    expect(result.map((t) => t.id)).toEqual(["a", "c", "b", "d"])
  })

  it("keeps a chain of transactions linked by two different resold lots together", () => {
    const input = [tx("a", ["L1"]), tx("x", ["Z"]), tx("c", ["L2"]), tx("b", ["L1", "L2"])]
    const result = orderRenteTransactions(input, new Set(["L1", "L2"]))
    const ids = result.map((t) => t.id)
    expect(ids.slice(0, 3).sort()).toEqual(["a", "b", "c"])
    expect(ids[3]).toBe("x")
  })

  it("does not group rows that only share a lot which was never resold", () => {
    const input = [tx("a", ["K"]), tx("b", ["K"])]
    expect(orderRenteTransactions(input, new Set()).map((t) => t.id)).toEqual(["a", "b"])
  })

  it("keeps a transaction on a single row (never duplicates it across groups)", () => {
    const input = [tx("a", ["L1", "L2"]), tx("b", ["L1"]), tx("c", ["L2"])]
    const result = orderRenteTransactions(input, new Set(["L1", "L2"]))
    expect(result).toHaveLength(3)
  })

  it("returns the input unchanged when there is nothing to order", () => {
    const input: ReturnType<typeof tx>[] = []
    expect(orderRenteTransactions(input, new Set(["L1"]))).toBe(input)
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
