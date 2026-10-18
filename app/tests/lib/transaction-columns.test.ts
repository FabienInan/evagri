import { describe, it, expect } from "vitest"
import { buildTransactionFieldColumns } from "@/lib/transaction-columns"
import type { ImportedField } from "@/lib/imported-fields"
import type { ChampEnrichissableConfig } from "@/types/champ"
import type { SerializedTransaction } from "@/types/transaction"

const importedFields: ImportedField[] = [
  {
    code: "prix_vente",
    label: "Prix à l'acte",
    typeDonnees: "DECIMAL",
    typeFiltreRecommande: "PLAGE_NUMERIQUE",
    entetesImport: { JLR: [], EXISTANT_EVAGRI: [] },
    numeric: true,
    display: { sortable: true, defaultVisible: true, minWidth: 140, priority: 7 },
  },
]

function champ(overrides: Partial<ChampEnrichissableConfig>): ChampEnrichissableConfig {
  return {
    id: "c1",
    codeMachine: "champ_calcule",
    nomAffichage: "Champ calculé",
    typeDonnees: "ENTIER",
    nature: "CALCULE",
    unite: "N/A",
    plageMin: null,
    plageMax: null,
    optionsListe: null,
    regleCalcul: null,
    applicableATypes: [],
    ordreAffichage: 0,
    estAffiche: true,
    estObligatoire: false,
    typeFiltreRecommande: null,
    estLectureSeule: true,
    actif: true,
    ...overrides,
  }
}

function row(fields: SerializedTransaction["fields"]): SerializedTransaction {
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

describe("buildTransactionFieldColumns", () => {
  it("place les champs importés avant les champs enrichissables", () => {
    const cols = buildTransactionFieldColumns({
      importedFields,
      champs: [champ({})],
    })
    expect(cols.map((c) => c.key)).toEqual(["prix_vente", "champ_calcule"])
  })

  it("conserve les hints d'affichage des champs importés", () => {
    const [col] = buildTransactionFieldColumns({ importedFields, champs: [] })
    expect(col.label).toBe("Prix à l'acte")
    expect(col.numeric).toBe(true)
    expect(col.defaultVisible).toBe(true)
    expect(col.minWidth).toBe(140)
    expect(col.priority).toBe(7)
  })

  it("exclut les champs inactifs et ceux déjà importés", () => {
    const cols = buildTransactionFieldColumns({
      importedFields,
      champs: [
        champ({ id: "c1", codeMachine: "mrc", nature: "IMPORTE" }),
        champ({ id: "c2", codeMachine: "champ_inactif", actif: false }),
        champ({ id: "c3", codeMachine: "champ_actif" }),
      ],
    })
    expect(cols.map((c) => c.key)).toEqual(["prix_vente", "champ_actif"])
  })

  it("rend les valeurs avec le formatage canonique", () => {
    const cols = buildTransactionFieldColumns({
      importedFields,
      champs: [champ({ codeMachine: "champ_calcule", typeDonnees: "DECIMAL" })],
    })
    const transaction = row({ prix_vente: 75000, champ_calcule: 1234.5 })
    expect(cols[0].render(transaction)).toMatch(/^75[\s\u00a0\u202f]?000$/)
    expect(cols[1].render(transaction)).toMatch(/^1[\s\u00a0\u202f]?234,5$/)
  })
})
