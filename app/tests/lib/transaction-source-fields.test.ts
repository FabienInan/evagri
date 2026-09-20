import { describe, it, expect } from "vitest"
import {
  SOURCE_FIELDS,
  SOURCE_FIELD_BY_CODE,
  SOURCE_FIELD_CODES,
  isSourceFieldCode,
  sourceColumnOf,
} from "@/lib/transaction-source-fields"

describe("SOURCE_FIELDS catalogue", () => {
  it("has exactly the ten TransactionSource columns", () => {
    expect(SOURCE_FIELDS).toHaveLength(10)
  })

  it("has a unique snake_case code for every entry", () => {
    const codes = SOURCE_FIELDS.map((f) => f.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it("maps every code to a Prisma column", () => {
    for (const f of SOURCE_FIELDS) expect(sourceColumnOf(f.code)).toBe(f.column)
  })

  it("maps superficie_totale_hectare to the superficieTotaleHectare column", () => {
    expect(sourceColumnOf("superficie_totale_hectare")).toBe("superficieTotaleHectare")
  })

  it("recommends PLAGE_NUMERIQUE for prix_vente", () => {
    expect(SOURCE_FIELD_BY_CODE["prix_vente"].typeFiltreRecommande).toBe("PLAGE_NUMERIQUE")
  })

  it("recommends LISTE for mrc", () => {
    expect(SOURCE_FIELD_BY_CODE["mrc"].typeFiltreRecommande).toBe("LISTE")
  })

  it("recommends NUMERO_LOT for lots_cadastraux", () => {
    expect(SOURCE_FIELD_BY_CODE["lots_cadastraux"].typeFiltreRecommande).toBe("NUMERO_LOT")
  })

  it("excludes the array column from SOURCE_FIELD_CODES", () => {
    expect(SOURCE_FIELD_CODES).not.toContain("lots_cadastraux")
    expect(SOURCE_FIELD_CODES).toContain("prix_vente")
    expect(SOURCE_FIELD_CODES).toHaveLength(9)
  })

  it("recognises source codes and rejects others", () => {
    expect(isSourceFieldCode("mrc")).toBe(true)
    expect(isSourceFieldCode("lots_cadastraux")).toBe(true)
    expect(isSourceFieldCode("statut")).toBe(false)
    expect(isSourceFieldCode(null)).toBe(false)
    expect(isSourceFieldCode(undefined)).toBe(false)
  })

  it("rejects prototype-chain keys that are not real codes", () => {
    expect(isSourceFieldCode("constructor")).toBe(false)
    expect(isSourceFieldCode("toString")).toBe(false)
  })
})
