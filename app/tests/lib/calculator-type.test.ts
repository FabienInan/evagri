import { describe, expect, it } from "vitest"
import { inferTypeDonneesFromRule } from "@/lib/calculator"

const known = new Map<string, "DECIMAL" | "ENTIER" | "TEXTE">([
  ["prix_vente", "DECIMAL"],
  ["superficie_cultivee", "ENTIER"],
  ["superficie_boisee", "ENTIER"],
  ["code", "TEXTE"],
])

describe("inferTypeDonneesFromRule", () => {
  it("donne ENTIER quand tous les opérandes sont entiers et que les opérateurs sont + - *", () => {
    expect(inferTypeDonneesFromRule("superficie_cultivee + superficie_boisee", known)).toBe("ENTIER")
    expect(inferTypeDonneesFromRule("superficie_cultivee * 2 - 1", known)).toBe("ENTIER")
  })

  it("donne DECIMAL dès qu'un opérande est décimal", () => {
    expect(inferTypeDonneesFromRule("prix_vente / superficie_cultivee", known)).toBe("DECIMAL")
    expect(inferTypeDonneesFromRule("superficie_cultivee + prix_vente", known)).toBe("DECIMAL")
  })

  it("donne DECIMAL pour une division de deux entiers", () => {
    expect(inferTypeDonneesFromRule("superficie_cultivee / superficie_boisee", known)).toBe("DECIMAL")
  })

  it("donne DECIMAL pour un littéral à virgule", () => {
    expect(inferTypeDonneesFromRule("superficie_cultivee * 1.5", known)).toBe("DECIMAL")
  })

  it("renvoie null pour un champ inconnu, non numérique, ou une règle sans opérande", () => {
    expect(inferTypeDonneesFromRule("inconnu + 1", known)).toBeNull()
    expect(inferTypeDonneesFromRule("code + 1", known)).toBeNull()
    expect(inferTypeDonneesFromRule("2 * 3", known)).toBeNull()
  })
})
