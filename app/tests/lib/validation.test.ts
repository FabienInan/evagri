import { describe, it, expect } from "vitest"
import { validateEnrichment, validateSaleDate } from "@/lib/validation"

describe("validateEnrichment", () => {
  it("detects V-001 when cultivee + boisee + constructible exceeds totale", () => {
    const errors = validateEnrichment({
      superficieTotaleHectare: 100,
      superficieCultivee: 60,
      superficieBoisee: 50,
    })
    expect(errors.some((e) => e.code === "V-001")).toBe(true)
  })

  it("passes V-001 when components fit within the total", () => {
    const errors = validateEnrichment({
      superficieTotaleHectare: 100,
      superficieCultivee: 40,
      superficieBoisee: 50,
      superficieConstructible: 10,
    })
    expect(errors.some((e) => e.code === "V-001")).toBe(false)
  })

  it("skips V-001 when the superficie totale is unknown", () => {
    const errors = validateEnrichment({ superficieCultivee: 40, superficieBoisee: 50 })
    expect(errors.some((e) => e.code === "V-001")).toBe(false)
  })

  it("leaves V-001 without a field, since it sums three champs", () => {
    const errors = validateEnrichment({
      superficieTotaleHectare: 10,
      superficieCultivee: 20,
    })
    expect(errors).toEqual([
      {
        code: "V-001",
        champ: null,
        message: "La somme des superficies (cultivée, boisée, constructible) dépasse la superficie totale.",
      },
    ])
  })

  it("detects V-002 when superficie drainee exceeds superficie cultivee", () => {
    const errors = validateEnrichment({ superficieCultivee: 50, superficieDrainee: 60 })
    expect(errors).toEqual([
      {
        code: "V-002",
        champ: null,
        message: "La superficie drainée ne peut pas dépasser la superficie cultivée.",
      },
    ])
  })

  it("attaches V-002 to the drainée champ when its code is known", () => {
    const errors = validateEnrichment({
      superficieCultivee: 50,
      superficieDrainee: 60,
      codes: { drainee: "superficie_draine_ha" },
    })
    expect(errors).toEqual([
      {
        code: "V-002",
        champ: "superficie_draine_ha",
        message: "La superficie drainée ne peut pas dépasser la superficie cultivée.",
      },
    ])
  })

  it("skips V-002 when superficie cultivee is unknown", () => {
    const errors = validateEnrichment({ superficieDrainee: 60 })
    expect(errors.some((e) => e.code === "V-002")).toBe(false)
  })

  it("detects V-003 for any percentage field above 100, naming the field", () => {
    const errors = validateEnrichment({ champsPourcentage: { taux_drainage: 110 } })
    expect(errors).toEqual([
      {
        code: "V-003",
        champ: "taux_drainage",
        message: "Le champ « taux_drainage » ne peut pas dépasser 100 %.",
      },
    ])
  })

  it("uses the nomAffichage when a label is provided", () => {
    const errors = validateEnrichment({
      valeursNumeriques: { superficie_draine_ha: -5 },
      labels: { superficie_draine_ha: "Superficie drainée (ha)" },
    })
    expect(errors).toEqual([
      {
        code: "V-006",
        champ: "superficie_draine_ha",
        message: "Le champ « Superficie drainée (ha) » ne peut pas être négatif.",
      },
    ])
  })

  it("detects V-005 when superficie acericole exceeds superficie boisee", () => {
    const errors = validateEnrichment({ superficieBoisee: 20, superficieAcericole: 25 })
    expect(errors.some((e) => e.code === "V-005")).toBe(true)
  })

  it("attaches V-005 to the acéricole champ when its code is known", () => {
    const errors = validateEnrichment({
      superficieBoisee: 20,
      superficieAcericole: 25,
      codes: { acericole: "superficie_acricole_ha" },
    })
    expect(errors).toEqual([
      {
        code: "V-005",
        champ: "superficie_acricole_ha",
        message: "La superficie acéricole ne peut pas dépasser la superficie boisée.",
      },
    ])
  })

  it("skips V-005 when superficie boisee is unknown", () => {
    const errors = validateEnrichment({ superficieAcericole: 25 })
    expect(errors.some((e) => e.code === "V-005")).toBe(false)
  })

  it("detects V-006 for negative numeric fields", () => {
    const errors = validateEnrichment({ valeursNumeriques: { nombre_entailles: -5 } })
    expect(errors).toEqual([
      {
        code: "V-006",
        champ: "nombre_entailles",
        message: "Le champ « nombre_entailles » ne peut pas être négatif.",
      },
    ])
  })

  it("detects V-007 below the configured minimum", () => {
    const errors = validateEnrichment({ plages: { taux_boise_ref: { min: 100, valeur: 50 } } })
    expect(errors).toEqual([
      {
        code: "V-007",
        champ: "taux_boise_ref",
        message: "Le champ « taux_boise_ref » doit être supérieur ou égal à 100.",
      },
    ])
  })

  it("detects V-007 above the configured maximum", () => {
    const errors = validateEnrichment({ plages: { taux_boise_ref: { max: 100, valeur: 150 } } })
    expect(errors).toEqual([
      {
        code: "V-007",
        champ: "taux_boise_ref",
        message: "Le champ « taux_boise_ref » doit être inférieur ou égal à 100.",
      },
    ])
  })

  it("phrases V-007 as a range when both bounds are configured", () => {
    const errors = validateEnrichment({ plages: { taux_boise_ref: { min: 100, max: 200, valeur: 250 } } })
    expect(errors).toEqual([
      {
        code: "V-007",
        champ: "taux_boise_ref",
        message: "Le champ « taux_boise_ref » doit être compris entre 100 et 200.",
      },
    ])
  })

  it("ignores plages without a value", () => {
    const errors = validateEnrichment({ plages: { taux_boise_ref: { min: 100, valeur: null } } })
    expect(errors).toEqual([])
  })

  it("returns no errors for a fully valid input", () => {
    const errors = validateEnrichment({
      superficieTotaleHectare: 100,
      superficieCultivee: 40,
      superficieBoisee: 40,
      superficieDrainee: 10,
      superficieAcericole: 5,
      champsPourcentage: { taux: 80 },
      valeursNumeriques: { prix: 100 },
      plages: { taux: { min: 0, max: 100, valeur: 50 } },
    })
    expect(errors).toEqual([])
  })
})

describe("validateSaleDate", () => {
  it("rejects a date in the future", () => {
    const future = new Date()
    future.setDate(future.getDate() + 1)
    const errors = validateSaleDate(future)
    expect(errors).toEqual([
      {
        code: "V-004",
        champ: null,
        message: "La date de vente ne peut pas être postérieure à aujourd'hui.",
      },
    ])
  })

  it("accepts today's date", () => {
    expect(validateSaleDate(new Date())).toEqual([])
  })

  it("accepts a past date", () => {
    expect(validateSaleDate(new Date("2020-01-01"))).toEqual([])
  })
})
