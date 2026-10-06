import { describe, it, expect } from "vitest"
import { z } from "zod"
import { deriveEstModifiable, formatChampInputErrors, normalizeChampInput, parseListOptions, validateChampConfig } from "@/lib/champs"
import type { ChampEnrichissableInput } from "@/types/champ"

function baseInput(overrides: Partial<ChampEnrichissableInput> = {}): ChampEnrichissableInput {
  return {
    codeMachine: "superficie_cultivee",
    nomAffichage: "Superficie cultivée",
    typeDonnees: "DECIMAL",
    nature: "SAISISSABLE",
    unite: "ha",
    plageMin: null,
    plageMax: null,
    optionsListe: null,
    regleCalcul: null,
    applicableATypes: ["TERRES_CULTIVEES"],
    ordreAffichage: 0,
    estAffiche: true,
    estObligatoire: false,
    ...overrides,
  }
}

describe("deriveEstModifiable", () => {
  it("is true for SAISISSABLE", () => {
    expect(deriveEstModifiable("SAISISSABLE")).toBe(true)
  })

  it("is false for CALCULE", () => {
    expect(deriveEstModifiable("CALCULE")).toBe(false)
  })
})

describe("normalizeChampInput", () => {
  it("forces unite to N/A for non-numeric types", () => {
    const result = normalizeChampInput(baseInput({ typeDonnees: "TEXTE", unite: "ha" }))
    expect(result.unite).toBe("N/A")
  })

  it("keeps unite for numeric types", () => {
    const result = normalizeChampInput(baseInput({ typeDonnees: "DECIMAL", unite: "ha" }))
    expect(result.unite).toBe("ha")
  })

  it("forces estObligatoire to false for CALCULE fields", () => {
    const result = normalizeChampInput(
      baseInput({ nature: "CALCULE", estObligatoire: true, regleCalcul: "prix_vente / superficie_totale_hectare" })
    )
    expect(result.estObligatoire).toBe(false)
  })

  it("trims a blank regleCalcul to null", () => {
    const result = normalizeChampInput(baseInput({ regleCalcul: "   " }))
    expect(result.regleCalcul).toBeNull()
  })
})

describe("parseListOptions", () => {
  it("splits one option per line and trims each", () => {
    expect(parseListOptions("  Terres cultivées \nTerres boisées\n  Érablières  ")).toEqual([
      "Terres cultivées",
      "Terres boisées",
      "Érablières",
    ])
  })

  it("ignores blank lines", () => {
    expect(parseListOptions("A\n\n  \nB\n")).toEqual(["A", "B"])
  })

  it("removes duplicates while keeping first-seen order", () => {
    expect(parseListOptions("B\nA\nB\nA")).toEqual(["B", "A"])
  })

  it("returns null when there is nothing to store", () => {
    expect(parseListOptions("")).toBeNull()
    expect(parseListOptions("   \n  \n")).toBeNull()
  })
})

describe("validateChampConfig", () => {
  const knownFieldCodes = new Set(["prix_vente", "superficie_totale_hectare", "superficie_cultivee"])

  it("accepts a well-formed saisissable field without a rule", () => {
    expect(validateChampConfig(baseInput(), knownFieldCodes)).toEqual([])
  })

  it("rejects a codeMachine that is not snake_case", () => {
    const errors = validateChampConfig(baseInput({ codeMachine: "SuperficieCultivee" }), knownFieldCodes)
    expect(errors.some((e) => e.field === "codeMachine")).toBe(true)
  })

  it("rejects an empty nomAffichage", () => {
    const errors = validateChampConfig(baseInput({ nomAffichage: "  " }), knownFieldCodes)
    expect(errors.some((e) => e.field === "nomAffichage")).toBe(true)
  })

  it("rejects a codeMachine that collides with a source field code", () => {
    const errors = validateChampConfig(baseInput({ codeMachine: "prix_vente" }), knownFieldCodes)
    expect(errors.some((e) => e.field === "codeMachine")).toBe(true)
  })

  it("rejects a plageMin greater than plageMax", () => {
    const errors = validateChampConfig(baseInput({ plageMin: 10, plageMax: 5 }), knownFieldCodes)
    expect(errors.some((e) => e.field === "plageMax")).toBe(true)
  })

  it("accepts a plageMin equal to plageMax", () => {
    expect(validateChampConfig(baseInput({ plageMin: 5, plageMax: 5 }), knownFieldCodes)).toEqual([])
  })

  it("requires optionsListe for a LISTE field", () => {
    const errors = validateChampConfig(
      baseInput({ typeDonnees: "LISTE", optionsListe: [] }),
      knownFieldCodes
    )
    expect(errors.some((e) => e.field === "optionsListe")).toBe(true)
  })

  it("accepts a LISTE field with options", () => {
    expect(
      validateChampConfig(baseInput({ typeDonnees: "LISTE", optionsListe: ["A", "B"] }), knownFieldCodes)
    ).toEqual([])
  })

  it("requires optionsListe for a MULTI_SELECT field too", () => {
    const errors = validateChampConfig(
      baseInput({ typeDonnees: "MULTI_SELECT", optionsListe: [] }),
      knownFieldCodes
    )
    expect(errors.some((e) => e.field === "optionsListe")).toBe(true)
    expect(
      validateChampConfig(baseInput({ typeDonnees: "MULTI_SELECT", optionsListe: ["A", "B"] }), knownFieldCodes)
    ).toEqual([])
  })

  it("requires unite for a numeric type", () => {
    const errors = validateChampConfig(baseInput({ unite: "N/A" }), knownFieldCodes)
    expect(errors.some((e) => e.field === "unite")).toBe(true)
  })

  it("requires regleCalcul for a CALCULE field", () => {
    const errors = validateChampConfig(baseInput({ nature: "CALCULE", regleCalcul: null }), knownFieldCodes)
    expect(errors.some((e) => e.field === "regleCalcul")).toBe(true)
  })

  it("rejects a regleCalcul referencing an unknown field", () => {
    const errors = validateChampConfig(
      baseInput({ nature: "CALCULE", regleCalcul: "prix_vente / superficie_inconnue" }),
      knownFieldCodes
    )
    expect(errors.some((e) => e.field === "regleCalcul")).toBe(true)
  })

  it("accepts an optional but valid regleCalcul on a SAISISSABLE field", () => {
    const errors = validateChampConfig(
      baseInput({ regleCalcul: "prix_vente / superficie_totale_hectare" }),
      knownFieldCodes
    )
    expect(errors).toEqual([])
  })

  it("requires at least one applicable type", () => {
    const errors = validateChampConfig(baseInput({ applicableATypes: [] }), knownFieldCodes)
    expect(errors.some((e) => e.field === "applicableATypes")).toBe(true)
  })
})

describe("formatChampInputErrors", () => {
  const schema = z.object({
    codeMachine: z.string().min(1),
    nomAffichage: z.string().min(1),
  })

  it("turns schema issues into readable French messages, not raw JSON", () => {
    const result = schema.safeParse({ codeMachine: "", nomAffichage: "" })
    if (result.success) throw new Error("expected validation to fail")

    const message = formatChampInputErrors(result.error)

    expect(message).toContain("Code machine")
    expect(message).toContain("Nom affiché")
    expect(message).not.toContain("too_small")
    expect(message).not.toContain("{")
  })

  it("produces one message per issue", () => {
    const result = schema.safeParse({ codeMachine: "", nomAffichage: "" })
    if (result.success) throw new Error("expected validation to fail")

    expect(formatChampInputErrors(result.error).match(/obligatoire/g)?.length).toBe(2)
  })
})
