import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { listHistoriqueEntite } from "@/repositories/journal.repository"

let orgId = ""
let autreOrgId = ""
let utilisateurId = ""
let transactionId = ""
let autreTransactionId = ""
let dossierId = ""
let panierId = ""
let panierSupprimeId = ""

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test historique" } })
  orgId = org.id
  const autre = await prisma.organisation.create({ data: { nom: "Test historique autre" } })
  autreOrgId = autre.id
  const u = await prisma.utilisateur.create({
    data: { organisationId: orgId, email: "historique@test.invalid", nom: "Évaluatrice test", role: "EVALUATEUR", passwordHash: "x" },
  })
  utilisateurId = u.id
  transactionId = (await prisma.transaction.create({ data: { organisationId: orgId, systemeSource: "TEST" } })).id
  autreTransactionId = (await prisma.transaction.create({ data: { organisationId: autreOrgId, systemeSource: "TEST" } })).id
  dossierId = (await prisma.dossier.create({ data: { organisationId: orgId, numeroDossier: "25-12-010" } })).id
  panierId = (await prisma.panier.create({ data: { organisationId: orgId, dossierId, nom: "Panier A" } })).id
  panierSupprimeId = "00000000-0000-4000-8000-00000000d0d0"

  const entree = (data: Record<string, unknown>) =>
    prisma.journalAudit.create({ data: { organisationId: orgId, utilisateurId, action: "X", tableCible: "x", ...data } as never })
  await entree({ tableCible: "transaction", enregistrementId: transactionId, action: "SAVE_FICHE", diff: { champsModifies: "PRIX_VENTE" } })
  await entree({ tableCible: "transaction", enregistrementId: transactionId, action: "STATUT", diff: { statut: "ANALYSEE" } })
  await entree({ tableCible: "document_acte", enregistrementId: transactionId, action: "INSERT", diff: { nomFichier: "a.pdf" } })
  await entree({ tableCible: "document_acte", enregistrementId: "doc-supprime", action: "DELETE", diff: { nomFichier: "b.pdf", transactionId } })
  await prisma.journalAudit.create({
    data: { organisationId: autreOrgId, utilisateurId, action: "STATUT", tableCible: "transaction", enregistrementId: autreTransactionId, diff: { statut: "ANALYSEE" } },
  })
  await entree({ tableCible: "dossier", enregistrementId: dossierId, action: "INSERT", diff: { numeroDossier: "25-12-010" } })
  await entree({ tableCible: "panier", enregistrementId: panierId, action: "INSERT", diff: { nom: "Panier A" } })
  await entree({ tableCible: "panier_transaction", enregistrementId: panierId, action: "INSERT", diff: { ajoutees: 1 } })
  await entree({ tableCible: "panier", enregistrementId: panierSupprimeId, action: "DELETE", diff: { dossierId } })
  await entree({ tableCible: "panier", enregistrementId: panierId, action: "UPDATE", diff: { tauxCroissancePct: 3 } })
})

afterAll(async () => {
  await prisma.journalAudit.deleteMany({ where: { organisationId: { in: [orgId, autreOrgId] } } })
  await prisma.documentActe.deleteMany({ where: { transaction: { organisationId: { in: [orgId, autreOrgId] } } } })
  await prisma.panierTransaction.deleteMany({ where: { panier: { organisationId: { in: [orgId, autreOrgId] } } } })
  await prisma.panier.deleteMany({ where: { organisationId: { in: [orgId, autreOrgId] } } })
  await prisma.dossier.deleteMany({ where: { organisationId: { in: [orgId, autreOrgId] } } })
  await prisma.transaction.deleteMany({ where: { organisationId: { in: [orgId, autreOrgId] } } })
  await prisma.utilisateur.deleteMany({ where: { organisationId: { in: [orgId, autreOrgId] } } })
  await prisma.organisation.deleteMany({ where: { id: { in: [orgId, autreOrgId] } } })
})

