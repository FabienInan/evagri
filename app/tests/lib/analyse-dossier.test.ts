import { describe, expect, it } from "vitest"
import { computeIndicateursAjustesByTransaction } from "@/lib/analyse-dossier"

const params = { dateEvaluation: "2026-01-01", tauxCroissancePct: 5 }

describe("computeIndicateursAjustesByTransaction", () => {
  it("calcule les indicateurs ajustés de chaque transaction à partir du dossier et du panier", () => {
    const rows = computeIndicateursAjustesByTransaction(params, [
      {
        id: "t1",
        fields: {
          prix_vente: 100000,
          date_vente: "2025-01-01T00:00:00.000Z",
          superficie_totale_hectare: 50,
        },
      },
    ])

    expect(rows.t1).toEqual(expect.objectContaining({ prix_actualise: 105000, taux_global_ajuste: 2100 }))
  })

  it("renvoie des valeurs nulles quand la transaction n'a pas de prix", () => {
    const rows = computeIndicateursAjustesByTransaction(params, [
      { id: "t2", fields: { superficie_totale_hectare: 50 } },
    ])
    expect(rows.t2.prix_actualise).toBeNull()
    expect(rows.t2.taux_global_ajuste).toBeNull()
  })

  it("lit les valeurs de référence sur la transaction, pas sur un paramètre d'analyse", () => {
    const base = { prix_vente: 100000, date_vente: "2025-01-01T00:00:00.000Z", superficie_totale_hectare: 50, superficie_cultivee: 6, superficie_boisee: 4 }
    const withRef = computeIndicateursAjustesByTransaction(params, [{ id: "t3", fields: { ...base, taux_boise_ref: 1000 } }])
    const without = computeIndicateursAjustesByTransaction(params, [{ id: "t3", fields: base }])
    expect(withRef.t3.taux_residuel_cultive_ajuste).not.toEqual(without.t3.taux_residuel_cultive_ajuste)
  })
})
