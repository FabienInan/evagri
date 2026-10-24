import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  deriveEstLectureSeule,
  formatChampInputErrors,
  formsRuleCycle,
  normalizeChampInput,
  parseListOptions,
  validateChampConfig,
} from "@/lib/champs"
import type { ChampEnrichissableInput, TypeDonneesChamp } from "@/types/champ"

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

const knownFields = new Map<string, TypeDonneesChamp>([
  ["prix_vente", "DECIMAL"],
  ["superficie_totale_hectare", "DECIMAL"],
  ["typeTransaction", "TEXTE"],
])
const noRules = new Map<string, string>()

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
  it("accepts a valid saisissable champ", () => {
    expect(validateChampConfig(base, knownFields, noRules)).toEqual([])
  })

  it("rejects a code that is already used by another champ or an imported field", () => {
    const errors = validateChampConfig({ ...base, codeMachine: "prix_vente" }, knownFields, noRules)
    expect(errors.some((e) => e.field === "codeMachine")).toBe(true)
  })

  it("rejects a codeMachine that is not snake_case", () => {
    const errors = validateChampConfig({ ...base, codeMachine: "Bad Code" }, knownFields, noRules)
    expect(errors.some((e) => e.field === "codeMachine")).toBe(true)
  })

  it("rejects an empty nomAffichage", () => {
    const errors = validateChampConfig({ ...base, nomAffichage: "  " }, knownFields, noRules)
    expect(errors.some((e) => e.field === "nomAffichage")).toBe(true)
  })

  it("rejects a plageMin greater than plageMax", () => {
    const errors = validateChampConfig({ ...base, plageMin: 10, plageMax: 5 }, knownFields, noRules)
    expect(errors.some((e) => e.field === "plageMax")).toBe(true)
  })

  it("accepts a plageMin equal to plageMax", () => {
    expect(validateChampConfig({ ...base, plageMin: 5, plageMax: 5 }, knownFields, noRules)).toEqual([])
  })

  it("requires optionsListe for a LISTE field", () => {
    const errors = validateChampConfig({ ...base, typeDonnees: "LISTE", optionsListe: [] }, knownFields, noRules)
    expect(errors.some((e) => e.field === "optionsListe")).toBe(true)
  })

  it("accepts a LISTE field with options", () => {
    expect(
      validateChampConfig({ ...base, typeDonnees: "LISTE", optionsListe: ["A", "B"] }, knownFields, noRules)
    ).toEqual([])
  })

  it("requires optionsListe for a MULTI_SELECT field too", () => {
    const errors = validateChampConfig({ ...base, typeDonnees: "MULTI_SELECT", optionsListe: [] }, knownFields, noRules)
    expect(errors.some((e) => e.field === "optionsListe")).toBe(true)
    expect(
      validateChampConfig({ ...base, typeDonnees: "MULTI_SELECT", optionsListe: ["A", "B"] }, knownFields, noRules)
    ).toEqual([])
  })

  it("requires unite for a numeric type", () => {
    for (const typeDonnees of ["DECIMAL", "ENTIER"] as const) {
      const errors = validateChampConfig({ ...base, typeDonnees, unite: "N/A" }, knownFields, noRules)
      expect(errors.some((e) => e.field === "unite")).toBe(true)
    }
  })

  it("requires regleCalcul for a CALCULE field", () => {
    const errors = validateChampConfig(
      { ...base, typeDonnees: "DECIMAL", nature: "CALCULE", regleCalcul: null },
      knownFields,
      noRules
    )
    expect(errors.some((e) => e.field === "regleCalcul")).toBe(true)
  })

  it("rejects a regleCalcul referencing an unknown field", () => {
    const errors = validateChampConfig(
      { ...base, typeDonnees: "DECIMAL", nature: "CALCULE", regleCalcul: "prix_vente / superficie_inconnue" },
      knownFields,
      noRules
    )
    expect(errors.some((e) => e.field === "regleCalcul")).toBe(true)
  })

  it("accepts a valid regleCalcul on a numeric SAISISSABLE field", () => {
    expect(
      validateChampConfig(
        { ...base, typeDonnees: "DECIMAL", unite: "$", regleCalcul: "prix_vente / superficie_totale_hectare" },
        knownFields,
        noRules
      )
    ).toEqual([])
  })

  it("rejects a regleCalcul on a non-numeric champ", () => {
    const errors = validateChampConfig(
      { ...base, nature: "CALCULE", typeDonnees: "TEXTE", regleCalcul: "prix_vente" },
      knownFields,
      noRules
    )
    expect(errors.some((e) => e.field === "regleCalcul" && e.message.includes("décimal ou entier"))).toBe(true)
  })

  it("rejects a regleCalcul that reads a non-numeric field", () => {
    const errors = validateChampConfig(
      { ...base, typeDonnees: "DECIMAL", unite: "$", nature: "CALCULE", regleCalcul: "prix_vente / typeTransaction" },
      knownFields,
      noRules
    )
    expect(errors.some((e) => e.field === "regleCalcul")).toBe(true)
  })

  it("rejects a regleCalcul that references its own champ", () => {
    const errors = validateChampConfig(
      { ...base, typeDonnees: "DECIMAL", unite: "$", nature: "CALCULE", regleCalcul: "nouveau * 2" },
      knownFields,
      noRules
    )
    expect(errors.some((e) => e.field === "regleCalcul" && e.message.includes("propre champ"))).toBe(true)
  })

  it("rejects a regleCalcul that closes a loop with another rule", () => {
    const otherRules = new Map([["ratio", "nouveau / 2"]])
    const fields = new Map(knownFields).set("ratio", "DECIMAL")
    const errors = validateChampConfig(
      { ...base, typeDonnees: "DECIMAL", unite: "$", nature: "CALCULE", regleCalcul: "ratio + 1" },
      fields,
      otherRules
    )
    expect(errors.some((e) => e.field === "regleCalcul" && e.message.includes("boucle"))).toBe(true)
  })

  it("rejects a regle_calcul on an IMPORTE champ", () => {
    const errors = validateChampConfig({ ...base, nature: "IMPORTE", regleCalcul: "prix_vente" }, knownFields, noRules)
    expect(
      errors.some(
        (e) => e.field === "regleCalcul" && e.message === "Un champ importé ne peut pas porter de règle de calcul."
      )
    ).toBe(true)
  })

  it("requires at least one applicable type", () => {
    const errors = validateChampConfig({ ...base, applicableATypes: [] }, knownFields, noRules)
    expect(errors.some((e) => e.field === "applicableATypes")).toBe(true)
  })
})

describe("formsRuleCycle", () => {
  it("detects a loop through an indirect reference", () => {
    const rules = new Map([
      ["a", "b + 1"],
      ["b", "c * 2"],
    ])
    expect(formsRuleCycle("c", "a / 2", rules)).toBe(true)
  })

  it("accepts a chain of rules that does not loop back", () => {
    const rules = new Map([["a", "prix_vente * 2"]])
    expect(formsRuleCycle("b", "a + prix_vente", rules)).toBe(false)
  })

  it("replaces the saved rule of the champ being checked", () => {
    const rules = new Map([["a", "b + 1"]])
    expect(formsRuleCycle("b", "prix_vente", rules)).toBe(false)
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
