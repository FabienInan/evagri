import { describe, it, expect } from "vitest"
import {
  TYPE_TRANSACTION_CODE,
  buildCalculationContext,
  buildFicheViewModel,
  buildSourceNumbers,
  buildStorageEntries,
  deriveFicheMode,
  formatFicheValue,
  formatSourceFieldValue,
  isChampApplicable,
  recomputeIndicateurs,
  resolveTypeTransaction,
  toNumericValues,
  toStorageValue,
  validateFiche,
  withRecomputedIndicateurs,
} from "@/lib/fiche"
import type { ChampEnrichissableConfig } from "@/types/champ"

function champ(overrides: Partial<ChampEnrichissableConfig>): ChampEnrichissableConfig {
  return {
    id: "c1",
    codeMachine: "superficie_cultivee",
    nomAffichage: "Superficie cultivée",
    typeDonnees: "DECIMAL",
    nature: "SAISISSABLE",
    unite: "ha",
    plageMin: null,
    plageMax: null,
    optionsListe: null,
    regleCalcul: null,
    applicableATypes: [],
    ordreAffichage: 0,
    estAffiche: true,
    estObligatoire: false,
    estModifiable: true,
    actif: true,
    ...overrides,
  }
}

describe("deriveFicheMode", () => {
  it("is consultation when the transaction is analysed", () => {
    expect(deriveFicheMode("Analysée")).toBe("consultation")
  })
  it("is edition otherwise", () => {
    expect(deriveFicheMode("A analyser")).toBe("edition")
    expect(deriveFicheMode(null)).toBe("edition")
  })
})

describe("isChampApplicable", () => {
  it("applies when no type is configured", () => {
    expect(isChampApplicable({ applicableATypes: [] }, "CULTIVEE")).toBe(true)
  })
  it("applies when the type is unknown (no type selected yet)", () => {
    expect(isChampApplicable({ applicableATypes: ["BOISEE"] }, null)).toBe(true)
  })
  it("applies when the type matches", () => {
    expect(isChampApplicable({ applicableATypes: ["BOISEE"] }, "BOISEE")).toBe(true)
  })
  it("does not apply when the type differs", () => {
    expect(isChampApplicable({ applicableATypes: ["BOISEE"] }, "CULTIVEE")).toBe(false)
  })
})

describe("buildFicheViewModel", () => {
  it("renders only champs placed in a saved section", () => {
    const placed = champ({ id: "a", codeMachine: "a" })
    const orphan = champ({ id: "b", codeMachine: "b" })
    const vm = buildFicheViewModel({
      sections: [{ id: "s1", nom: "Un", ordre: 0, champs: ["a"] }],
      champs: [placed, orphan],
      valeurs: {},
      typeCode: null,
    })
    expect(vm.mainSections).toHaveLength(1)
    expect(vm.mainSections[0].champs.map((c) => c.config.id)).toEqual(["a"])
  })

  it("splits SAISISSABLE into sections and CALCULE into indicateurs", () => {
    const saisi = champ({ id: "a", codeMachine: "a" })
    const calcule = champ({ id: "k", codeMachine: "k", nature: "CALCULE", regleCalcul: "a * 1", estModifiable: false })
    const vm = buildFicheViewModel({
      sections: [{ id: "s1", nom: "Un", ordre: 0, champs: ["a", "k"] }],
      champs: [saisi, calcule],
      valeurs: {},
      typeCode: null,
    })
    expect(vm.mainSections[0].champs.map((c) => c.config.id)).toEqual(["a"])
    expect(vm.indicateurs.map((c) => c.config.id)).toEqual(["k"])
  })

  it("excludes a champ hidden by estAffiche or applicableATypes", () => {
    const hidden = champ({ id: "a", codeMachine: "a", estAffiche: false })
    const scoped = champ({ id: "b", codeMachine: "b", applicableATypes: ["BOISEE"] })
    const vm = buildFicheViewModel({
      sections: [{ id: "s1", nom: "Un", ordre: 0, champs: ["a", "b"] }],
      champs: [hidden, scoped],
      valeurs: {},
      typeCode: "CULTIVEE",
    })
    expect(vm.mainSections).toHaveLength(0)
  })

  it("omits a section emptied by filtering but keeps section order", () => {
    const x = champ({ id: "x", codeMachine: "x", applicableATypes: ["BOISEE"] })
    const y = champ({ id: "y", codeMachine: "y" })
    const vm = buildFicheViewModel({
      sections: [
        { id: "s2", nom: "Deux", ordre: 1, champs: ["x"] },
        { id: "s1", nom: "Un", ordre: 0, champs: ["y"] },
      ],
      champs: [x, y],
      valeurs: {},
      typeCode: "CULTIVEE",
    })
    expect(vm.mainSections.map((s) => s.section.id)).toEqual(["s1"])
  })

  it("keeps the type de transaction out of the main sections (rendered in the header)", () => {
    const type = champ({ id: "t", codeMachine: TYPE_TRANSACTION_CODE, typeDonnees: "LISTE" })
    const vm = buildFicheViewModel({
      sections: [{ id: "s1", nom: "Un", ordre: 0, champs: ["t"] }],
      champs: [type],
      valeurs: {},
      typeCode: null,
    })
    expect(vm.mainSections).toHaveLength(0)
  })
})

