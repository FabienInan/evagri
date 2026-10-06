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
  normalizeEnrichmentText,
} from "@/lib/normalization/transforms"
import { createReport, incrementCounter } from "@/lib/normalization/report"
import { buildCodeMachine, parseBooleanish, parseFrenchNumber, splitNameUnit } from "@/lib/normalization/parsing"

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

describe("normalizeEnrichmentText", () => {
  it("canonicalizes the cptaq zone answers to Oui / Non / Partiel", () => {
    expect(normalizeEnrichmentText("cptaq", "oui")).toBe("Oui")
    expect(normalizeEnrichmentText("cptaq", "Oui")).toBe("Oui")
    expect(normalizeEnrichmentText("cptaq", "non")).toBe("Non")
    expect(normalizeEnrichmentText("cptaq", "Non")).toBe("Non")
    expect(normalizeEnrichmentText("cptaq", "Partiel")).toBe("Partiel")
    expect(normalizeEnrichmentText("cptaq", "en partie")).toBe("Partiel")
  })

  it("leaves other fields and unrecognized values untouched", () => {
    expect(normalizeEnrichmentText("observations", "Texte libre")).toBe("Texte libre")
    expect(normalizeEnrichmentText("cptaq", "valeur inconnue")).toBe("valeur inconnue")
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

describe("parseBooleanish", () => {
  it("does not coerce a stored 'Non'/'false'/'0' to true", () => {
    expect(parseBooleanish("Non")).toBe(false)
    expect(parseBooleanish("false")).toBe(false)
    expect(parseBooleanish("0")).toBe(false)
    expect(parseBooleanish("Aucune")).toBe(false)
  })

  it("accepts affirmatives and passes real booleans/numbers through", () => {
    expect(parseBooleanish(true)).toBe(true)
    expect(parseBooleanish(1)).toBe(true)
    expect(parseBooleanish("Oui")).toBe(true)
    expect(parseBooleanish(0)).toBe(false)
  })

  it("treats an unrecognized non-empty remark as true and empty as false", () => {
    expect(parseBooleanish("pente marquée")).toBe(true)
    expect(parseBooleanish("")).toBe(false)
    expect(parseBooleanish(null)).toBe(false)
  })
})

describe("parseFrenchNumber", () => {
  it("handles decimal comma, thousands separators and symbols", () => {
    expect(parseFrenchNumber("1 234,50")).toBe(1234.5)
    expect(parseFrenchNumber("1,234.56")).toBe(1234.56)
    expect(parseFrenchNumber("12,5 %")).toBe(12.5)
    expect(parseFrenchNumber("1\u202f234,5")).toBe(1234.5)
  })

  it("returns null when the value is not numeric", () => {
    expect(parseFrenchNumber("abc")).toBeNull()
    expect(parseFrenchNumber("")).toBeNull()
    expect(parseFrenchNumber(null)).toBeNull()
  })

  it("passes a real number through", () => {
    expect(parseFrenchNumber(42)).toBe(42)
  })
})

describe("buildCodeMachine", () => {
  it("drops accents (not transliterates) and collapses separators", () => {
    expect(buildCodeMachine("Superficie cultivée (ha)")).toBe("superficie_cultive_ha")
    expect(buildCodeMachine("  Hauteur  ")).toBe("hauteur")
  })

  it("prefixes champ_ when the code does not start with a letter", () => {
    expect(buildCodeMachine("12 abc")).toBe("champ_12_abc")
  })

  it("returns an empty string when nothing usable remains", () => {
    expect(buildCodeMachine("###")).toBe("")
  })
})

describe("splitNameUnit", () => {
  it("moves a recognized trailing unit out of the name", () => {
    expect(splitNameUnit("Superficie cultivée (ha)", "N/A")).toEqual({
      nom: "Superficie cultivée",
      unite: "ha",
    })
    expect(splitNameUnit("Prix de vente redressé au temps ($)", "N/A")).toEqual({
      nom: "Prix de vente redressé au temps",
      unite: "$",
    })
    expect(splitNameUnit("Superficie terrain résidentiel (m²)", "N/A").unite).toBe("m²")
  })

  it("de-duplicates a name that already repeats its stored unit", () => {
    expect(splitNameUnit("Taux unitaire global ($/ha)", "$/ha")).toEqual({
      nom: "Taux unitaire global",
      unite: "$/ha",
    })
  })

  it("keeps a stored unit even when the name carries no unit", () => {
    expect(splitNameUnit("Taux global", "$/ha")).toEqual({ nom: "Taux global", unite: "$/ha" })
  })

  it("leaves non-unit parentheses and unit-only names untouched", () => {
    expect(splitNameUnit("Maison(s)", "N/A")).toEqual({ nom: "Maison(s)", unite: "N/A" })
    expect(splitNameUnit("Zone agricole (CPTAQ)", "N/A")).toEqual({
      nom: "Zone agricole (CPTAQ)",
      unite: "N/A",
    })
    expect(splitNameUnit("Topographie (combiné brute)", "N/A")).toEqual({
      nom: "Topographie (combiné brute)",
      unite: "N/A",
    })
    expect(splitNameUnit("(ha)", "N/A")).toEqual({ nom: "(ha)", unite: "N/A" })
  })
})
