import { describe, it, expect } from "vitest"
import { MULTI_VALUE_SEPARATOR, joinMultiValue, parseMultiValue } from "@/lib/multi-value"

describe("parseMultiValue", () => {
  it("splits a comma-separated stored value and trims each part", () => {
    expect(parseMultiValue("Cultures annuelles, Prairie")).toEqual(["Cultures annuelles", "Prairie"])
  })

  it("tolerates slash, semicolon and ' et ' separators written by offline normalizers", () => {
    expect(parseMultiValue("Limoneux / Loam sableux")).toEqual(["Limoneux", "Loam sableux"])
    expect(parseMultiValue("Argileux; Sableux")).toEqual(["Argileux", "Sableux"])
    expect(parseMultiValue("Argileux et Sableux")).toEqual(["Argileux", "Sableux"])
  })

  it("returns an empty list for null, undefined and blank values", () => {
    expect(parseMultiValue(null)).toEqual([])
    expect(parseMultiValue(undefined)).toEqual([])
    expect(parseMultiValue("   ")).toEqual([])
  })

  it("de-duplicates while keeping first-seen order", () => {
    expect(parseMultiValue("Prairie, Prairie, Cultures annuelles")).toEqual(["Prairie", "Cultures annuelles"])
  })

  it("round-trips through joinMultiValue without losing selections", () => {
    const stored = "Cultures annuelles, Prairie"
    expect(joinMultiValue(parseMultiValue(stored))).toBe(stored)
    expect(MULTI_VALUE_SEPARATOR).toBe(", ")
  })
})

describe("joinMultiValue", () => {
  it("drops blanks and collapses to null when nothing is selected", () => {
    expect(joinMultiValue([])).toBeNull()
    expect(joinMultiValue(["", "   "])).toBeNull()
  })

  it("separates selections with the stored delimiter", () => {
    expect(joinMultiValue(["Prairie", "Vigne"])).toBe("Prairie, Vigne")
  })
})
