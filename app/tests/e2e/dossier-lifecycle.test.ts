import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma } from "@/lib/prisma"

// Les actions "use server" appellent revalidatePath ; hors requête Next il n'y a pas de cache à revalider.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

// Géocodage Demeter simulé : le lot "9 999 999" n'existe pas au cadastre, les autres sont trouvés.
vi.mock("@/lib/cadastre", () => {
  const trouve = (lot: string) => (lot.replace(/\s/g, "") === "9999999" ? null : { latitude: 46.8, longitude: -71.2 })
  return {
    geocodeLotsCadastraux: vi.fn(async (lots: string[]) => {
      const found = lots.map(trouve).filter((c): c is { latitude: number; longitude: number } => c !== null)
      return found.length ? { latitude: 46.8, longitude: -71.2 } : null
    }),
    geocodeLotsDetail: vi.fn(async (lots: string[]) => {
      const parLot = lots.map((lot) => ({ lot, coordonnees: trouve(lot) }))
      return { parLot, moyenne: parLot.some((p) => p.coordonnees) ? { latitude: 46.8, longitude: -71.2 } : null }
    }),
  }
})

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
    const res = await createDossier({
      numeroDossier: "25-12-001",
      nom: "Essai",
      dateEvaluation: "2026-01-01",
      lotsCadastraux: ["4 128 182", "4 128 183"],
    })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    dossierId = res.id
    expect((await listDossiers()).map((d) => d.numeroDossier)).toContain("25-12-001")
  })

  it("refuse un numéro de dossier dupliqué", async () => {
    const { createDossier } = await import("@/server/actions/dossier")
    const res = await createDossier({ numeroDossier: "25-12-001", dateEvaluation: "2026-01-01", lotsCadastraux: ["4 128 182"] })
    expect(res.ok).toBe(false)
  })

  it("lot introuvable sans coordonnées : demande la saisie manuelle", async () => {
    const { createDossier } = await import("@/server/actions/dossier")
    const res = await createDossier({
      numeroDossier: "25-12-009",
      dateEvaluation: "2026-01-01",
      lotsCadastraux: ["9 999 999"],
    })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.coordonneesRequises).toBe(true)
  })

  it("lot introuvable avec coordonnées saisies : enregistre les coordonnées manuelles", async () => {
    const { createDossier, listDossiers } = await import("@/server/actions/dossier")
    const res = await createDossier({
      numeroDossier: "25-12-010",
      dateEvaluation: "2026-01-01",
      lotsCadastraux: ["9 999 999"],
      latitude: 45.5,
      longitude: -73.6,
    })
    expect(res.ok).toBe(true)
    const created = (await listDossiers()).find((d) => d.numeroDossier === "25-12-010")
    expect(created).toMatchObject({ latitude: 45.5, longitude: -73.6, lotsCadastraux: ["9 999 999"] })
  })

  it("lot trouvé : coordonnées géocodées, saisie manuelle ignorée", async () => {
    const { createDossier, listDossiers } = await import("@/server/actions/dossier")
    const res = await createDossier({
      numeroDossier: "25-12-011",
      dateEvaluation: "2026-01-01",
      lotsCadastraux: ["4 128 182"],
      latitude: 45.5,
      longitude: -73.6,
    })
    expect(res.ok).toBe(true)
    const created = (await listDossiers()).find((d) => d.numeroDossier === "25-12-011")
    expect(created).toMatchObject({ latitude: 46.8, longitude: -71.2 })
  })

  it("refuse des coordonnées saisies hors du Québec", async () => {
    const { createDossier } = await import("@/server/actions/dossier")
    const res = await createDossier({
      numeroDossier: "25-12-012",
      dateEvaluation: "2026-01-01",
      lotsCadastraux: ["9 999 999"],
      latitude: 40.7,
      longitude: -74,
    })
    expect(res.ok).toBe(false)
  })

  it("prévisualise les coordonnées trouvées lot par lot", async () => {
    const { previewLotsCadastraux } = await import("@/server/actions/dossier")
    const res = await previewLotsCadastraux({ lotsCadastraux: ["4128182", "9 999 999"] })
    expect(res).toEqual({
      ok: true,
      lots: [
        { lot: "4 128 182", latitude: 46.8, longitude: -71.2 },
        { lot: "9 999 999", latitude: null, longitude: null },
      ],
      moyenne: { latitude: 46.8, longitude: -71.2 },
    })
  })

  it("refuse un numéro de lot au format invalide dans la prévisualisation", async () => {
    const { previewLotsCadastraux } = await import("@/server/actions/dossier")
    const res = await previewLotsCadastraux({ lotsCadastraux: ["A12"] })
    expect(res.ok).toBe(false)
  })

  it("refuse un numéro de dossier mal formé", async () => {
    const { createDossier } = await import("@/server/actions/dossier")
    const res = await createDossier({ numeroDossier: "25-ab-1", dateEvaluation: "2026-01-01", lotsCadastraux: ["4 128 182"] })
    expect(res.ok).toBe(false)
  })

  it("crée un panier dans le dossier", async () => {
    const { createPanier, listPaniersForDossier } = await import("@/server/actions/dossier")
    const res = await createPanier({ dossierId, nom: "Comparables cultivés", tauxCroissancePct: 3.25 })
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
