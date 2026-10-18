import { describe, it, expect } from "vitest"
import {
  ADJUSTED_EXPORT_COLUMNS,
  buildExportColumns,
  buildExportFileName,
  buildExportTable,
  computeAdjustedValues,
  computePrixActualise,
  toCellValue,
} from "@/lib/excel-export"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import type { ChampEnrichissableConfig } from "@/types/champ"
import type { SerializedTransaction } from "@/types/transaction"

function tx(fields: SerializedTransaction["fields"]): SerializedTransaction {
  return {
    id: "t1",
    statut: "ANALYSEE",
    fields,
    latitude: null,
    longitude: null,
    importationId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

function champ(overrides: Partial<ChampEnrichissableConfig>): ChampEnrichissableConfig {
  return {
    id: "c1",
    codeMachine: "superficie_cultivee",
    nomAffichage: "Superficie cultivée (ha)",
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
    typeFiltreRecommande: null,
    estLectureSeule: false,
    actif: true,
    ...overrides,
  }
}

const params = {
  tauxCroissancePct: 5,
  dateEvaluation: "2026-01-01",
  tauxBoiseRef: 1000,
  tauxCultiveRef: 2000,
  valeurBatiment: 10000,
  valeurMaison: 5000,
  valeurTerrainResidentiel: 5000,
}

describe("computePrixActualise", () => {
  it("capitalise le prix sur une année à 5 %", () => {
    const value = computePrixActualise(
      { prix_vente: 100000, date_vente: "2025-01-01T00:00:00.000Z" },
      { tauxCroissancePct: 5, dateEvaluation: "2026-01-01" }
    )
    expect(value).toBe(105000)
  })

  it("renvoie null quand le prix ou la date de vente manque", () => {
    expect(
      computePrixActualise({ date_vente: "2025-01-01T00:00:00.000Z" }, params)
    ).toBeNull()
    expect(computePrixActualise({ prix_vente: 100000 }, params)).toBeNull()
    expect(computePrixActualise({ prix_vente: 100000, date_vente: "invalide" }, params)).toBeNull()
  })
})

describe("buildExportColumns", () => {
  it("classe les colonnes par catégorie et ajoute les indicateurs ajustés", () => {
    const columns = buildExportColumns(IMPORTED_FIELDS, [
      champ({ codeMachine: "superficie_boisee", nomAffichage: "Superficie boisée (ha)", ordreAffichage: 2 }),
      champ({ codeMachine: "taux_global", nomAffichage: "Taux global ($/ha)", nature: "CALCULE", ordreAffichage: 1 }),
      champ({ codeMachine: "champ_inactif", actif: false }),
      champ({ codeMachine: "prix_vente", nature: "IMPORTE" }),
    ])

    const keys = columns.map((c) => c.key)
    expect(keys.slice(0, IMPORTED_FIELDS.length)).toEqual(IMPORTED_FIELDS.map((f) => f.code))
    expect(keys.slice(IMPORTED_FIELDS.length, -ADJUSTED_EXPORT_COLUMNS.length)).toEqual([
      "taux_global",
      "superficie_boisee",
    ])
    expect(keys.slice(-ADJUSTED_EXPORT_COLUMNS.length)).toEqual(ADJUSTED_EXPORT_COLUMNS.map((c) => c.key))

    expect(columns.find((c) => c.key === "taux_global")?.nature).toBe("calcule")
    expect(columns.find((c) => c.key === "superficie_boisee")?.nature).toBe("saisissable")
    expect(columns.some((c) => c.key === "champ_inactif")).toBe(false)
    // Un code déjà couvert par le catalogue importé n'est pas proposé deux fois.
    expect(columns.filter((c) => c.key === "prix_vente")).toHaveLength(1)
  })

  it("rend visibles par défaut les champs importés marqués et les champs affichés", () => {
    const columns = buildExportColumns(IMPORTED_FIELDS, [
      champ({ codeMachine: "affiche", estAffiche: true }),
      champ({ codeMachine: "masque", estAffiche: false }),
    ])
    expect(columns.find((c) => c.key === "numero_inscription")?.defaultVisible).toBe(true)
    expect(columns.find((c) => c.key === "vendeur")?.defaultVisible).toBe(false)
    expect(columns.find((c) => c.key === "affiche")?.defaultVisible).toBe(true)
    expect(columns.find((c) => c.key === "masque")?.defaultVisible).toBe(false)
  })
})

describe("computeAdjustedValues", () => {
  const fields = {
    prix_vente: 100000,
    date_vente: "2025-01-01T00:00:00.000Z",
    superficie_totale_hectare: 10,
    superficie_cultivee: 6,
    superficie_boisee: 4,
    superficie_batiment: 1000,
    nombre_entailles: 500,
  }

  it("applique les formules des indicateurs ajustés", () => {
    const adjusted = computeAdjustedValues(fields, params)
    expect(adjusted.prix_actualise).toBe(105000)
    expect(adjusted.taux_global_ajuste).toBe(10500)
    expect(adjusted.taux_residuel_cultive_ajuste).toBe(
      Math.round((105000 - 4 * 1000 - 20000) / 6)
    )
    expect(adjusted.taux_residuel_boise_ajuste).toBe(
      Math.round((105000 - 6 * 2000 - 20000) / 4)
    )
    expect(adjusted.taux_residuel_batiment_ajuste).toBe(
      Math.round((105000 - 6 * 2000 - 4 * 1000 - 5000 - 5000) / 1000)
    )
    expect(adjusted.taux_par_entaille_ajuste).toBe(
      Math.round((105000 - 6 * 2000 - 4 * 1000 - 20000) / 500)
    )
  })

  it("laisse vides les indicateurs dont la surface manque ou est nulle", () => {
    const adjusted = computeAdjustedValues(
      { prix_vente: 100000, date_vente: "2025-01-01T00:00:00.000Z", superficie_cultivee: 0 },
      params
    )
    expect(adjusted.taux_global_ajuste).toBeNull()
    expect(adjusted.taux_residuel_cultive_ajuste).toBeNull()
    expect(adjusted.taux_residuel_boise_ajuste).toBeNull()
    expect(adjusted.taux_residuel_batiment_ajuste).toBeNull()
    expect(adjusted.taux_par_entaille_ajuste).toBeNull()
    expect(adjusted.prix_actualise).toBe(105000)
  })
})

describe("toCellValue", () => {
  it("conserve les nombres, met les dates à plat et joint les listes", () => {
    expect(toCellValue(75000, "DECIMAL")).toBe(75000)
    expect(toCellValue("2024-03-01T00:00:00.000Z", "DATE")).toBe("2024-03-01")
    expect(toCellValue(["L1", "L2"], "TEXTE_MULTIPLE")).toBe("L1, L2")
    expect(toCellValue("false", "BOOLEAN")).toBe("Non")
    expect(toCellValue(null, "TEXTE")).toBeNull()
    expect(toCellValue("", "TEXTE")).toBeNull()
  })
})

describe("buildExportTable", () => {
  it("respecte les colonnes choisies et calcule les indicateurs ajustés", () => {
    const table = buildExportTable({
      transactions: [
        tx({
          numero_inscription: "A",
          date_vente: "2025-01-01T00:00:00.000Z",
          prix_vente: 100000,
        }),
      ],
      importedFields: IMPORTED_FIELDS,
      champs: [],
      params,
      selectedKeys: ["numero_inscription", "date_vente", "prix_vente", "prix_actualise"],
    })

    expect(table.header).toEqual(["N° d'inscription", "Date de vente", "Prix à l'acte", "Prix actualisé"])
    expect(table.rows).toEqual([["A", "2025-01-01", 100000, 105000]])
  })
})

describe("buildExportFileName", () => {
  it("dérive un nom de fichier propre du nom du panier", () => {
    expect(buildExportFileName("Érablière Saint-Joseph")).toBe("export-erabliere-saint-joseph.xlsx")
    expect(buildExportFileName("")).toBe("export-panier.xlsx")
  })
})
