import { describe, it, expect } from "vitest"
import { computeAdjustedValues, computePrixActualise } from "@/lib/indicateurs-ajustes"
import type { SerializedTransaction } from "@/types/transaction"

function tx(fields: SerializedTransaction["fields"]): SerializedTransaction {
  return {
    id: "t1",
    statut: "ANALYSEE",
    fields,
    latitude: null,
    longitude: null,
    importationId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

const params = {
  tauxCroissancePct: 5,
  dateEvaluation: "2026-01-01",
}

describe("computePrixActualise", () => {
  it("capitalise le prix sur une année à 5 %", () => {
    const value = computePrixActualise(
      { prix_vente: 100000, date_vente: "2025-01-01T00:00:00.000Z" },
      { tauxCroissancePct: 5, dateEvaluation: "2026-01-01" }
    )
    expect(value).toBe(105000)
  })

  it("renvoie null quand le prix ou la date de vente manque", () => {
    expect(
      computePrixActualise({ date_vente: "2025-01-01T00:00:00.000Z" }, params)
    ).toBeNull()
    expect(computePrixActualise({ prix_vente: 100000 }, params)).toBeNull()
    expect(computePrixActualise({ prix_vente: 100000, date_vente: "invalide" }, params)).toBeNull()
  })
})

describe("computeAdjustedValues", () => {
  const fields = {
    prix_vente: 100000,
    date_vente: "2025-01-01T00:00:00.000Z",
    superficie_totale_hectare: 10,
    superficie_cultivee: 6,
    superficie_boisee: 4,
    superficie_batiment: 1000,
    nombre_entailles: 500,
    // Valeurs de référence : portées par la transaction, pas par un paramètre d'analyse.
    taux_boise_ref: 1000,
    taux_cultive_ref: 2000,
    valeur_batiments: 10000,
    valeur_maison: 5000,
    valeur_terrain_residentiel: 5000,
  }

  it("applique les formules des indicateurs ajustés", () => {
    const adjusted = computeAdjustedValues(fields, params)
    expect(adjusted.prix_actualise).toBe(105000)
    expect(adjusted.taux_global_ajuste).toBe(10500)
    expect(adjusted.taux_residuel_cultive_ajuste).toBe(
      Math.round((105000 - 4 * 1000 - 20000) / 6)
    )
    expect(adjusted.taux_residuel_boise_ajuste).toBe(
      Math.round((105000 - 6 * 2000 - 20000) / 4)
    )
    expect(adjusted.taux_residuel_batiment_ajuste).toBe(
      Math.round((105000 - 6 * 2000 - 4 * 1000 - 5000 - 5000) / 1000)
    )
    expect(adjusted.taux_par_entaille_ajuste).toBe(
      Math.round((105000 - 6 * 2000 - 4 * 1000 - 20000) / 500)
    )
  })

  it("laisse vides les indicateurs dont la surface manque ou est nulle", () => {
    const adjusted = computeAdjustedValues(
      { prix_vente: 100000, date_vente: "2025-01-01T00:00:00.000Z", superficie_cultivee: 0 },
      params
    )
    expect(adjusted.taux_global_ajuste).toBeNull()
    expect(adjusted.taux_residuel_cultive_ajuste).toBeNull()
    expect(adjusted.taux_residuel_boise_ajuste).toBeNull()
    expect(adjusted.taux_residuel_batiment_ajuste).toBeNull()
    expect(adjusted.taux_par_entaille_ajuste).toBeNull()
    expect(adjusted.prix_actualise).toBe(105000)
  })
})
