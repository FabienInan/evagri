import { describe, it, expect } from "vitest"
import { formatCellValue, formatCurrency } from "@/lib/format"

describe("formatCellValue", () => {
  it("rend un tiret pour les valeurs vides", () => {
    expect(formatCellValue(null)).toBe("—")
    expect(formatCellValue(undefined)).toBe("—")
    expect(formatCellValue("")).toBe("—")
  })

  it("joint les tableaux et rend un tiret pour un tableau vide", () => {
    expect(formatCellValue(["X", "Y"])).toBe("X, Y")
    expect(formatCellValue([])).toBe("—")
  })

  it("interprète les booléens textuels", () => {
    expect(formatCellValue(true, "BOOLEAN")).toBe("Oui")
    expect(formatCellValue("false", "BOOLEAN")).toBe("Non")
    expect(formatCellValue("non", "BOOLEAN")).toBe("Non")
    expect(formatCellValue("0", "BOOLEAN")).toBe("Non")
  })

  it("formate les dates en UTC", () => {
    expect(formatCellValue("2024-05-06T00:00:00.000Z", "DATE")).toBe("2024-05-06")
    expect(formatCellValue("pas une date", "DATE")).toBe("—")
  })

  it("n'affiche pas de décimales forcées pour DECIMAL", () => {
    expect(formatCellValue(75000, "DECIMAL")).toMatch(/^75[\s\u00a0\u202f]?000$/)
    expect(formatCellValue(1234.5, "DECIMAL")).toMatch(/^1[\s\u00a0\u202f]?234,5$/)
  })

  it("formate ENTIER sans décimale", () => {
    expect(formatCellValue(75000, "ENTIER")).toMatch(/^75[\s\u00a0\u202f]?000$/)
  })

  it("retourne la valeur brute quand un nombre est attendu mais illisible", () => {
    expect(formatCellValue("abc", "DECIMAL")).toBe("abc")
  })

  it("formate le défaut : booléen Oui/Non, nombre à 2 décimales max", () => {
    expect(formatCellValue(true)).toBe("Oui")
    expect(formatCellValue(12.5)).toBe("12,5")
    expect(formatCellValue("texte")).toBe("texte")
  })
})

describe("formatCurrency", () => {
  it("formate en dollars canadiens sans décimale", () => {
    expect(formatCurrency(150000)).toMatch(/150[\s\u00a0\u202f]?000/)
    expect(formatCurrency(null)).toBe("—")
  })
})
