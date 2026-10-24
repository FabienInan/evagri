import { describe, expect, it } from "vitest"
import { computeIndicateursAjustesByTransaction, toExportParams, type AnalyseParams } from "@/lib/analyse-dossier"

const analyse: AnalyseParams = {
  dateEvaluation: "2026-01-01",
  tauxCroissancePct: 5,
  tauxBoiseRef: null,
  tauxCultiveRef: null,
  valeurBatimentRef: null,
  valeurMaisonRef: null,
  valeurTerrainResidentielRef: null,
}

describe("computeIndicateursAjustesByTransaction", () => {
  it("calcule les indicateurs ajustés de chaque transaction du dossier", () => {
    const rows = computeIndicateursAjustesByTransaction(analyse, [
      {
        id: "t1",
        fields: {
          prix_vente: 100000,
          date_vente: "2025-01-01T00:00:00.000Z",
          superficie_totale_hectare: 50,
        },
      },
    ])

    expect(rows).toEqual([
      {
        transactionId: "t1",
        values: expect.objectContaining({
          prix_actualise: 105000,
          taux_global_ajuste: 2100,
        }),
      },
    ])
  })

  it("renvoie des valeurs nulles quand la transaction n'a pas de prix", () => {
    const [row] = computeIndicateursAjustesByTransaction(analyse, [
      { id: "t2", fields: { superficie_totale_hectare: 50 } },
    ])
    expect(row.values.prix_actualise).toBeNull()
    expect(row.values.taux_global_ajuste).toBeNull()
  })
})

describe("toExportParams", () => {
  it("transmet les valeurs de référence absentes comme non renseignées", () => {
    expect(toExportParams({ ...analyse, tauxBoiseRef: 1000 })).toEqual({
      tauxCroissancePct: 5,
      dateEvaluation: "2026-01-01",
      tauxBoiseRef: 1000,
      tauxCultiveRef: undefined,
      valeurBatiment: undefined,
      valeurMaison: undefined,
      valeurTerrainResidentiel: undefined,
    })
  })
})
