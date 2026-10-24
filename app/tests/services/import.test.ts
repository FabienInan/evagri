import { describe, it, expect, vi } from "vitest"
import { parseFieldValue, importSheet } from "@/services/import.service"
import { normalizeEnrichmentText, normalizeNumeroInscription } from "@/lib/normalization/transforms"
import type { EnrichmentChamp } from "@/types/import"

vi.mock("@/repositories/enrichment.repository", () => ({
  findChampByCodeMachine: vi.fn(async (_organisationId: string, code: string) => ({ id: `champ-${code}` })),
}))
vi.mock("@/repositories/import.repository", () => ({
  incrementImportationCounters: vi.fn(async () => {}),
}))
vi.mock("@/repositories/transaction.repository", () => ({
  createImportedTransactions: vi.fn(async () => {}),
  findDedupKeysByNumeros: vi.fn(async () => []),
}))
vi.mock("@/lib/cadastre", () => ({
  geocodeLotCadastral: vi.fn(async () => ({ latitude: 46.1, longitude: -71.2 })),
}))

function champ(codeMachine: string, typeDonnees: string): EnrichmentChamp {
  return { id: "c1", header: codeMachine, codeMachine, typeDonnees }
}

describe("parseFieldValue", () => {
  it("canonicalizes a cptaq value to Oui/Non/Partiel even when the champ is typed LISTE", () => {
    expect(parseFieldValue(champ("cptaq", "LISTE"), "oui").valeurTexte).toBe("Oui")
    expect(parseFieldValue(champ("cptaq", "LISTE"), "en partie").valeurTexte).toBe("Partiel")
    expect(parseFieldValue(champ("cptaq", "TEXTE"), "non").valeurTexte).toBe("Non")
  })

  it("keeps a combined MULTI_SELECT answer as its raw delimited text", () => {
    expect(parseFieldValue(champ("type_de_culture", "MULTI_SELECT"), "Cultures annuelles, Prairie").valeurTexte).toBe(
      "Cultures annuelles, Prairie"
    )
  })

  it("strips internal whitespace from numero_inscription so the stored value equals the dedup key", () => {
    const stored = parseFieldValue(champ("numero_inscription", "TEXTE"), "AB 123").valeurTexte
    expect(stored).toBe("AB123")
    expect(normalizeEnrichmentText("numero_inscription", "AB 123")).toBe("AB123")
    expect(stored).toBe(normalizeNumeroInscription("AB 123"))
  })

  it("routes decimals and booleans to their columns", () => {
    expect(parseFieldValue(champ("superficie_boise_ha", "DECIMAL"), "12,5").valeurNombre?.toString()).toBe("12.5")
    expect(parseFieldValue(champ("droit_acquis", "BOOLEAN"), "Non").valeurBooleen).toBe(false)
  })

  it("splits a TEXTE_MULTIPLE cell into valeurTexteMultiple", () => {
    expect(parseFieldValue(champ("lots_cadastraux", "TEXTE_MULTIPLE"), "5433069; 5433070").valeurTexteMultiple).toEqual([
      "5433069",
      "5433070",
    ])
    expect(parseFieldValue(champ("lots_cadastraux", "TEXTE_MULTIPLE"), 5433069).valeurTexteMultiple).toEqual([
      "5433069",
    ])
  })

  it("parses a DATE cell into valeurDate", () => {
    const parsed = parseFieldValue(champ("date_vente", "DATE"), 42507)
    expect(parsed.valeurDate).toBeInstanceOf(Date)
    expect(parsed.valeurDate?.toISOString().slice(0, 10)).toBe("2016-05-17")
  })

  it("returns an all-null quintuplet for a blank cell", () => {
    expect(parseFieldValue(champ("observations", "TEXTE"), "")).toEqual({
      valeurNombre: null,
      valeurTexte: null,
      valeurTexteMultiple: [],
      valeurBooleen: null,
      valeurDate: null,
    })
  })
})