describe("formatFicheValue", () => {
  it("formats per type and shows an em dash for empty values", () => {
    expect(formatFicheValue("DECIMAL", 12.5)).toBe("12,5")
    expect(formatFicheValue("BOOLEAN", true)).toBe("Oui")
    expect(formatFicheValue("TEXTE", null)).toBe("—")
    expect(formatFicheValue("TEXTE", "")).toBe("—")
  })
})

describe("formatSourceFieldValue", () => {
  it("joins array columns and maps the column name", () => {
    expect(formatSourceFieldValue({ column: "lotsCadastraux", typeDonnees: "TEXTE", array: true }, { lotsCadastraux: ["1", "2"] })).toBe("1, 2")
    expect(formatSourceFieldValue({ column: "mrc", typeDonnees: "TEXTE" }, { mrc: "Drummond" })).toBe("Drummond")
    expect(formatSourceFieldValue({ column: "mrc", typeDonnees: "TEXTE" }, {})).toBe("—")
  })
})

describe("buildSourceNumbers", () => {
  it("maps source columns to their snake_case codes and ignores non-numeric columns", () => {
    const source = buildSourceNumbers({ prixVente: 120000, superficieTotaleHectare: 40, mrc: "Drummond" })
    expect(source.prix_vente).toBe(120000)
    expect(source.superficie_totale_hectare).toBe(40)
    expect(source.mrc).toBeNull()
  })
})

describe("buildCalculationContext and recomputeIndicateurs", () => {
  it("evaluates the rule and rounds the result to an integer", () => {
    const context = buildCalculationContext({ prixVente: 100000, superficieTotaleHectare: 30 }, {})
    const result = recomputeIndicateurs(
      [champ({ id: "k", codeMachine: "taux_global", nature: "CALCULE", regleCalcul: "prix_vente / superficie_totale_hectare" })],
      context
    )
    expect(result.taux_global).toBe(3333)
  })

  it("leaves the indicator null on a division by zero", () => {
    const context = buildCalculationContext({ prixVente: 1000, superficieTotaleHectare: 0 }, {})
    const result = recomputeIndicateurs(
      [champ({ id: "k", codeMachine: "taux_global", nature: "CALCULE", regleCalcul: "prix_vente / superficie_totale_hectare" })],
      context
    )
    expect(result.taux_global).toBeNull()
  })

  it("feeds a calculated field back so a later rule can reference it", () => {
    const context = buildCalculationContext({ prixVente: 1000, superficieTotaleHectare: 10 }, {})
    const result = recomputeIndicateurs(
      [
        champ({ id: "a", codeMachine: "taux", nature: "CALCULE", regleCalcul: "prix_vente / superficie_totale_hectare" }),
        champ({ id: "b", codeMachine: "double_taux", nature: "CALCULE", regleCalcul: "taux * 2" }),
      ],
      context
    )
    expect(result.taux).toBe(100)
    expect(result.double_taux).toBe(200)
  })

  it("resolves a cascade even when the dependency is listed second", () => {
    const context = buildCalculationContext({ prixVente: 1000, superficieTotaleHectare: 10 }, {})
    const result = recomputeIndicateurs(
      [
        champ({ id: "b", codeMachine: "double_taux", nature: "CALCULE", regleCalcul: "taux * 2" }),
        champ({ id: "a", codeMachine: "taux", nature: "CALCULE", regleCalcul: "prix_vente / superficie_totale_hectare" }),
      ],
      context
    )
    expect(result.double_taux).toBe(200)
  })
})

