import { describe, it, expect } from "vitest"
import {
  TYPE_TRANSACTION_CODE,
  buildCalculationContext,
  buildFicheViewModel,
  buildSourceNumbers,
  deriveFicheMode,
  formatFicheValue,
  formatSourceFieldValue,
  isChampApplicable,
  recomputeIndicateurs,
  resolveTypeTransaction,
  toNumericValues,
  toStorageValue,
  validateFiche,
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
  it("returns all-null for an empty value", () => {
    expect(toStorageValue("TEXTE", "")).toEqual({ valeurNombre: null, valeurTexte: null, valeurBooleen: null })
    expect(toStorageValue("DECIMAL", null)).toEqual({ valeurNombre: null, valeurTexte: null, valeurBooleen: null })
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

  const base = {
    champs: [superficieTotale, cultivee, boisee, pourcent],
    source: { superficie_totale_hectare: 40 },
    typeCode: "CULTIVEE" as string | null,
    dateVente: null as string | null,
  }

  it("passes a coherent fiche", () => {
    expect(validateFiche({ ...base, valeurs: { superficie_cultivee: 10, superficie_boisee: 20 } })).toEqual([])
  })

  it("blocks when the type is missing", () => {
    const errors = validateFiche({ ...base, typeCode: null, valeurs: {} })
    expect(errors.some((e) => e.message.includes("type de transaction"))).toBe(true)
  })

  it("blocks a mandatory field left empty", () => {
    const required = champ({ id: "r", codeMachine: "note", estObligatoire: true })
    const errors = validateFiche({ ...base, champs: [...base.champs, required], valeurs: {} })
    expect(errors.some((e) => e.code === "V-OBLIG")).toBe(true)
  })

  it("applies V-001 (components exceed the total)", () => {
    const errors = validateFiche({ ...base, valeurs: { superficie_cultivee: 30, superficie_boisee: 20 } })
    expect(errors.some((e) => e.code === "V-001")).toBe(true)
  })

  it("applies V-003 (percentage over 100)", () => {
    const errors = validateFiche({ ...base, valeurs: { peuplement_feuillu: 120 } })
    expect(errors.some((e) => e.code === "V-003")).toBe(true)
  })

  it("applies V-006 (negative value)", () => {
    const errors = validateFiche({ ...base, valeurs: { superficie_cultivee: -1 } })
    expect(errors.some((e) => e.code === "V-006")).toBe(true)
  })

  it("applies V-007 (out of the configured range)", () => {
    const ranged = champ({ id: "g", codeMachine: "pente", plageMin: 0, plageMax: 20 })
    const errors = validateFiche({ ...base, champs: [...base.champs, ranged], valeurs: { pente: 45 } })
    expect(errors.some((e) => e.code === "V-007")).toBe(true)
  })

  it("applies V-004 (future sale date)", () => {
    const future = new Date()
    future.setDate(future.getDate() + 5)
    const errors = validateFiche({ ...base, dateVente: future.toISOString(), valeurs: {} })
    expect(errors.some((e) => e.code === "V-004")).toBe(true)
  })

  it("ignores a type-scoped mandatory champ when the type does not match", () => {
    const scoped = champ({ id: "sb", codeMachine: "note_boisee", estObligatoire: true, applicableATypes: ["BOISEE"] })
    const errors = validateFiche({ ...base, champs: [...base.champs, scoped], typeCode: "CULTIVEE", valeurs: {} })
    expect(errors.some((e) => e.code === "V-OBLIG")).toBe(false)
  })

  it("applies V-OBLIG to a type-scoped mandatory champ when the type matches", () => {
    const scoped = champ({ id: "sb", codeMachine: "note_boisee", estObligatoire: true, applicableATypes: ["BOISEE"] })
    const errors = validateFiche({ ...base, champs: [...base.champs, scoped], typeCode: "BOISEE", valeurs: {} })
    expect(errors.some((e) => e.code === "V-OBLIG")).toBe(true)
  })

  it("applies V-005 on the real importer codes (acricole_ha > boise_ha)", () => {
    const boiseImporter = champ({ id: "bi", codeMachine: "superficie_boise_ha", unite: "ha" })
    const acericoleImporter = champ({ id: "ai", codeMachine: "superficie_acricole_ha", unite: "ha" })
    const errors = validateFiche({
      ...base,
      champs: [...base.champs, boiseImporter, acericoleImporter],
      valeurs: { superficie_boise_ha: 20, superficie_acricole_ha: 30 },
    })
    expect(errors.some((e) => e.code === "V-005")).toBe(true)
  })

  it("applies V-002 on the real importer codes (draine_ha > cultive_ha)", () => {
    const cultiveImporter = champ({ id: "ci", codeMachine: "superficie_cultive_ha", unite: "ha" })
    const draineImporter = champ({ id: "di", codeMachine: "superficie_draine_ha", unite: "ha" })
    const errors = validateFiche({
      ...base,
      champs: [...base.champs, cultiveImporter, draineImporter],
      valeurs: { superficie_cultive_ha: 10, superficie_draine_ha: 15 },
    })
    expect(errors.some((e) => e.code === "V-002")).toBe(true)
  })
})