describe("importSheet enrichmentValues", () => {
  it("does not duplicate a latitude champId when the file provides only one axis and geocoding fills the rest", async () => {
    const { createImportedTransactions } = await import("@/repositories/transaction.repository")
    vi.mocked(createImportedTransactions).mockClear()

    await importSheet({
      organisationId: "org-1",
      // File carries a latitude cell but no longitude -> resolveCoordinates falls through to geocoding.
      rows: [{ numero_inscription: "22309676", latitude: 46.8, lots_cadastraux: ["5433069"] }],
      rawRows: [{}],
      enrichmentChamps: [],
      systemeSource: "JLR",
      importationId: "imp-1",
    })

    const values = vi.mocked(createImportedTransactions).mock.calls.at(0)?.[0][0].enrichmentValues ?? []
    const ids = values.map((v) => v.champId)

    // No champId appears twice.
    expect(new Set(ids).size).toBe(ids.length)

    // Exactly one latitude entry, and it keeps the file-sourced value (not the geocoded one).
    const latEntries = values.filter((v) => v.champId === "champ-latitude")
    expect(latEntries).toHaveLength(1)
    expect(latEntries[0].valeurNombre?.toString()).toBe("46.8")

    // The geocoded longitude fills the missing axis.
    const lonEntries = values.filter((v) => v.champId === "champ-longitude")
    expect(lonEntries).toHaveLength(1)
    expect(lonEntries[0].valeurNombre?.toString()).toBe("-71.2")
  })
})

describe("importSheet dedup", () => {
  it("dedups a re-import by the normalized numero_inscription even with internal whitespace", async () => {
    const { createImportedTransactions, findDedupKeysByNumeros } = await import(
      "@/repositories/transaction.repository"
    )
    const createMock = vi.mocked(createImportedTransactions)
    const keysMock = vi.mocked(findDedupKeysByNumeros)
    const previousCreate = createMock.getMockImplementation()
    const previousKeys = keysMock.getMockImplementation()

    try {
      // Mirror the stored state: each written transaction contributes its (numero, date de vente) key, and the
      // importer reads the keys of the sheet's numeros back before writing.
      const stored: { numero: string; date: Date | null }[] = []
      createMock.mockImplementation(async (inputs) => {
        for (const input of inputs) {
          const numero = input.enrichmentValues.find((v) => v.champId === "champ-numero_inscription")?.valeurTexte
          const date = input.enrichmentValues.find((v) => v.champId === "champ-date_vente")?.valeurDate ?? null
          if (numero) stored.push({ numero, date })
        }
      })
      keysMock.mockImplementation(async (_org, numeros) => stored.filter((k) => numeros.includes(k.numero)))

      const importOnce = () =>
        importSheet({
          organisationId: "org-1",
          rows: [{ numero_inscription: "AB 123", date_vente: "2024-05-01" }],
          rawRows: [{}],
          enrichmentChamps: [],
          systemeSource: "JLR",
          importationId: "imp-1",
        })

      const first = await importOnce()
      expect(first.inserted).toBe(1)
      expect(stored).toEqual([{ numero: "AB123", date: new Date("2024-05-01") }])

      const second = await importOnce()
      expect(second.inserted).toBe(0)
      expect(second.ignored).toBe(1)
    } finally {
      if (previousCreate) createMock.mockImplementation(previousCreate)
      if (previousKeys) keysMock.mockImplementation(previousKeys)
    }
  })

  it("ignores a repeated row within the same sheet", async () => {
    const { createImportedTransactions } = await import("@/repositories/transaction.repository")
    vi.mocked(createImportedTransactions).mockClear()

    const result = await importSheet({
      organisationId: "org-1",
      rows: [
        { numero_inscription: "CD 9", date_vente: "2024-05-01" },
        { numero_inscription: "CD 9", date_vente: "2024-05-01" },
      ],
      rawRows: [{}, {}],
      enrichmentChamps: [],
      systemeSource: "JLR",
      importationId: "imp-1",
    })

    expect(result.inserted).toBe(1)
    expect(result.ignored).toBe(1)
  })

  it("reports a failing batch row by row without losing the other rows", async () => {
    const { createImportedTransactions } = await import("@/repositories/transaction.repository")
    const createMock = vi.mocked(createImportedTransactions)
    const previous = createMock.getMockImplementation()

    try {
      // Whole-batch write fails; then the row whose numero is "BAD" fails alone and the others succeed.
      createMock.mockImplementation(async (inputs) => {
        if (inputs.length > 1) throw new Error("batch failed")
        const numero = inputs[0].enrichmentValues.find((v) => v.champId === "champ-numero_inscription")?.valeurTexte
        if (numero === "BAD") throw new Error("row failed")
      })

      const result = await importSheet({
        organisationId: "org-1",
        rows: [{ numero_inscription: "EF 1" }, { numero_inscription: "BAD" }, { numero_inscription: "EF 2" }],
        rawRows: [{}, {}, {}],
        enrichmentChamps: [],
        systemeSource: "JLR",
        importationId: "imp-1",
      })

      expect(result.inserted).toBe(2)
      expect(result.errors).toEqual([{ row: 3, message: "row failed" }])
    } finally {
      if (previous) createMock.mockImplementation(previous)
    }
  })
})
