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
    expect(createDossierSchema.safeParse({ numeroDossier: "25-12-001", dateEvaluation: "2026-01-01", lotsCadastraux: ["4 128 182"] }).success).toBe(true)
    expect(
      createDossierSchema.safeParse({ numeroDossier: "25-12-001", nom: "Essai", dateEvaluation: "2026-01-01", lotsCadastraux: ["4 128 182"] }).success
    ).toBe(true)
  })

  it("exige la date d'évaluation", () => {
    expect(createDossierSchema.safeParse({ numeroDossier: "25-12-001" }).success).toBe(false)
    expect(createDossierSchema.safeParse({ numeroDossier: "25-12-001", dateEvaluation: "" }).success).toBe(false)
  })

  it("normalise les espaces autour du numéro (trim)", () => {
    const result = createDossierSchema.safeParse({ numeroDossier: "  25-12-001 ", dateEvaluation: "2026-01-01", lotsCadastraux: ["4 128 182"] })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.numeroDossier).toBe("25-12-001")
  })

  it("accepte plusieurs lots", () => {
    expect(
      createDossierSchema.safeParse({
        numeroDossier: "25-12-001",
        dateEvaluation: "2026-01-01",
        lotsCadastraux: ["4 128 182", "4 128 183"],
      }).success
    ).toBe(true)
  })

  it("refuse un dossier sans lot", () => {
    expect(
      createDossierSchema.safeParse({ numeroDossier: "25-12-001", dateEvaluation: "2026-01-01", lotsCadastraux: [] })
        .success
    ).toBe(false)
  })

  it("refuse un lot avec des lettres", () => {
    expect(
      createDossierSchema.safeParse({ numeroDossier: "25-12-001", dateEvaluation: "2026-01-01", lotsCadastraux: ["A12"] })
        .success
    ).toBe(false)
  })

  it("exige latitude et longitude ensemble", () => {
    const base = { numeroDossier: "25-12-001", dateEvaluation: "2026-01-01", lotsCadastraux: ["4 128 182"] }
    expect(createDossierSchema.safeParse({ ...base, latitude: 46.8 }).success).toBe(false)
    expect(createDossierSchema.safeParse({ ...base, latitude: 46.8, longitude: -71.2 }).success).toBe(true)
  })

  it("refuse une latitude hors limites", () => {
    const base = { numeroDossier: "25-12-001", dateEvaluation: "2026-01-01", lotsCadastraux: ["4 128 182"] }
    expect(createDossierSchema.safeParse({ ...base, latitude: 120, longitude: -71.2 }).success).toBe(false)
  })

  it("refuse un numéro mal formé", () => {
    expect(createDossierSchema.safeParse({ numeroDossier: "25-ab-1", dateEvaluation: "2026-01-01", lotsCadastraux: ["4 128 182"] }).success).toBe(false)
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
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P", tauxCroissancePct: 3.25 }).success).toBe(true)
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

describe("format des lots (identique à l'import)", () => {
  const base = { numeroDossier: "25-12-001", dateEvaluation: "2026-01-01" }

  it("normalise les lots en groupes de trois chiffres", () => {
    const r = createDossierSchema.safeParse({ ...base, lotsCadastraux: ["4128182", " 4 128 183 "] })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.lotsCadastraux).toEqual(["4 128 182", "4 128 183"])
  })

  it("supprime les doublons", () => {
    const r = createDossierSchema.safeParse({ ...base, lotsCadastraux: ["4 128 182", "4128182"] })
    expect(r.success).toBe(true)
    if (r.success) expect(r.data.lotsCadastraux).toEqual(["4 128 182"])
  })

  it("refuse les lettres, tirets et points", () => {
    for (const bad of ["4-128-182", "4.128", "A12", "12B"]) {
      expect(createDossierSchema.safeParse({ ...base, lotsCadastraux: [bad] }).success).toBe(false)
    }
  })

  it("refuse plus de 5 lots", () => {
    const lots = ["1", "2", "3", "4", "5", "6"]
    expect(createDossierSchema.safeParse({ ...base, lotsCadastraux: lots }).success).toBe(false)
  })
})

describe("coordonnées saisies à la main", () => {
  const base = { numeroDossier: "25-12-001", dateEvaluation: "2026-01-01", lotsCadastraux: ["4 128 182"] }

  it("accepte des coordonnées au Québec", () => {
    expect(createDossierSchema.safeParse({ ...base, latitude: 45.5, longitude: -73.6 }).success).toBe(true)
    expect(createDossierSchema.safeParse({ ...base, latitude: 52, longitude: -70 }).success).toBe(true)
  })

  it("refuse des coordonnées hors Québec (Ontario, États-Unis, Atlantique)", () => {
    expect(createDossierSchema.safeParse({ ...base, latitude: 43.7, longitude: -79.4 }).success).toBe(false)
    expect(createDossierSchema.safeParse({ ...base, latitude: 40.7, longitude: -74 }).success).toBe(false)
    expect(createDossierSchema.safeParse({ ...base, latitude: 46, longitude: -50 }).success).toBe(false)
  })
})
