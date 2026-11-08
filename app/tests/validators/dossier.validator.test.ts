import { describe, it, expect } from "vitest"
import {
  NUMERO_DOSSIER_REGEX,
  createDossierSchema,
  createPanierSchema,
  addTransactionsSchema,
} from "@/validators/dossier.validator"

describe("NUMERO_DOSSIER_REGEX", () => {
  it("accepte le format AA-AA-AAA en chiffres", () => {
    expect(NUMERO_DOSSIER_REGEX.test("25-12-001")).toBe(true)
  })

  it("refuse les formats invalides", () => {
    for (const bad of ["25-AB-001", "25-ab-001", "5-12-001", "25-123-001", "25-12-01", "", "2512001"]) {
      expect(NUMERO_DOSSIER_REGEX.test(bad)).toBe(false)
    }
  })
})

describe("createDossierSchema", () => {
  it("accepte un numéro valide, nom optionnel, avec la date d'évaluation", () => {
    expect(createDossierSchema.safeParse({ numeroDossier: "25-12-001", dateEvaluation: "2026-01-01" }).success).toBe(true)
    expect(
      createDossierSchema.safeParse({ numeroDossier: "25-12-001", nom: "Essai", dateEvaluation: "2026-01-01" }).success
    ).toBe(true)
  })

  it("exige la date d'évaluation", () => {
    expect(createDossierSchema.safeParse({ numeroDossier: "25-12-001" }).success).toBe(false)
    expect(createDossierSchema.safeParse({ numeroDossier: "25-12-001", dateEvaluation: "" }).success).toBe(false)
  })

  it("normalise les espaces autour du numéro (trim)", () => {
    const result = createDossierSchema.safeParse({ numeroDossier: "  25-12-001 ", dateEvaluation: "2026-01-01" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.numeroDossier).toBe("25-12-001")
  })

  it("refuse un numéro mal formé", () => {
    expect(createDossierSchema.safeParse({ numeroDossier: "25-ab-1", dateEvaluation: "2026-01-01" }).success).toBe(false)
  })
})

describe("createPanierSchema", () => {
  it("exige un nom non vide", () => {
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "  ", tauxCroissancePct: 3 }).success).toBe(false)
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "Panier", tauxCroissancePct: 3 }).success).toBe(true)
  })

  it("accepte un typeTransactionId null ou absent", () => {
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P", typeTransactionId: null, tauxCroissancePct: 3 }).success).toBe(true)
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P", tauxCroissancePct: 3 }).success).toBe(true)
  })

  it("exige un taux de croissance entre 0 et 100 %", () => {
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P" }).success).toBe(false)
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P", tauxCroissancePct: Number.NaN }).success).toBe(false)
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P", tauxCroissancePct: -1 }).success).toBe(false)
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P", tauxCroissancePct: 101 }).success).toBe(false)
  })
})

describe("addTransactionsSchema", () => {
  it("refuse une sélection vide", () => {
    expect(addTransactionsSchema.safeParse({ panierId: "p1", transactionIds: [] }).success).toBe(false)
  })

  it("accepte au moins une transaction", () => {
    expect(addTransactionsSchema.safeParse({ panierId: "p1", transactionIds: ["t1"] }).success).toBe(true)
  })
})
