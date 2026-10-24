import Decimal from "decimal.js"
import type { Prisma } from "@prisma/client"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ChampEnrichissableConfig } from "@/types/champ"

vi.mock("@/repositories/calcul.repository", () => ({
  applyValeursCalculees: vi.fn(),
  listTransactionValeursByOrganisation: vi.fn(),
}))
vi.mock("@/repositories/champs.repository", () => ({
  listChampsEnrichissablesByOrganisation: vi.fn(),
}))

import { applyValeursCalculees, listTransactionValeursByOrganisation } from "@/repositories/calcul.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { computeCalculatedEnrichment, recalculerChampsCalcules } from "@/services/calcul.service"

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
    typeFiltreRecommande: null,
    estLectureSeule: false,
    actif: true,
    ...overrides,
  }
}

const prixVente = champ({ id: "p", codeMachine: "prix_vente", typeDonnees: "ENTIER" })
const superficie = champ({ id: "s", codeMachine: "superficie_totale_hectare", typeDonnees: "DECIMAL" })
const tauxEntier = champ({
  id: "t",
  codeMachine: "taux_entier",
  typeDonnees: "ENTIER",
  nature: "CALCULE",
  regleCalcul: "prix_vente / superficie_totale_hectare",
})
const tauxDecimal = champ({
  id: "d",
  codeMachine: "taux_decimal",
  typeDonnees: "DECIMAL",
  nature: "CALCULE",
  regleCalcul: "prix_vente / superficie_totale_hectare",
})

// Prisma returns Decimal instances; decimal.js is the same engine, so the cast only satisfies the row type.
function dec(n: number): Prisma.Decimal {
  return new Decimal(n) as unknown as Prisma.Decimal
}

beforeEach(() => {
  vi.mocked(applyValeursCalculees).mockReset()
  vi.mocked(listTransactionValeursByOrganisation).mockReset()
  vi.mocked(listChampsEnrichissablesByOrganisation).mockReset()
})

describe("computeCalculatedEnrichment", () => {
  it("derives the CALCULE value from the enrichment values of the transaction", () => {
    const result = computeCalculatedEnrichment(
      [prixVente, superficie, tauxEntier],
      [
        { champId: "p", valeurNombre: { toNumber: () => 100000 } },
        { champId: "s", valeurNombre: { toNumber: () => 30 } },
      ]
    )
    expect(result).toEqual([{ champId: "t", valeurNombre: new Decimal(3333) }])
  })

  it("follows the precision of the calculated champ type", () => {
    const values = [
      { champId: "p", valeurNombre: { toNumber: () => 100 } },
      { champId: "s", valeurNombre: { toNumber: () => 3 } },
    ]
    const result = computeCalculatedEnrichment([prixVente, superficie, tauxEntier, tauxDecimal], values)
    expect(result).toEqual([
      { champId: "t", valeurNombre: new Decimal(33) },
      { champId: "d", valeurNombre: new Decimal(33.33) },
    ])
  })

  it("gives no value when the calculation yields no result (division by zero)", () => {
    const result = computeCalculatedEnrichment(
      [prixVente, superficie, tauxEntier],
      [
        { champId: "p", valeurNombre: { toNumber: () => 100 } },
        { champId: "s", valeurNombre: { toNumber: () => 0 } },
      ]
    )
    expect(result).toEqual([])
  })

  it("gives no value when an operand is missing from the transaction", () => {
    const result = computeCalculatedEnrichment(
      [prixVente, superficie, tauxEntier],
      [{ champId: "p", valeurNombre: { toNumber: () => 100 } }]
    )
    expect(result).toEqual([])
  })

  it("ignores values of champs outside the catalogue and empty values", () => {
    const result = computeCalculatedEnrichment(
      [prixVente, superficie, tauxEntier],
      [
        { champId: "inconnu", valeurNombre: { toNumber: () => 5 } },
        { champId: "p", valeurNombre: null },
        { champId: "s", valeurNombre: { toNumber: () => 10 } },
      ]
    )
    expect(result).toEqual([])
  })
})

