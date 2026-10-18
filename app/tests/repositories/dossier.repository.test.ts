import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"

let orgId = ""
let dossierId = ""
let panierId = ""
let analyseeId = ""
let otherOrgId = ""
let otherPanierId = ""
let otherTransactionId = ""
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

  // Seconde organisation : ses paniers/transactions ne doivent jamais être touchés par les mutations de la
  // première, même si l'appelant fournit leurs identifiants.
  const otherOrg = await prisma.organisation.create({ data: { nom: "Test Dossier Repo Other Org" } })
  otherOrgId = otherOrg.id
  const otherDossier = await prisma.dossier.create({
    data: { organisationId: otherOrgId, numeroDossier: "25-AB-002" },
  })
  const otherPanier = await prisma.panier.create({
    data: { organisationId: otherOrgId, dossierId: otherDossier.id, nom: "Panier autre org" },
  })
  otherPanierId = otherPanier.id
  const otherTx = await prisma.transaction.create({
    data: { organisationId: otherOrgId, systemeSource: "TEST", statut: "ANALYSEE" },
  })
  otherTransactionId = otherTx.id
})

afterAll(async () => {
  await prisma.panierTransaction.deleteMany({ where: { panier: { organisationId: { in: [orgId, otherOrgId] } } } })
  await prisma.panier.deleteMany({ where: { organisationId: { in: [orgId, otherOrgId] } } })
  await prisma.dossier.deleteMany({ where: { organisationId: { in: [orgId, otherOrgId] } } })
  await prisma.transaction.deleteMany({ where: { organisationId: { in: [orgId, otherOrgId] } } })
  await prisma.organisation.deleteMany({ where: { id: { in: [orgId, otherOrgId] } } })
  if (previousOrganisationId === undefined) delete process.env.DEFAULT_ORGANISATION_ID
  else process.env.DEFAULT_ORGANISATION_ID = previousOrganisationId
})

describe("dossier.repository", () => {
  it("ajoute une transaction au panier", async () => {
    const { addTransactionsToPanier } = await import("@/repositories/dossier.repository")
    expect(await addTransactionsToPanier(orgId, panierId, [analyseeId])).toBe(1)
    expect(await addTransactionsToPanier(orgId, panierId, [analyseeId])).toBe(0) // idempotent (skipDuplicates)
    expect(await prisma.panierTransaction.count({ where: { panierId } })).toBe(1)
  })

  it("liste les transactions du panier", async () => {
    const { listTransactionsOfPanier } = await import("@/repositories/dossier.repository")
    const rows = await listTransactionsOfPanier(orgId, panierId)
    expect(rows.map((t) => t.id)).toContain(analyseeId)
  })

  it("retire une transaction du panier (idempotent si absente)", async () => {
    const { removeTransactionFromPanier } = await import("@/repositories/dossier.repository")
    await removeTransactionFromPanier(orgId, panierId, analyseeId)
    expect(await prisma.panierTransaction.count({ where: { panierId } })).toBe(0)
    await expect(removeTransactionFromPanier(orgId, panierId, analyseeId)).resolves.toBeUndefined()
  })

  it("refuse d'ajouter une transaction ou un panier d'une autre organisation", async () => {
    const { addTransactionsToPanier, listTransactionsOfPanier } = await import("@/repositories/dossier.repository")

    // Transaction de l'autre organisation dans notre panier.
    expect(await addTransactionsToPanier(orgId, panierId, [otherTransactionId])).toBe(0)
    expect(await prisma.panierTransaction.count({ where: { panierId } })).toBe(0)

    // Notre transaction dans le panier de l'autre organisation.
    expect(await addTransactionsToPanier(orgId, otherPanierId, [analyseeId])).toBe(0)
    expect(await prisma.panierTransaction.count({ where: { panierId: otherPanierId } })).toBe(0)

    // Lecture d'un panier étranger → liste vide.
    expect(await listTransactionsOfPanier(orgId, otherPanierId)).toEqual([])
  })

  it("refuse de retirer un lien d'une autre organisation", async () => {
    const { removeTransactionFromPanier } = await import("@/repositories/dossier.repository")
    await prisma.panierTransaction.create({
      data: { panierId: otherPanierId, transactionId: otherTransactionId },
    })

    // Panier étranger : le lien reste intact.
    await removeTransactionFromPanier(orgId, otherPanierId, otherTransactionId)
    expect(
      await prisma.panierTransaction.findUnique({
        where: { panierId_transactionId: { panierId: otherPanierId, transactionId: otherTransactionId } },
      })
    ).not.toBeNull()

    // Transaction étrangère dans notre panier : le lien reste intact.
    await prisma.panierTransaction.create({
      data: { panierId, transactionId: otherTransactionId },
    })
    await removeTransactionFromPanier(orgId, panierId, otherTransactionId)
    expect(
      await prisma.panierTransaction.findUnique({
        where: { panierId_transactionId: { panierId, transactionId: otherTransactionId } },
      })
    ).not.toBeNull()

    await prisma.panierTransaction.deleteMany({
      where: {
        OR: [
          { panierId: otherPanierId, transactionId: otherTransactionId },
          { panierId, transactionId: otherTransactionId },
        ],
      },
    })
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
