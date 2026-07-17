import { describe, it, expect } from "vitest"
import { cleanText, toKey } from "@/lib/normalization/mappings"
import {
  normalizeTopography,
  normalizeFeuillusResineux,
  normalizeZoneAgricoleCptaq,
  normalizeTypeCulture,
  normalizeTypeSol,
  normalizeDensitePlantation,
  discretizeProportion,
} from "@/lib/normalization/transforms"
import { createReport, incrementCounter } from "@/lib/normalization/report"

describe("cleanText", () => {
  it("trims, removes extra spaces, strips trailing punctuation, and removes accents", () => {
    expect(cleanText("  Plane,  ")).toBe("Plane")
    expect(cleanText("déclivité")).toBe("declivite")
    expect(cleanText(0)).toBeNull()
    expect(cleanText(null)).toBeNull()
  })
})

describe("toKey", () => {
  it("returns a lowercased cleaned key", () => {
    expect(toKey("  Plane  ")).toBe("plane")
    expect(toKey("Déclivité")).toBe("declivite")
  })
})

describe("normalizeTopography", () => {
  it("maps values to the closed list", () => {
    expect(normalizeTopography("plane").normalized).toBe("Plane")
    expect(normalizeTopography("legere declivite").normalized).toBe("Légère déclivité")
    expect(normalizeTopography("déclivité").normalized).toBe("Déclivité modérée")
    expect(normalizeTopography("forte pente").normalized).toBe("Forte déclivité")
  })
  it("flags combinations", () => {
    const result = normalizeTopography("Plane, déclivité dans le boisé")
    expect(result.hasCombination).toBe(true)
    expect(result.detail).toBe("Plane, declivite dans le boise")
  })
})

describe("normalizeFeuillusResineux", () => {
  it("uses proportion when available", () => {
    expect(normalizeFeuillusResineux("Feuillus", 0.3)).toBe("Résineux")
    expect(normalizeFeuillusResineux("Résineux", 0.5)).toBe("Mixte")
    expect(normalizeFeuillusResineux("Résineux", 0.7)).toBe("Feuillus")
  })
  it("maps abbreviations and dominance variants", () => {
    expect(normalizeFeuillusResineux("F", null)).toBe("Feuillus")
    expect(normalizeFeuillusResineux("Resineux", null)).toBe("Résineux")
    expect(normalizeFeuillusResineux("Mixte (dominance feuillus)", null)).toBe("Mixte")
  })
})

describe("normalizeZoneAgricoleCptaq", () => {
  it("extracts authorizations and normalizes yes/no/partial", () => {
    const result = normalizeZoneAgricoleCptaq("038376 Oui")
    expect(result.autorisations).toContain("038376")
    expect(result.zone).toBe("Oui")
  })
  it("maps partiel and variants to Partiel per updated audit", () => {
    expect(normalizeZoneAgricoleCptaq("partiel").zone).toBe("Partiel")
    expect(normalizeZoneAgricoleCptaq("0.5").zone).toBe("Partiel")
    expect(normalizeZoneAgricoleCptaq("en partie").zone).toBe("Partiel")
    expect(normalizeZoneAgricoleCptaq("non").zone).toBe("Non")
  })
})

describe("normalizeTypeCulture", () => {
  it("maps cultures to the simplified closed list", () => {
    expect(normalizeTypeCulture("Foin")).toBe("Prairie")
    expect(normalizeTypeCulture("Maïs / Soya")).toBe("Cultures annuelles")
    expect(normalizeTypeCulture("Vigne")).toBe("Vigne")
    expect(normalizeTypeCulture("Inconnu")).toBe("Autres")
  })
})

describe("normalizeTypeSol", () => {
  it("maps soil types to the closed list", () => {
    expect(normalizeTypeSol("Argile")).toBe("Argileux")
    expect(normalizeTypeSol("Loam sableux, limoneux")).toBe("Limoneux / Loam sableux")
  })
})

describe("normalizeDensitePlantation", () => {
  it("converts ranges to median and keeps single values", () => {
    expect(normalizeDensitePlantation("70-79%")).toBe(0.745)
    expect(normalizeDensitePlantation("0.75")).toBe(0.75)
  })
})

describe("discretizeProportion", () => {
  it("rounds to nearest 5%", () => {
    expect(discretizeProportion(0.37)).toBe(0.35)
    expect(discretizeProportion(0.42)).toBe(0.4)
    expect(discretizeProportion(0.65)).toBe(0.65)
  })
})

describe("report", () => {
  it("tracks changes per field and rule", () => {
    const report = createReport()
    incrementCounter(report, "topographie", "mapped_to_plane")
    incrementCounter(report, "topographie", "mapped_to_plane")
    incrementCounter(report, "feuillusrsineux", "abbreviation_expanded")
    expect(report.fieldChanges.topographie.mapped_to_plane).toBe(2)
    expect(report.fieldChanges.feuillusrsineux.abbreviation_expanded).toBe(1)
  })
})