describe("withRecomputedIndicateurs", () => {
  it("computes the CALCULE indicators from the source columns, keeping the other values", () => {
    const champs = [
      champ({ id: "k", codeMachine: "taux_global", nature: "CALCULE", regleCalcul: "prix_vente / superficie_totale_hectare" }),
      champ({ id: "s", codeMachine: "superficie_boise_ha", nature: "SAISISSABLE" }),
    ]
    const valeurs = withRecomputedIndicateurs(
      champs,
      { prixVente: 720000, superficieTotaleHectare: 89.61 },
      { superficie_boise_ha: 12 }
    )
    // 720000 / 89.61 = 8034.8... → arrondi à l'entier
    expect(valeurs.taux_global).toBe(8035)
    expect(valeurs.superficie_boise_ha).toBe(12)
  })

  it("leaves the indicator null when an operand is missing", () => {
    const champs = [
      champ({ id: "k", codeMachine: "taux_global", nature: "CALCULE", regleCalcul: "prix_vente / superficie_totale_hectare" }),
    ]
    const valeurs = withRecomputedIndicateurs(champs, { prixVente: null, superficieTotaleHectare: null }, {})
    expect(valeurs.taux_global).toBeNull()
  })
})

describe("toNumericValues", () => {
  it("keeps numbers, parses numeric strings and drops the rest", () => {
    expect(toNumericValues({ a: 1, b: "2.5", c: "", d: null, e: "x" })).toEqual({ a: 1, b: 2.5 })
  })
})

describe("toStorageValue", () => {
  it("routes decimals to valeurNombre", () => {
    expect(toStorageValue("DECIMAL", 4.2)).toEqual({ valeurNombre: 4.2, valeurTexte: null, valeurBooleen: null })
  })
  it("routes booleans to valeurBooleen", () => {
    expect(toStorageValue("BOOLEAN", false)).toEqual({ valeurNombre: null, valeurTexte: null, valeurBooleen: false })
  })
  it("routes text and list to valeurTexte", () => {
    expect(toStorageValue("LISTE", "CULTIVEE")).toEqual({ valeurNombre: null, valeurTexte: "CULTIVEE", valeurBooleen: null })
  })
  it("stores a multi-selection as a delimited valeurTexte", () => {
    expect(toStorageValue("MULTI_SELECT", "Prairie, Vigne")).toEqual({
      valeurNombre: null,
      valeurTexte: "Prairie, Vigne",
      valeurBooleen: null,
    })
    expect(toStorageValue("MULTI_SELECT", null)).toEqual({
      valeurNombre: null,
      valeurTexte: null,
      valeurBooleen: null,
    })
  })
  it("returns all-null for an empty value", () => {
    expect(toStorageValue("TEXTE", "")).toEqual({ valeurNombre: null, valeurTexte: null, valeurBooleen: null })
    expect(toStorageValue("DECIMAL", null)).toEqual({ valeurNombre: null, valeurTexte: null, valeurBooleen: null })
  })
})

