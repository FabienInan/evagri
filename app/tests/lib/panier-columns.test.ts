import { describe, expect, it } from "vitest"
import {
  PANIER_COLUMNS_BY_TYPE,
  collectFieldCodes,
  isWithinOneEdit,
  panierColumnsForType,
  resolvePanierFieldCode,
} from "@/lib/panier-columns"
import { buildExportColumns } from "@/lib/excel-export"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import type { ChampEnrichissableConfig } from "@/types/champ"

const TYPES = ["TERRES_CULTIVEES", "TERRES_BOISEES", "ERABLIERES", "FERME", "BATIMENTS_AGRICOLES"]

describe("resolvePanierFieldCode", () => {
  it("garde le nom exact quand il existe", () => {
    expect(resolvePanierFieldCode("superficie_cultive_ha", ["superficie_cultive_ha", "superficie_cultivee_ha"])).toBe(
      "superficie_cultive_ha"
    )
  })

  it("ignore la casse et les accents", () => {
    expect(resolvePanierFieldCode("superficie_cultive_ha", ["Superficie_Cultivée_HA"])).toBe("Superficie_Cultivée_HA")
  })

  it("accepte une seule lettre d'écart", () => {
    expect(resolvePanierFieldCode("superficie_cultive_ha", ["superficie_cultivee_ha"])).toBe("superficie_cultivee_ha")
    expect(resolvePanierFieldCode("batiments_agricole", ["batiments_agricoles"])).toBe("batiments_agricoles")
  })

  it("renvoie null sans correspondance ou quand le rapprochement est ambigu", () => {
    expect(resolvePanierFieldCode("topographie", ["observations"])).toBeNull()
    expect(resolvePanierFieldCode("maison", ["maisonx", "maisony"])).toBeNull()
  })
})

describe("isWithinOneEdit", () => {
  it("compte substitution, insertion et suppression", () => {
    expect(isWithinOneEdit("abc", "abd")).toBe(true)
    expect(isWithinOneEdit("abc", "abcd")).toBe(true)
    expect(isWithinOneEdit("abc", "ac")).toBe(true)
    expect(isWithinOneEdit("abc", "axxc")).toBe(false)
  })
})

describe("panierColumnsForType", () => {
  it("renvoie null sans type connu", () => {
    expect(panierColumnsForType(null)).toBeNull()
    expect(panierColumnsForType("INCONNU")).toBeNull()
  })

  it("donne les colonnes prévues pour chacun des cinq types", () => {
    for (const type of TYPES) {
      const columns = panierColumnsForType(type)
      expect(columns, type).not.toBeNull()
      expect(columns!.map((c) => c.label)).toContain("N° d'inscription")
      expect(columns!.map((c) => c.label)).toContain("Prix de vente ajusté")
    }
  })

  it("ne répète aucune clé à l'intérieur d'un type", () => {
    for (const type of Object.keys(PANIER_COLUMNS_BY_TYPE)) {
      const keys = PANIER_COLUMNS_BY_TYPE[type].map((c) => c.key)
      expect(new Set(keys).size, type).toBe(keys.length)
    }
  })

  it("donne les taux ajustés, pas les taux à l'acte, pour les terres cultivées", () => {
    const keys = panierColumnsForType("TERRES_CULTIVEES")!.map((c) => c.key)
    expect(keys).toContain("taux_global_ajuste")
    expect(keys).toContain("taux_residuel_cultive_ajuste")
    expect(keys).not.toContain("taux_global")
  })
})

describe("buildExportColumns avec un type", () => {
  const champs: ChampEnrichissableConfig[] = [
    {
      id: "1",
      codeMachine: "superficie_cultive_ha",
      nomAffichage: "Superficie cultivée",
      typeDonnees: "DECIMAL",
      nature: "SAISISSABLE",
      unite: "ha",
      actif: true,
      estAffiche: true,
      ordreAffichage: 0,
    } as unknown as ChampEnrichissableConfig,
  ]

  it("place les colonnes du type en tête, dans l'ordre prévu, et décoche le reste", () => {
    const columns = buildExportColumns(IMPORTED_FIELDS, champs, "TERRES_BOISEES", ["superficie_cultive_ha"])
    const typed = columns.filter((c) => c.inType)
    expect(typed.map((c) => c.label)[0]).toBe("N° d'inscription")
    expect(typed.every((c) => c.defaultVisible)).toBe(true)
    expect(columns.filter((c) => !c.inType).every((c) => !c.defaultVisible)).toBe(true)
  })

  it("résout un nom absent de la base vers le champ réel proche", () => {
    const columns = buildExportColumns(IMPORTED_FIELDS, champs, "FERME", ["superficie_cultivee_ha"])
    const cultivee = columns.find((c) => c.label === "Superficie cultivée (ha)")
    expect(cultivee?.key).toBe("superficie_cultivee_ha")
  })

  it("sans type, garde les colonnes par défaut", () => {
    const columns = buildExportColumns(IMPORTED_FIELDS, champs)
    expect(columns.some((c) => c.inType)).toBe(false)
  })
})

describe("collectFieldCodes", () => {
  it("réunit codes des champs, importés et clés des transactions sans doublon", () => {
    const codes = collectFieldCodes(
      [{ codeMachine: "a" }],
      ["a", "b"],
      [{ fields: { b: 1, c: 2 } }]
    )
    expect(codes.sort()).toEqual(["a", "b", "c"])
  })
})
