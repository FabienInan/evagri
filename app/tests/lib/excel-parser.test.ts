import { describe, it, expect } from "vitest"
import { readFileSync } from "fs"
import { join } from "path"
import { parseWorkbook, rowToSourceFields, extractNonEmptyEnrichmentHeaders, inferType } from "@/parsers/excel.parser"

const rawFixture = readFileSync(join(__dirname, "../fixtures/minimal.xlsx"))
const fixture = rawFixture.buffer.slice(rawFixture.byteOffset, rawFixture.byteOffset + rawFixture.byteLength)

describe("excel parser", () => {
  it("parses fixture with known sheets", () => {
    const parsed = parseWorkbook(fixture)
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed[0].typologieCode).toBe("TERRES_CULTIVEES")
    expect(parsed[0].rows.length).toBe(1)
  })

  it("maps a row to source fields and treats coordinates as enrichment", () => {
    const row = {
      "No d'enr.": 22309676,
      "Date de l'acte ou de l'avant contrat": 42507,
      Vendeur: "Vendeur A",
      Acheteur: "Acheteur B",
      Lots: 5433069,
      "Prixdevente($)": 36000,
      MRC: "Nicolet-Yamaska",
      "Ville/Municipalité": "Baie-du-Febvre",
      "Adresse complète": "Route Marie-Victorin",
      Latitude: "46.154336",
      Longitude: "-72.706115",
      "Superficie totale (ha)": 6.25,
      "Usage prédominant": "Cultures annuelles",
    }
    const mapped = rowToSourceFields(row)
    expect(mapped.numeroInscription).toBe(22309676)
    expect(mapped.dateVente).toBe(42507)
    expect(mapped.vendeur).toBe("Vendeur A")
    expect(mapped.acheteur).toBe("Acheteur B")
    expect(mapped.lotsCadastraux).toBe(5433069)
    expect(mapped.prixVente).toBe(36000)
    expect(mapped.mrc).toBe("Nicolet-Yamaska")
    expect(mapped.municipalite).toBe("Baie-du-Febvre")
    expect(mapped.adresse).toBe("Route Marie-Victorin")
    expect(mapped.latitude).toBeUndefined()
    expect(mapped.longitude).toBeUndefined()
    expect(mapped.superficieTotaleHectare).toBe(6.25)

    const candidates = extractNonEmptyEnrichmentHeaders([row])
    const headers = candidates.map((c) => c.header)
    expect(headers).toContain("Latitude")
    expect(headers).toContain("Longitude")
  })

  it("ignores source headers but keeps all enrichment columns", () => {
    const rows = [
      { "No d'enr.": "1", "Colonne vide": "", "Colonne pleine": "ABC" },
      { "No d'enr.": "2", "Colonne vide": null, "Colonne pleine": "DEF" },
    ]
    const candidates = extractNonEmptyEnrichmentHeaders(rows)
    expect(candidates.map((c) => c.header)).toEqual(["Colonne vide", "Colonne pleine"])
    expect(candidates.find((c) => c.header === "Colonne pleine")?.sample).toBe("ABC")
    expect(candidates.find((c) => c.header === "Colonne vide")?.sample).toBeNull()
  })

  it("infers types correctly", () => {
    expect(inferType(12.5)).toBe("DECIMAL")
    expect(inferType(12)).toBe("ENTIER")
    expect(inferType("texte")).toBe("TEXTE")
    expect(inferType(true)).toBe("BOOLEAN")
  })
})
