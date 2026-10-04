import { describe, it, expect } from "vitest"
import { evaluateRule, roundToInteger, validateRuleSyntax } from "@/lib/calculator"

describe("evaluateRule", () => {
  it("evaluates a simple rule against source fields", () => {
    const context = { source: { prix_vente: 100000, superficie_totale_hectare: 50 }, enrichi: {} }
    expect(evaluateRule("prix_vente / superficie_totale_hectare", context)).toBe(2000)
  })

  it("evaluates a compound rule mixing source and enrichi fields", () => {
    const context = { source: { a: 10, b: 20 }, enrichi: { c: 30 } }
    expect(evaluateRule("(a + b) * c / 100", context)).toBe(9)
  })

  it("respects operator precedence without parentheses", () => {
    const context = { source: { a: 2, b: 3, c: 4 }, enrichi: {} }
    expect(evaluateRule("a + b * c", context)).toBe(14)
  })

  it("prefers enrichi values over source values for the same code", () => {
    const context = { source: { taux: 1 }, enrichi: { taux: 5 } }
    expect(evaluateRule("taux * 2", context)).toBe(10)
  })

  it("returns null when a referenced field is missing", () => {
    const context = { source: { prix_vente: 100000 }, enrichi: {} }
    expect(evaluateRule("prix_vente / superficie_totale_hectare", context)).toBeNull()
  })

  it("returns null on division by zero", () => {
    const context = { source: { a: 10, b: 0 }, enrichi: {} }
    expect(evaluateRule("a / b", context)).toBeNull()
  })

  it("returns null for an empty rule", () => {
    expect(evaluateRule("", { source: {}, enrichi: {} })).toBeNull()
  })

  it("returns null on unbalanced parentheses instead of throwing", () => {
    expect(evaluateRule("(a + b", { source: { a: 1, b: 2 }, enrichi: {} })).toBeNull()
  })

  it("returns null on an invalid token instead of throwing", () => {
    expect(evaluateRule("a % b", { source: { a: 1, b: 2 }, enrichi: {} })).toBeNull()
  })

  it("treats whitespace as a separator, not as removable glue", () => {
    // `a b` must not silently become the identifier `ab`.
    const context = { source: { ab: 99 }, enrichi: {} }
    expect(evaluateRule("a b", context)).toBeNull()
  })

  it("ignores surrounding whitespace between tokens", () => {
    const context = { source: { a: 2, b: 3 }, enrichi: {} }
    expect(evaluateRule("  a   +   b  ", context)).toBe(5)
  })

  it("returns null when an expression has dangling operands", () => {
    expect(evaluateRule("a +", { source: { a: 1 }, enrichi: {} })).toBeNull()
  })
})

describe("roundToInteger", () => {
  it("rounds to the nearest integer", () => {
    expect(roundToInteger(1234.56)).toBe(1235)
    expect(roundToInteger(1234.49)).toBe(1234)
  })

  it("passes null through", () => {
    expect(roundToInteger(null)).toBeNull()
  })
})

describe("validateRuleSyntax", () => {
  const knownFieldCodes = new Set(["prix_vente", "superficie_totale_hectare"])

  it("accepts a rule referencing only known fields", () => {
    expect(validateRuleSyntax("prix_vente / superficie_totale_hectare", knownFieldCodes)).toEqual({ valid: true })
  })

  it("rejects a rule referencing an unknown field", () => {
    expect(validateRuleSyntax("prix_vente / superficie_inconnue", knownFieldCodes)).toEqual({
      valid: false,
      error: "Champ inconnu: superficie_inconnue",
    })
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