describe("recalculerChampsCalcules", () => {
  it("does nothing when the organisation has no CALCULE champ", async () => {
    vi.mocked(listChampsEnrichissablesByOrganisation).mockResolvedValue([prixVente, superficie])

    await recalculerChampsCalcules("org-1")

    expect(listTransactionValeursByOrganisation).not.toHaveBeenCalled()
    expect(applyValeursCalculees).not.toHaveBeenCalled()
  })

  it("writes only the stored values that differ from the rule's result", async () => {
    vi.mocked(listChampsEnrichissablesByOrganisation).mockResolvedValue([prixVente, superficie, tauxEntier])
    vi.mocked(listTransactionValeursByOrganisation).mockResolvedValue([
      {
        // Stored value already matches the rule: no write.
        id: "tx-ok",
        valeurs: [
          { champId: "p", valeurNombre: dec(100000), champ: { codeMachine: "prix_vente" } },
          { champId: "s", valeurNombre: dec(30), champ: { codeMachine: "superficie_totale_hectare" } },
          { champId: "t", valeurNombre: dec(3333), champ: { codeMachine: "taux_entier" } },
        ],
      },
      {
        // Stale stored value: rewritten.
        id: "tx-stale",
        valeurs: [
          { champId: "p", valeurNombre: dec(100000), champ: { codeMachine: "prix_vente" } },
          { champId: "s", valeurNombre: dec(30), champ: { codeMachine: "superficie_totale_hectare" } },
          { champId: "t", valeurNombre: dec(1), champ: { codeMachine: "taux_entier" } },
        ],
      },
      {
        // Operand present but no stored CALCULE value: created.
        id: "tx-missing",
        valeurs: [
          { champId: "p", valeurNombre: dec(1000), champ: { codeMachine: "prix_vente" } },
          { champId: "s", valeurNombre: dec(10), champ: { codeMachine: "superficie_totale_hectare" } },
        ],
      },
      {
        // Stored value but the operands no longer yield a result: removed (null).
        id: "tx-null",
        valeurs: [
          { champId: "p", valeurNombre: dec(1000), champ: { codeMachine: "prix_vente" } },
          { champId: "s", valeurNombre: dec(0), champ: { codeMachine: "superficie_totale_hectare" } },
          { champId: "t", valeurNombre: dec(50), champ: { codeMachine: "taux_entier" } },
        ],
      },
    ] as never)

    await recalculerChampsCalcules("org-1")

    expect(applyValeursCalculees).toHaveBeenCalledTimes(1)
    expect(applyValeursCalculees).toHaveBeenCalledWith([
      { transactionId: "tx-stale", champId: "t", valeurNombre: 3333 },
      { transactionId: "tx-missing", champId: "t", valeurNombre: 100 },
      { transactionId: "tx-null", champId: "t", valeurNombre: null },
    ])
  })

  it("does not write when every stored value is already up to date", async () => {
    vi.mocked(listChampsEnrichissablesByOrganisation).mockResolvedValue([prixVente, superficie, tauxEntier])
    vi.mocked(listTransactionValeursByOrganisation).mockResolvedValue([
      {
        id: "tx-ok",
        valeurs: [
          { champId: "p", valeurNombre: dec(100), champ: { codeMachine: "prix_vente" } },
          { champId: "s", valeurNombre: dec(3), champ: { codeMachine: "superficie_totale_hectare" } },
          { champId: "t", valeurNombre: dec(33), champ: { codeMachine: "taux_entier" } },
        ],
      },
    ] as never)

    await recalculerChampsCalcules("org-1")

    expect(applyValeursCalculees).not.toHaveBeenCalled()
  })

  it("writes the changes in batches of 500", async () => {
    vi.mocked(listChampsEnrichissablesByOrganisation).mockResolvedValue([prixVente, superficie, tauxEntier])
    const transactions = Array.from({ length: 501 }, (_, i) => ({
      id: `tx-${i}`,
      valeurs: [
        { champId: "p", valeurNombre: dec(100), champ: { codeMachine: "prix_vente" } },
        { champId: "s", valeurNombre: dec(10), champ: { codeMachine: "superficie_totale_hectare" } },
      ],
    }))
    vi.mocked(listTransactionValeursByOrganisation).mockResolvedValue(transactions as never)

    await recalculerChampsCalcules("org-1")

    expect(applyValeursCalculees).toHaveBeenCalledTimes(2)
    expect(vi.mocked(applyValeursCalculees).mock.calls[0][0]).toHaveLength(500)
    expect(vi.mocked(applyValeursCalculees).mock.calls[1][0]).toHaveLength(1)
  })
})
