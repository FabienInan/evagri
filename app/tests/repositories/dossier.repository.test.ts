import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"

let orgId = ""
let dossierId = ""
let panierId = ""
let analyseeId = ""
const previousOrganisationId = process.env.DEFAULT_ORGANISATION_ID

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Dossier Repo Org" } })
  orgId = org.id
  const dossier = await prisma.dossier.create({ data: { organisationId: orgId, numeroDossier: "25-AB-001" } })
  dossierId = dossier.id
  const panier = await prisma.panier.create({
    data: { organisationId: orgId, dossierId, nom: "Panier test" },
  })
  panierId = panier.id
  const tx = await prisma.transaction.create({
    data: { organisationId: orgId, systemeSource: "TEST", statut: "ANALYSEE" },
  })
  analyseeId = tx.id
})

afterAll(async () => {
  await prisma.panierTransaction.deleteMany({ where: { panier: { organisationId: orgId } } })
  await prisma.panier.deleteMany({ where: { organisationId: orgId } })
  await prisma.dossier.deleteMany({ where: { organisationId: orgId } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
  if (previousOrganisationId === undefined) delete process.env.DEFAULT_ORGANISATION_ID
  else process.env.DEFAULT_ORGANISATION_ID = previousOrganisationId
})

describe("dossier.repository", () => {
  it("ajoute une transaction au panier", async () => {
    const { addTransactionsToPanier } = await import("@/repositories/dossier.repository")
    expect(await addTransactionsToPanier(panierId, [analyseeId])).toBe(1)
    expect(await addTransactionsToPanier(panierId, [analyseeId])).toBe(0) // idempotent (skipDuplicates)
    expect(await prisma.panierTransaction.count({ where: { panierId } })).toBe(1)
  })

  it("liste les transactions du panier", async () => {
    const { listTransactionsOfPanier } = await import("@/repositories/dossier.repository")
    const rows = await listTransactionsOfPanier(panierId)
    expect(rows.map((t) => t.id)).toContain(analyseeId)
  })

  it("retire une transaction du panier (idempotent si absente)", async () => {
    const { removeTransactionFromPanier } = await import("@/repositories/dossier.repository")
    await removeTransactionFromPanier(panierId, analyseeId)
    expect(await prisma.panierTransaction.count({ where: { panierId } })).toBe(0)
    await expect(removeTransactionFromPanier(panierId, analyseeId)).resolves.toBeUndefined()
  })

  it("compte les transactions éligibles (ANALYSEE seulement)", async () => {
    const { countEligibleTransactions } = await import("@/repositories/dossier.repository")
    const nonAnalysee = await prisma.transaction.create({
      data: { organisationId: orgId, systemeSource: "TEST", statut: "NON_ANALYSEE" },
    })
    expect(await countEligibleTransactions(orgId, [analyseeId, nonAnalysee.id])).toBe(1)
  })

  it("liste les dossiers avec le nombre de paniers", async () => {
    const { listDossiers } = await import("@/repositories/dossier.repository")
    const rows = await listDossiers(orgId)
    const row = rows.find((d) => d.id === dossierId)
    expect(row?._count.paniers).toBe(1)
  })
})
