import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  deriveEstLectureSeule,
  formatChampInputErrors,
  normalizeChampInput,
  parseListOptions,
  validateChampConfig,
} from "@/lib/champs"
import type { ChampEnrichissableInput } from "@/types/champ"

const base: ChampEnrichissableInput = {
  codeMachine: "nouveau",
  nomAffichage: "Nouveau",
  typeDonnees: "TEXTE",
  nature: "SAISISSABLE",
  unite: "N/A",
  plageMin: null,
  plageMax: null,
  optionsListe: null,
  regleCalcul: null,
  applicableATypes: ["TERRES_CULTIVEES"],
  ordreAffichage: 0,
  estAffiche: true,
  estObligatoire: false,
}

describe("deriveEstLectureSeule", () => {
  it("is true for IMPORTE and CALCULE, false for SAISISSABLE", () => {
    expect(deriveEstLectureSeule("IMPORTE")).toBe(true)
    expect(deriveEstLectureSeule("CALCULE")).toBe(true)
    expect(deriveEstLectureSeule("SAISISSABLE")).toBe(false)
  })
})

describe("normalizeChampInput", () => {
  it("forces unite to N/A for a non-numeric type", () => {
    expect(normalizeChampInput({ ...base, typeDonnees: "TEXTE", unite: "ha" }).unite).toBe("N/A")
  })

  it("keeps unite for a numeric type", () => {
    expect(normalizeChampInput({ ...base, typeDonnees: "DECIMAL", unite: "ha" }).unite).toBe("ha")
  })

  it("forces estObligatoire off for a non-SAISISSABLE nature", () => {
    expect(normalizeChampInput({ ...base, nature: "CALCULE", estObligatoire: true, regleCalcul: "a + b" }).estObligatoire).toBe(false)
  })

  it("trims a blank regleCalcul to null", () => {
    expect(normalizeChampInput({ ...base, regleCalcul: "   " }).regleCalcul).toBeNull()
  })

  it("trims a non-blank regleCalcul", () => {
    expect(normalizeChampInput({ ...base, regleCalcul: "  prix_vente  " }).regleCalcul).toBe("prix_vente")
  })
})

describe("validateChampConfig", () => {
  const knownFieldCodes = new Set(["prix_vente", "superficie_totale_hectare"])

  it("accepts a valid saisissable champ", () => {
    expect(validateChampConfig(base, knownFieldCodes)).toEqual([])
  })

  it("rejects a code that is in knownFieldCodes without being a source field code", () => {
    const errors = validateChampConfig({ ...base, codeMachine: "code_importe" }, new Set(["code_importe"]))
    expect(errors.some((e) => e.field === "codeMachine")).toBe(true)
  })

  it("rejects a codeMachine that is not snake_case", () => {
    const errors = validateChampConfig({ ...base, codeMachine: "Bad Code" }, knownFieldCodes)
    expect(errors.some((e) => e.field === "codeMachine")).toBe(true)
  })

  it("rejects an empty nomAffichage", () => {
    const errors = validateChampConfig({ ...base, nomAffichage: "  " }, knownFieldCodes)
    expect(errors.some((e) => e.field === "nomAffichage")).toBe(true)
  })

  it("rejects a plageMin greater than plageMax", () => {
    const errors = validateChampConfig({ ...base, plageMin: 10, plageMax: 5 }, knownFieldCodes)
    expect(errors.some((e) => e.field === "plageMax")).toBe(true)
  })

  it("accepts a plageMin equal to plageMax", () => {
    expect(validateChampConfig({ ...base, plageMin: 5, plageMax: 5 }, knownFieldCodes)).toEqual([])
  })

  it("requires optionsListe for a LISTE field", () => {
    const errors = validateChampConfig({ ...base, typeDonnees: "LISTE", optionsListe: [] }, knownFieldCodes)
    expect(errors.some((e) => e.field === "optionsListe")).toBe(true)
  })

  it("accepts a LISTE field with options", () => {
    expect(
      validateChampConfig({ ...base, typeDonnees: "LISTE", optionsListe: ["A", "B"] }, knownFieldCodes)
    ).toEqual([])
  })

  it("requires optionsListe for a MULTI_SELECT field too", () => {
    const errors = validateChampConfig({ ...base, typeDonnees: "MULTI_SELECT", optionsListe: [] }, knownFieldCodes)
    expect(errors.some((e) => e.field === "optionsListe")).toBe(true)
    expect(
      validateChampConfig({ ...base, typeDonnees: "MULTI_SELECT", optionsListe: ["A", "B"] }, knownFieldCodes)
    ).toEqual([])
  })

  it("requires unite for a numeric type", () => {
    for (const typeDonnees of ["DECIMAL", "ENTIER"] as const) {
      const errors = validateChampConfig({ ...base, typeDonnees, unite: "N/A" }, knownFieldCodes)
      expect(errors.some((e) => e.field === "unite")).toBe(true)
    }
  })

  it("requires regleCalcul for a CALCULE field", () => {
    const errors = validateChampConfig({ ...base, nature: "CALCULE", regleCalcul: null }, knownFieldCodes)
    expect(errors.some((e) => e.field === "regleCalcul")).toBe(true)
  })

  it("rejects a regleCalcul referencing an unknown field", () => {
    const errors = validateChampConfig(
      { ...base, nature: "CALCULE", regleCalcul: "prix_vente / superficie_inconnue" },
      knownFieldCodes
    )
    expect(errors.some((e) => e.field === "regleCalcul")).toBe(true)
  })

  it("accepts a valid regleCalcul on a SAISISSABLE field", () => {
    expect(
      validateChampConfig({ ...base, regleCalcul: "prix_vente / superficie_totale_hectare" }, knownFieldCodes)
    ).toEqual([])
  })

  it("rejects a regle_calcul on an IMPORTE champ", () => {
    const errors = validateChampConfig(
      { ...base, nature: "IMPORTE", regleCalcul: "prix_vente" },
      new Set(["prix_vente"])
    )
    expect(
      errors.some(
        (e) => e.field === "regleCalcul" && e.message === "Un champ importé ne peut pas porter de règle de calcul."
      )
    ).toBe(true)
  })

  it("requires at least one applicable type", () => {
    const errors = validateChampConfig({ ...base, applicableATypes: [] }, knownFieldCodes)
    expect(errors.some((e) => e.field === "applicableATypes")).toBe(true)
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