describe("formatFicheValue", () => {
  it("renders an empty value as a dash", () => {
    expect(formatFicheValue("TEXTE", null)).toBe("—")
    expect(formatFicheValue("TEXTE", "")).toBe("—")
  })

  it("renders booleans, including text-encoded falsey values", () => {
    expect(formatFicheValue("BOOLEAN", true)).toBe("Oui")
    expect(formatFicheValue("BOOLEAN", false)).toBe("Non")
    expect(formatFicheValue("BOOLEAN", "false")).toBe("Non")
    expect(formatFicheValue("BOOLEAN", "0")).toBe("Non")
  })

  it("renders an invalid date as a dash instead of 'Invalid Date'", () => {
    expect(formatFicheValue("DATE", "pas-une-date")).toBe("—")
  })

  it("formats a valid date", () => {
    expect(formatFicheValue("DATE", "2020-05-01")).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("passes a non-numeric value through instead of rendering 'NaN'", () => {
    expect(formatFicheValue("DECIMAL", "abc")).toBe("abc")
  })

  it("uses the French decimal separator", () => {
    expect(formatFicheValue("DECIMAL", 4.2)).toBe("4,2")
  })
})

describe("resolveTypeTransaction", () => {
  const typologies = [{ id: "t1", code: "CULTIVEE", nom: "Cultivée", parentId: null }]
  it("resolves by code", () => {
    expect(resolveTypeTransaction("CULTIVEE", typologies)?.id).toBe("t1")
  })
  it("falls back to the display name (importer writes the name)", () => {
    expect(resolveTypeTransaction("Cultivée", typologies)?.id).toBe("t1")
  })
  it("returns null for an unknown value", () => {
    expect(resolveTypeTransaction("NOPE", typologies)).toBeNull()
  })
})

describe("validateFiche", () => {
  const superficieTotale = champ({ id: "tot", codeMachine: "superficie_totale_hectare", unite: "ha" })
  const cultivee = champ({ id: "cult", codeMachine: "superficie_cultivee", unite: "ha" })
  const boisee = champ({ id: "bois", codeMachine: "superficie_boisee", unite: "ha" })
  const pourcent = champ({ id: "pct", codeMachine: "peuplement_feuillu", unite: "%" })

  const baseChamps: ChampEnrichissableConfig[] = [superficieTotale, cultivee, boisee, pourcent]

  const baseFor = (champs: ChampEnrichissableConfig[]) => ({
    champs,
    sections: [{ id: "s1", nom: "Section", ordre: 0, champs: champs.map((c) => c.id) }],
    source: { superficie_totale_hectare: 40 },
    typeCode: "CULTIVEE" as string | null,
    dateVente: null as string | null,
  })

  it("passes a coherent fiche", () => {
    expect(validateFiche({ ...baseFor(baseChamps), valeurs: { superficie_cultivee: 10, superficie_boisee: 20 } })).toEqual([])
  })

  it("blocks when the type is missing, pointing at the type select", () => {
    const errors = validateFiche({ ...baseFor(baseChamps), typeCode: null, valeurs: {} })
    const typeErr = errors.find((e) => e.code === "V-TYPE")
    expect(typeErr?.champ).toBe(TYPE_TRANSACTION_CODE)
    expect(typeErr?.message).toBe("Le type de transaction est obligatoire.")
  })

  it("blocks a mandatory field left empty, naming it", () => {
    const required = champ({ id: "r", codeMachine: "note", nomAffichage: "Note d'évaluation", estObligatoire: true })
    const errors = validateFiche({ ...baseFor([...baseChamps, required]), valeurs: {} })
    expect(errors.find((e) => e.code === "V-OBLIG")).toEqual({
      code: "V-OBLIG",
      champ: "note",
      message: "Le champ « Note d'évaluation » est obligatoire.",
    })
  })

  it("applies V-001 (components exceed the total)", () => {
    const errors = validateFiche({ ...baseFor(baseChamps), valeurs: { superficie_cultivee: 30, superficie_boisee: 20 } })
    expect(errors.some((e) => e.code === "V-001")).toBe(true)
  })

  it("applies V-003 (percentage over 100)", () => {
    const errors = validateFiche({ ...baseFor(baseChamps), valeurs: { peuplement_feuillu: 120 } })
    expect(errors.find((e) => e.code === "V-003")?.champ).toBe("peuplement_feuillu")
  })

  it("applies V-006 (negative value)", () => {
    const errors = validateFiche({ ...baseFor(baseChamps), valeurs: { superficie_cultivee: -1 } })
    expect(errors.find((e) => e.code === "V-006")?.champ).toBe("superficie_cultivee")
  })

  it("applies V-007 (out of the configured range)", () => {
    const ranged = champ({ id: "g", codeMachine: "pente", plageMin: 0, plageMax: 20 })
    const errors = validateFiche({ ...baseFor([...baseChamps, ranged]), valeurs: { pente: 45 } })
    expect(errors.find((e) => e.code === "V-007")?.champ).toBe("pente")
  })

  it("keeps a MULTI_SELECT value out of the numeric rules", () => {
    const cultures = champ({ id: "mc", codeMachine: "type_de_culture", typeDonnees: "MULTI_SELECT", unite: "N/A" })
    // "-5" would trip V-006 if a MULTI_SELECT value were coerced to a number.
    const errors = validateFiche({ ...baseFor([...baseChamps, cultures]), valeurs: { type_de_culture: "-5" } })
    expect(errors.some((e) => e.champ === "type_de_culture")).toBe(false)
  })

  it("attaches each rule to the champ to correct", () => {
    const boiseImporter = champ({ id: "bi", codeMachine: "superficie_boise_ha", unite: "ha" })
    const acericoleImporter = champ({ id: "ai", codeMachine: "superficie_acricole_ha", unite: "ha" })
    const cultiveImporter = champ({ id: "ci", codeMachine: "superficie_cultive_ha", unite: "ha" })
    const draineImporter = champ({ id: "di", codeMachine: "superficie_draine_ha", unite: "ha" })
    const errors = validateFiche({
      ...baseFor([...baseChamps, boiseImporter, acericoleImporter, cultiveImporter, draineImporter]),
      valeurs: {
        superficie_cultivee: 30,
        superficie_boisee: 20,
        superficie_acricole_ha: 30,
        superficie_draine_ha: 40,
        peuplement_feuillu: 120,
      },
    })
    const byCode = (code: string) => errors.find((e) => e.code === code)
    expect(byCode("V-001")?.champ).toBeNull()
    expect(byCode("V-002")?.champ).toBe("superficie_draine_ha")
    expect(byCode("V-003")?.champ).toBe("peuplement_feuillu")
    expect(byCode("V-005")?.champ).toBe("superficie_acricole_ha")
  })

  it("applies V-004 (future sale date)", () => {
    const future = new Date()
    future.setDate(future.getDate() + 5)
    const errors = validateFiche({ ...baseFor(baseChamps), dateVente: future.toISOString(), valeurs: {} })
    expect(errors.some((e) => e.code === "V-004")).toBe(true)
  })

  it("ignores a type-scoped mandatory champ when the type does not match", () => {
    const scoped = champ({ id: "sb", codeMachine: "note_boisee", estObligatoire: true, applicableATypes: ["BOISEE"] })
    const errors = validateFiche({ ...baseFor([...baseChamps, scoped]), typeCode: "CULTIVEE", valeurs: {} })
    expect(errors.some((e) => e.code === "V-OBLIG")).toBe(false)
  })

  it("applies V-OBLIG to a type-scoped mandatory champ when the type matches", () => {
    const scoped = champ({ id: "sb", codeMachine: "note_boisee", estObligatoire: true, applicableATypes: ["BOISEE"] })
    const errors = validateFiche({ ...baseFor([...baseChamps, scoped]), typeCode: "BOISEE", valeurs: {} })
    expect(errors.some((e) => e.code === "V-OBLIG")).toBe(true)
  })

  it("applies V-005 on the real importer codes (acricole_ha > boise_ha)", () => {
    const boiseImporter = champ({ id: "bi", codeMachine: "superficie_boise_ha", unite: "ha" })
    const acericoleImporter = champ({ id: "ai", codeMachine: "superficie_acricole_ha", unite: "ha" })
    const errors = validateFiche({
      ...baseFor([...baseChamps, boiseImporter, acericoleImporter]),
      valeurs: { superficie_boise_ha: 20, superficie_acricole_ha: 30 },
    })
    expect(errors.some((e) => e.code === "V-005")).toBe(true)
  })

  it("applies V-002 on the real importer codes (draine_ha > cultive_ha)", () => {
    const cultiveImporter = champ({ id: "ci", codeMachine: "superficie_cultive_ha", unite: "ha" })
    const draineImporter = champ({ id: "di", codeMachine: "superficie_draine_ha", unite: "ha" })
    const errors = validateFiche({
      ...baseFor([...baseChamps, cultiveImporter, draineImporter]),
      valeurs: { superficie_cultive_ha: 10, superficie_draine_ha: 15 },
    })
    expect(errors.some((e) => e.code === "V-002")).toBe(true)
  })

  it("resolves an accented superficie code against the normalized root", () => {
    const boiseImporter = champ({ id: "bi", codeMachine: "superficie_boise_ha", unite: "ha" })
    const acericoleAccent = champ({ id: "aa", codeMachine: "superficie_acéricole", unite: "ha" })
    const errors = validateFiche({
      ...baseFor([...baseChamps, boiseImporter, acericoleAccent]),
      valeurs: { superficie_boise_ha: 20, superficie_acéricole: 30 },
    })
    expect(errors.some((e) => e.code === "V-005")).toBe(true)
  })

  it("does not block on an obligatory champ that is hidden (estAffiche=false)", () => {
    const hidden = champ({ id: "h", codeMachine: "cache", estObligatoire: true, estAffiche: false })
    const errors = validateFiche({ ...baseFor([...baseChamps, hidden]), valeurs: {} })
    expect(errors.some((e) => e.code === "V-OBLIG")).toBe(false)
  })

  it("does not block on an obligatory champ that is not placed in any section", () => {
    const unplaced = champ({ id: "u", codeMachine: "orphelin", estObligatoire: true })
    const errors = validateFiche({ ...baseFor(baseChamps), champs: [...baseChamps, unplaced], valeurs: {} })
    expect(errors.some((e) => e.code === "V-OBLIG")).toBe(false)
  })
})

describe("buildStorageEntries", () => {
  it("persists filled champs and the type de transaction, dropping empty ones", () => {
    const a = champ({ id: "a", codeMachine: "a", typeDonnees: "DECIMAL" })
    const t = champ({ id: "t", codeMachine: TYPE_TRANSACTION_CODE, typeDonnees: "LISTE" })
    const entries = buildStorageEntries([a, t], { a: 5, b: null }, "CULTIVEE")
    expect(entries).toEqual([
      { champEnrichissableId: "a", valeurNombre: 5, valeurTexte: null, valeurBooleen: null },
      { champEnrichissableId: "t", valeurNombre: null, valeurTexte: "CULTIVEE", valeurBooleen: null },
    ])
  })
})
