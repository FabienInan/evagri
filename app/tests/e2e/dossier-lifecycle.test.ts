import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma } from "@/lib/prisma"

// Les actions "use server" appellent revalidatePath ; hors requête Next il n'y a pas de cache à revalider.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

let orgId = ""
let analyseeId = ""
let nonAnalyseeId = ""
const previousOrganisationId = process.env.DEFAULT_ORGANISATION_ID

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Dossiers E2E Org" } })
  orgId = org.id
  // getCurrentOrganisationId lit cette variable au chargement du module : à poser avant tout import d'action.
  process.env.DEFAULT_ORGANISATION_ID = orgId
  const a = await prisma.transaction.create({
    data: { organisationId: orgId, systemeSource: "TEST", statut: "ANALYSEE" },
  })
  analyseeId = a.id
  const b = await prisma.transaction.create({
    data: { organisationId: orgId, systemeSource: "TEST", statut: "NON_ANALYSEE" },
  })
  nonAnalyseeId = b.id
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

describe("E2E — cycle de vie dossier → panier → transactions", () => {
  let dossierId = ""
  let panierId = ""

  it("crée un dossier", async () => {
    const { createDossier, listDossiers } = await import("@/server/actions/dossier")
    const res = await createDossier({ numeroDossier: "25-AB-001", nom: "Essai" })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    dossierId = res.id
    expect((await listDossiers()).map((d) => d.numeroDossier)).toContain("25-AB-001")
  })

  it("refuse un numéro de dossier dupliqué", async () => {
    const { createDossier } = await import("@/server/actions/dossier")
    const res = await createDossier({ numeroDossier: "25-AB-001" })
    expect(res.ok).toBe(false)
  })

  it("refuse un numéro de dossier mal formé", async () => {
    const { createDossier } = await import("@/server/actions/dossier")
    const res = await createDossier({ numeroDossier: "25-ab-1" })
    expect(res.ok).toBe(false)
  })

  it("crée un panier dans le dossier", async () => {
    const { createPanier, listPaniersForDossier } = await import("@/server/actions/dossier")
    const res = await createPanier({ dossierId, nom: "Comparables cultivés" })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    panierId = res.id
    const paniers = await listPaniersForDossier(dossierId)
    expect(paniers.map((p) => p.nom)).toContain("Comparables cultivés")
  })

  it("ajoute une transaction analysée au panier", async () => {
    const { addTransactionsToPanier, listTransactionsForPanier } = await import("@/server/actions/dossier")
    const res = await addTransactionsToPanier({ panierId, transactionIds: [analyseeId] })
    expect(res).toEqual({ ok: true, added: 1 })
    expect((await listTransactionsForPanier(panierId)).map((t) => t.id)).toContain(analyseeId)
  })

  it("ignore un ré-ajout (pas de doublon)", async () => {
    const { addTransactionsToPanier, listTransactionsForPanier } = await import("@/server/actions/dossier")
    const res = await addTransactionsToPanier({ panierId, transactionIds: [analyseeId] })
    expect(res).toEqual({ ok: true, added: 0 })
    expect(await listTransactionsForPanier(panierId)).toHaveLength(1)
  })

  it("refuse une transaction non analysée", async () => {
    const { addTransactionsToPanier } = await import("@/server/actions/dossier")
    const res = await addTransactionsToPanier({ panierId, transactionIds: [nonAnalyseeId] })
    expect(res.ok).toBe(false)
  })

  it("retire une transaction du panier", async () => {
    const { removeTransactionFromPanier, listTransactionsForPanier } = await import("@/server/actions/dossier")
    expect(await removeTransactionFromPanier(panierId, analyseeId)).toEqual({ ok: true })
    expect(await listTransactionsForPanier(panierId)).toHaveLength(0)
  })
})
