import { describe, it, expect } from "vitest"
import {
  NUMERO_DOSSIER_REGEX,
  createDossierSchema,
  createPanierSchema,
  addTransactionsSchema,
} from "@/validators/dossier.validator"

describe("NUMERO_DOSSIER_REGEX", () => {
  it("accepte le format AA-RR-DDD", () => {
    expect(NUMERO_DOSSIER_REGEX.test("25-AB-001")).toBe(true)
  })

  it("refuse les formats invalides", () => {
    for (const bad of ["25-ab-001", "5-AB-001", "25-ABC-001", "25-AB-01", "", "25AB001"]) {
      expect(NUMERO_DOSSIER_REGEX.test(bad)).toBe(false)
    }
  })
})

describe("createDossierSchema", () => {
  it("accepte un numéro valide, nom optionnel", () => {
    expect(createDossierSchema.safeParse({ numeroDossier: "25-AB-001" }).success).toBe(true)
    expect(createDossierSchema.safeParse({ numeroDossier: "25-AB-001", nom: "Essai" }).success).toBe(true)
  })

  it("normalise les espaces autour du numéro (trim)", () => {
    const result = createDossierSchema.safeParse({ numeroDossier: "  25-AB-001 " })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.numeroDossier).toBe("25-AB-001")
  })

  it("refuse un numéro mal formé", () => {
    expect(createDossierSchema.safeParse({ numeroDossier: "25-ab-1" }).success).toBe(false)
  })
})

describe("createPanierSchema", () => {
  it("exige un nom non vide", () => {
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "  " }).success).toBe(false)
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "Panier" }).success).toBe(true)
  })

  it("accepte un typeTransactionId null ou absent", () => {
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P", typeTransactionId: null }).success).toBe(true)
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P" }).success).toBe(true)
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
