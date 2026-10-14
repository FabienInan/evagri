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
  it("forces est_obligatoire off for a non-SAISISSABLE nature", () => {
    expect(normalizeChampInput({ ...base, nature: "CALCULE", estObligatoire: true, regleCalcul: "a + b" }).estObligatoire).toBe(false)
  })
})

describe("validateChampConfig", () => {
  it("rejects a code that collides with a reserved imported code", () => {
    const errors = validateChampConfig({ ...base, codeMachine: "prix_vente" }, new Set(["prix_vente"]))
    expect(errors.some((e) => e.field === "codeMachine")).toBe(true)
  })

  it("rejects a regle_calcul on an IMPORTE champ", () => {
    const errors = validateChampConfig({ ...base, nature: "IMPORTE", regleCalcul: "a + b" }, new Set())
    expect(errors.some((e) => e.field === "regleCalcul")).toBe(true)
  })

  it("accepts a valid saisissable champ", () => {
    expect(validateChampConfig(base, new Set())).toEqual([])
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
