import { describe, it, expect } from "vitest"
import {
  TYPE_TRANSACTION_CODE,
  buildFicheViewModel,
  deriveFicheMode,
  formatFicheValue,
  formatSourceFieldValue,
  isChampApplicable,
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