describe("historique d'une entité", () => {
  it("une transaction montre sa fiche et ses documents, ajoutés comme supprimés, mais pas les autres", async () => {
    const entrees = await listHistoriqueEntite(orgId, { type: "transaction", id: transactionId })
    expect(entrees.map((e) => e.action).sort()).toEqual(["DELETE", "INSERT", "SAVE_FICHE", "STATUT"])
    expect(entrees.every((e) => e.auteur === "Évaluatrice test")).toBe(true)
  })

  it("un panier montre ses modifications et les transactions ajoutées, pas celles des autres paniers", async () => {
    const entrees = await listHistoriqueEntite(orgId, { type: "panier", id: panierId })
    expect(entrees.map((e) => `${e.tableCible}:${e.action}`).sort()).toEqual([
      "panier:INSERT",
      "panier:UPDATE",
      "panier_transaction:INSERT",
    ])
  })

  it("un dossier montre ses entrées et celles de ses paniers, y compris un panier supprimé", async () => {
    const entrees = await listHistoriqueEntite(orgId, { type: "dossier", id: dossierId })
    const cles = entrees.map((e) => `${e.tableCible}:${e.action}`).sort()
    expect(cles).toEqual(["dossier:INSERT", "panier:DELETE", "panier:INSERT", "panier:UPDATE", "panier_transaction:INSERT"])
  })

  it("régression : une autre organisation ne voit jamais l'historique d'une entité", async () => {
    expect(await listHistoriqueEntite(autreOrgId, { type: "transaction", id: transactionId })).toEqual([])
    const autres = await listHistoriqueEntite(autreOrgId, { type: "transaction", id: autreTransactionId })
    expect(autres.map((e) => e.action)).toEqual(["STATUT"])
  })

  it("les entrées sont présentées les plus récentes en premier", async () => {
    const entrees = await listHistoriqueEntite(orgId, { type: "transaction", id: transactionId })
    const dates = entrees.map((e) => e.createdAt.getTime())
    expect([...dates].sort((a, b) => b - a)).toEqual(dates)
  })
})

describe("historique du panier : transactions désignées par leur numéro d'inscription", () => {
  it("l'ajout et le retrait nomment la transaction par son numéro d'inscription", async () => {
    const { addTransactionsToPanier, removeTransactionFromPanier } = await import("@/repositories/dossier.repository")
    const champ = await prisma.champ.create({
      data: { organisationId: orgId, codeMachine: "numero_inscription", nomAffichage: "N° d'inscription", typeDonnees: "TEXTE", nature: "IMPORTE" },
    })
    const tx = await prisma.transaction.create({ data: { organisationId: orgId, systemeSource: "TEST", statut: "ANALYSEE" } })
    await prisma.valeurChamp.create({ data: { transactionId: tx.id, champId: champ.id, valeurTexte: "30420525" } })
    const panier = await prisma.panier.create({ data: { organisationId: orgId, dossierId, nom: "Panier numéros" } })

    await addTransactionsToPanier(orgId, panier.id, [tx.id], { tableCible: "panier_transaction", action: "INSERT" })
    const ajout = await prisma.journalAudit.findFirstOrThrow({
      where: { organisationId: orgId, tableCible: "panier_transaction", enregistrementId: panier.id, action: "INSERT" },
    })
    expect((ajout.diff as { modifications: string[] }).modifications).toEqual(["Transaction 30420525 ajoutée"])

    await removeTransactionFromPanier(orgId, panier.id, tx.id, { tableCible: "panier_transaction", action: "DELETE" })
    const retrait = await prisma.journalAudit.findFirstOrThrow({
      where: { organisationId: orgId, tableCible: "panier_transaction", enregistrementId: panier.id, action: "DELETE" },
    })
    expect((retrait.diff as { numeroInscription: string }).numeroInscription).toBe("30420525")

    await prisma.panierTransaction.deleteMany({ where: { panierId: panier.id } })
    await prisma.panier.delete({ where: { id: panier.id } })
    await prisma.valeurChamp.deleteMany({ where: { transactionId: tx.id } })
    await prisma.transaction.delete({ where: { id: tx.id } })
    await prisma.champ.delete({ where: { id: champ.id } })
  })
})
