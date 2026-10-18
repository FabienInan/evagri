import { describe, it, expect } from "vitest"
import {
  buildTransactionDetailQuery,
  parseFiltersParam,
  stringifyFilters,
} from "@/lib/transaction-filters"
import type { FilterInput } from "@/types/filter"

const filters: FilterInput[] = [
  { id: "statut", typeFiltre: "STATUT", field: "statut", operator: "=", value: "ANALYSEE" },
]

describe("paramètres de filtres de la liste", () => {
  it("fait l'aller-retour entre l'état et le paramètre d'URL", () => {
    expect(parseFiltersParam(stringifyFilters(filters))).toEqual(filters)
  })

  it("tolère un paramètre absent ou illisible", () => {
    expect(parseFiltersParam(null)).toEqual([])
    expect(parseFiltersParam("pas-du-json")).toEqual([])
    expect(parseFiltersParam(JSON.stringify({ not: "an array" }))).toEqual([])
  })

  it("ne construit un contexte de fiche qu'avec des filtres actifs", () => {
    expect(buildTransactionDetailQuery({ filters: [], sortField: "date_vente", sortOrder: "desc" })).toBe("")
  })

  it("transmet les filtres, le tri et l'ordre aux liens vers la fiche", () => {
    expect(
      buildTransactionDetailQuery({ filters, sortField: "prix_vente", sortOrder: "asc" })
    ).toBe(`?filters=${stringifyFilters(filters)}&sort=prix_vente&order=asc`)
  })
})
