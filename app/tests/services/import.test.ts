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
  createImportedTransaction: vi.fn(async () => ({ id: "tx-1" })),
  findExistingTransaction: vi.fn(async () => null),
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
    const { createImportedTransaction } = await import("@/repositories/transaction.repository")
    vi.mocked(createImportedTransaction).mockClear()

    await importSheet({
      organisationId: "org-1",
      // File carries a latitude cell but no longitude -> resolveCoordinates falls through to geocoding.
      rows: [{ numero_inscription: "22309676", latitude: 46.8, lots_cadastraux: ["5433069"] }],
      rawRows: [{}],
      enrichmentChamps: [],
      systemeSource: "JLR",
      importationId: "imp-1",
    })

    const values = vi.mocked(createImportedTransaction).mock.calls.at(0)?.[0].enrichmentValues ?? []
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
    const { createImportedTransaction, findExistingTransaction } = await import(
      "@/repositories/transaction.repository"
    )
    const createMock = vi.mocked(createImportedTransaction)
    const findMock = vi.mocked(findExistingTransaction)
    const previousCreate = createMock.getMockImplementation()
    const previousFind = findMock.getMockImplementation()

    try {
      // Mirror the real dedup: a re-import matches only when both the stored numero (as normalized at
      // persist time) and the stored date equal the values the importer looks the row up by.
      let storedNumero: string | null = null
      let storedDate: number | null = null
      createMock.mockImplementation(async (input) => {
        storedNumero =
          input.enrichmentValues.find((v) => v.champId === "champ-numero_inscription")?.valeurTexte ?? null
        const date = input.enrichmentValues.find((v) => v.champId === "champ-date_vente")?.valeurDate ?? null
        storedDate = date ? date.getTime() : null
        return { transactionId: "tx-1" }
      })
      findMock.mockImplementation(async (_org, numero, date) => {
        if (storedNumero === null) return null
        const sameDate = date ? storedDate === date.getTime() : storedDate === null
        return numero === storedNumero && sameDate
          ? ({ id: "existing" } as Awaited<ReturnType<typeof findExistingTransaction>>)
          : null
      })

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
      expect(storedNumero).toBe("AB123")

      const second = await importOnce()
      expect(second.inserted).toBe(0)
      expect(second.ignored).toBe(1)
    } finally {
      if (previousCreate) createMock.mockImplementation(previousCreate)
      if (previousFind) findMock.mockImplementation(previousFind)
    }
  })
})
