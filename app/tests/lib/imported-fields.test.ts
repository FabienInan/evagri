import { describe, it, expect } from "vitest"
import { IMPORTED_FIELDS, IMPORTED_FIELD_BY_CODE, isImportedFieldCode } from "@/lib/imported-fields"

describe("IMPORTED_FIELDS", () => {
  it("catalogues the 12 imported fields with unique snake_case codes", () => {
    expect(IMPORTED_FIELDS).toHaveLength(12)
    expect(new Set(IMPORTED_FIELDS.map((f) => f.code)).size).toBe(12)
    for (const f of IMPORTED_FIELDS) expect(f.code).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it("exposes a by-code lookup and a membership guard", () => {
    expect(IMPORTED_FIELD_BY_CODE.mrc.label).toBe("MRC")
    expect(isImportedFieldCode("lots_cadastraux")).toBe(true)
    expect(isImportedFieldCode("champ_inconnu")).toBe(false)
    expect(isImportedFieldCode(null)).toBe(false)
  })

  it("types lots_cadastraux as TEXTE_MULTIPLE and latitude/longitude as numeric geo", () => {
    expect(IMPORTED_FIELD_BY_CODE.lots_cadastraux.typeDonnees).toBe("TEXTE_MULTIPLE")
    expect(IMPORTED_FIELD_BY_CODE.latitude.numeric).toBe(true)
    expect(IMPORTED_FIELD_BY_CODE.latitude.typeFiltreRecommande).toBe("ZONE_GEO")
  })

  it("carries EVAGRI/JLR import headers", () => {
    expect(IMPORTED_FIELD_BY_CODE.date_vente.entetesImport.EXISTANT_EVAGRI).toContain("Date de L'acte")
    expect(IMPORTED_FIELD_BY_CODE.mrc.entetesImport.JLR).toContain("MRC")
  })
})
