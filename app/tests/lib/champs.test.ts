import { describe, it, expect } from "vitest"
import { deriveEstLectureSeule, validateChampConfig, normalizeChampInput } from "@/lib/champs"
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
