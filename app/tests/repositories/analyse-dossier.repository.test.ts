import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  createAnalyse,
  deleteAnalyse,
  listIndicateursForAnalyse,
  type AnalyseDossierData,
} from "@/repositories/analyse-dossier.repository"
import { recalculateAnalysesForDossier } from "@/server/analyse-dossier"

let orgId = ""
let dossierId = ""
let panierAId = ""
let panierBId = ""
let txAId = ""
let txBId = ""

const analyseData: AnalyseDossierData = {
  dateEvaluation: new Date("2026-10-01T00:00:00.000Z"),
  tauxCroissance: 0.05,
  tauxBoiseRef: null,
  tauxCultiveRef: null,
  valeurBatimentRef: null,
  valeurMaisonRef: null,
  valeurTerrainResidentielRef: null,
}

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Analyse Repo Org" } })
  orgId = org.id
  const dossier = await prisma.dossier.create({ data: { organisationId: orgId, numeroDossier: "25-AN-001" } })
  dossierId = dossier.id
  panierAId = (await prisma.panier.create({ data: { organisationId: orgId, dossierId, nom: "A" } })).id
  panierBId = (await prisma.panier.create({ data: { organisationId: orgId, dossierId, nom: "B" } })).id
  txAId = (await prisma.transaction.create({ data: { organisationId: orgId, systemeSource: "TEST" } })).id
  txBId = (await prisma.transaction.create({ data: { organisationId: orgId, systemeSource: "TEST" } })).id
})

afterAll(async () => {
  await prisma.indicateursAjustes.deleteMany({ where: { analyseDossier: { organisationId: orgId } } })
  await prisma.analyseDossier.deleteMany({ where: { organisationId: orgId } })
  await prisma.panierTransaction.deleteMany({ where: { panier: { organisationId: orgId } } })
  await prisma.panier.deleteMany({ where: { organisationId: orgId } })
  await prisma.dossier.deleteMany({ where: { organisationId: orgId } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.deleteMany({ where: { id: orgId } })
})

describe("analyse de dossier : recalcul et suppression", () => {
  it("calcule une ligne par transaction des paniers du dossier", async () => {
    await prisma.panierTransaction.createMany({
      data: [
        { panierId: panierAId, transactionId: txAId },
        { panierId: panierBId, transactionId: txBId },
      ],
    })
    const analyse = await createAnalyse(orgId, dossierId, analyseData)
    await recalculateAnalysesForDossier(orgId, dossierId)

    const rows = await listIndicateursForAnalyse(orgId, analyse.id, [txAId, txBId])
    expect(rows.map((r) => r.transactionId).sort()).toEqual([txAId, txBId].sort())
  })

  it("supprime la ligne d'une transaction retirée de tous les paniers", async () => {
    const analyse = (await prisma.analyseDossier.findFirstOrThrow({ where: { organisationId: orgId, dossierId } }))
    await prisma.panierTransaction.deleteMany({ where: { transactionId: txBId } })
    await recalculateAnalysesForDossier(orgId, dossierId)

    const rows = await listIndicateursForAnalyse(orgId, analyse.id, [txAId, txBId])
    expect(rows.map((r) => r.transactionId)).toEqual([txAId])
  })

  it("supprime l'analyse et ses indicateurs", async () => {
    const analyse = await prisma.analyseDossier.findFirstOrThrow({ where: { organisationId: orgId, dossierId } })
    await deleteAnalyse(orgId, analyse.id)

    expect(await prisma.analyseDossier.count({ where: { id: analyse.id } })).toBe(0)
    expect(await prisma.indicateursAjustes.count({ where: { analyseDossierId: analyse.id } })).toBe(0)
  })
})
