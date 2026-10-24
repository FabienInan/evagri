import { describe, it, expect } from "vitest"
import { evaluateRule, roundForType, ruleIdentifiers, validateRuleSyntax } from "@/lib/calculator"
import type { TypeDonneesChamp } from "@/types/champ"

describe("evaluateRule", () => {
  it("evaluates a simple rule against flat field values", () => {
    const context = { fields: { prix_vente: 100000, superficie_totale_hectare: 50 } }
    expect(evaluateRule("prix_vente / superficie_totale_hectare", context)).toBe(2000)
  })

  it("evaluates a compound rule mixing several fields", () => {
    const context = { fields: { a: 10, b: 20, c: 30 } }
    expect(evaluateRule("(a + b) * c / 100", context)).toBe(9)
  })

  it("respects operator precedence without parentheses", () => {
    const context = { fields: { a: 2, b: 3, c: 4 } }
    expect(evaluateRule("a + b * c", context)).toBe(14)
  })

  it("prefers enrichi values over source values for the same code", () => {
    const context = { fields: { taux: 5 } }
    expect(evaluateRule("taux * 2", context)).toBe(10)
  })

  it("returns null when a referenced field is missing", () => {
    const context = { fields: { prix_vente: 100000 } }
    expect(evaluateRule("prix_vente / superficie_totale_hectare", context)).toBeNull()
  })

  it("returns null on division by zero", () => {
    const context = { fields: { a: 10, b: 0 } }
    expect(evaluateRule("a / b", context)).toBeNull()
  })

  it("returns null for an empty rule", () => {
    expect(evaluateRule("", { fields: {} })).toBeNull()
  })

  it("returns null on unbalanced parentheses instead of throwing", () => {
    expect(evaluateRule("(a + b", { fields: { a: 1, b: 2 } })).toBeNull()
  })

  it("returns null on an invalid token instead of throwing", () => {
    expect(evaluateRule("a % b", { fields: { a: 1, b: 2 } })).toBeNull()
  })

  it("treats whitespace as a separator, not as removable glue", () => {
    // `a b` must not silently become the identifier `ab`.
    const context = { fields: { ab: 99 } }
    expect(evaluateRule("a b", context)).toBeNull()
  })

  it("ignores surrounding whitespace between tokens", () => {
    const context = { fields: { a: 2, b: 3 } }
    expect(evaluateRule("  a   +   b  ", context)).toBe(5)
  })

  it("returns null when an expression has dangling operands", () => {
    expect(evaluateRule("a +", { fields: { a: 1 } })).toBeNull()
  })
})

describe("evaluateRule edge cases", () => {
  it("accepts a number written with a leading decimal point", () => {
    expect(evaluateRule("a * .5", { fields: { a: 10 } })).toBe(5)
  })

  it("does not read inherited object properties as fields", () => {
    expect(evaluateRule("constructor + 1", { fields: {} })).toBeNull()
    expect(evaluateRule("toString * 2", { fields: { a: 1 } })).toBeNull()
  })

  it("keeps decimal precision in intermediate results", () => {
    expect(evaluateRule("a / 3 * 3", { fields: { a: 1 } })).toBe(1)
  })
})

describe("roundForType", () => {
  it("rounds an ENTIER to the nearest integer", () => {
    expect(roundForType(1234.56, "ENTIER")).toBe(1235)
    expect(roundForType(1234.49, "ENTIER")).toBe(1234)
  })

  it("keeps two decimals for a DECIMAL, rounding half up", () => {
    expect(roundForType(12.345, "DECIMAL")).toBe(12.35)
    expect(roundForType(12.344, "DECIMAL")).toBe(12.34)
    expect(roundForType(7, "DECIMAL")).toBe(7)
  })

  it("passes null through", () => {
    expect(roundForType(null, "ENTIER")).toBeNull()
    expect(roundForType(null, "DECIMAL")).toBeNull()
  })
})

describe("ruleIdentifiers", () => {
  it("lists the identifiers a rule reads, without numbers or operators", () => {
    expect(ruleIdentifiers("(prix_vente - taux_boise_ref * 2) / superficie_totale_hectare")).toEqual([
      "prix_vente",
      "taux_boise_ref",
      "superficie_totale_hectare",
    ])
  })

  it("returns nothing for a malformed rule", () => {
    expect(ruleIdentifiers("(a + b")).toEqual([])
  })
})

describe("validateRuleSyntax", () => {
  const knownFieldCodes = new Map<string, TypeDonneesChamp>([
    ["prix_vente", "DECIMAL"],
    ["superficie_totale_hectare", "DECIMAL"],
    ["typeTransaction", "TEXTE"],
  ])

  it("accepts a rule referencing only known fields", () => {
    expect(validateRuleSyntax("prix_vente / superficie_totale_hectare", knownFieldCodes)).toEqual({ valid: true })
  })

  it("rejects a rule referencing an unknown field", () => {
    expect(validateRuleSyntax("prix_vente / superficie_inconnue", knownFieldCodes)).toEqual({
      valid: false,
      error: "Champ inconnu : superficie_inconnue",
    })
  })

  it("rejects a rule referencing a non-numeric field", () => {
    const result = validateRuleSyntax("prix_vente / typeTransaction", knownFieldCodes)
    expect(result.valid).toBe(false)
  })

  it("explains that negative numbers are not accepted", () => {
    const result = validateRuleSyntax("-prix_vente", knownFieldCodes)
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toContain("négatifs")
  })

  it("names an unsupported character instead of a generic token error", () => {
    const result = validateRuleSyntax("prix_vente , superficie_totale_hectare", knownFieldCodes)
    expect(result).toEqual({ valid: false, error: "Caractère non autorisé : « , »" })
  })

  it("rejects an empty rule", () => {
    expect(validateRuleSyntax("", knownFieldCodes).valid).toBe(false)
  })

  it("rejects malformed syntax", () => {
    const result = validateRuleSyntax("(prix_vente", knownFieldCodes)
    expect(result.valid).toBe(false)
  })

  it("rejects a rule with two adjacent operands", () => {
    const result = validateRuleSyntax("prix_vente superficie_totale_hectare", knownFieldCodes)
    expect(result.valid).toBe(false)
  })

  it("rejects a rule with a dangling operator", () => {
    const result = validateRuleSyntax("prix_vente +", knownFieldCodes)
    expect(result.valid).toBe(false)
  })

  it("accepts a rule without spaces around operators", () => {
    expect(validateRuleSyntax("prix_vente/superficie_totale_hectare", knownFieldCodes)).toEqual({
      valid: true,
    })
  })
})
