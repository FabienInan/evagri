import { describe, expect, it } from "vitest"
import { DEFAULT_SECTION_NAME, placeChampInSections } from "@/lib/fiche-layout"
import type { FicheSection } from "@/types/champ"

const saved: FicheSection[] = [
  { id: "imp", nom: "Données de l'acte", ordre: 0, champs: ["a"] },
  { id: "custom", nom: "Mes champs", ordre: 1, champs: ["b"] },
]

describe("placeChampInSections", () => {
  it("ajoute un champ nouveau à une section existante « Champs à enrichir »", () => {
    const sections: FicheSection[] = [...saved, { id: "enrich", nom: DEFAULT_SECTION_NAME, ordre: 2, champs: ["c"] }]
    const result = placeChampInSections(sections, "nouveau")
    expect(result.find((s) => s.id === "enrich")?.champs).toEqual(["c", "nouveau"])
  })

  it("crée la section « Champs à enrichir » quand elle n'existe pas", () => {
    const result = placeChampInSections(saved, "nouveau")
    const created = result[result.length - 1]
    expect(created.nom).toBe(DEFAULT_SECTION_NAME)
    expect(created.champs).toEqual(["nouveau"])
    expect(created.ordre).toBe(2)
  })

  it("ne duplique pas un champ déjà placé, et ne modifie pas l'entrée", () => {
    expect(placeChampInSections(saved, "b")).toBe(saved)
    const before = JSON.stringify(saved)
    placeChampInSections(saved, "nouveau")
    expect(JSON.stringify(saved)).toBe(before)
  })
})
