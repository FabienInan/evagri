import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export type EntreeJournalAffichee = {
  id: string
  createdAt: Date
  utilisateurEmail: string | null
  tableCible: string
  enregistrementId: string | null
  action: string
  diff: unknown
}

/** Most recent audit entries of one organisation, with the author's courriel resolved. */
export async function listJournalByOrganisation(
  organisationId: string,
  limit = 200
): Promise<EntreeJournalAffichee[]> {
  const entrees = await prisma.journalAudit.findMany({
    where: { organisationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const ids = [...new Set(entrees.map((e) => e.utilisateurId).filter((id): id is string => !!id))]
  const utilisateurs = ids.length
    ? await prisma.utilisateur.findMany({
        where: { id: { in: ids }, organisationId },
        select: { id: true, email: true },
      })
    : []
  const emailParId = new Map(utilisateurs.map((u) => [u.id, u.email]))

  return entrees.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    utilisateurEmail: e.utilisateurId ? emailParId.get(e.utilisateurId) ?? null : null,
    tableCible: e.tableCible,
    enregistrementId: e.enregistrementId,
    action: e.action,
    diff: e.diff,
  }))
}

export type CibleHistorique = { type: "transaction" | "panier" | "dossier"; id: string }

export type EntreeHistorique = {
  id: string
  createdAt: Date
  auteur: string
  tableCible: string
  action: string
  diff: unknown
}

/**
 * Every journal entry about one transaction, panier or dossier, most recent first.
 * - transaction: its fiche and its documents (uploads, and deletions recorded with their transaction).
 * - panier: the panier itself and the transactions added to or removed from it.
 * - dossier: the dossier, and the entries of its paniers (current ones and those deleted from it).
 */
export async function listHistoriqueEntite(
  organisationId: string,
  cible: CibleHistorique,
  limit = 500
): Promise<EntreeHistorique[]> {
  let filtre: Prisma.JournalAuditWhereInput[]
  if (cible.type === "transaction") {
    filtre = [
      { tableCible: "transaction", enregistrementId: cible.id },
      { tableCible: "document_acte", enregistrementId: cible.id },
      { tableCible: "document_acte", diff: { path: ["transactionId"], equals: cible.id } },
    ]
  } else if (cible.type === "panier") {
    filtre = [
      { tableCible: "panier", enregistrementId: cible.id },
      { tableCible: "panier_transaction", enregistrementId: cible.id },
    ]
  } else {
    const paniers = await prisma.panier.findMany({
      where: { organisationId, dossierId: cible.id },
      select: { id: true },
    })
    const panierIds = paniers.map((p) => p.id)
    filtre = [
      { tableCible: "dossier", enregistrementId: cible.id },
      { tableCible: "panier", diff: { path: ["dossierId"], equals: cible.id } },
      { tableCible: { in: ["panier", "panier_transaction"] }, enregistrementId: { in: panierIds } },
    ]
  }

  const entrees = await prisma.journalAudit.findMany({
    where: { organisationId, OR: filtre },
    orderBy: { createdAt: "desc" },
    take: limit,
  })

  const ids = [...new Set(entrees.map((e) => e.utilisateurId).filter((id): id is string => !!id))]
  const utilisateurs = ids.length
    ? await prisma.utilisateur.findMany({
        where: { id: { in: ids }, organisationId },
        select: { id: true, nom: true, email: true },
      })
    : []
  const nomParId = new Map(utilisateurs.map((u) => [u.id, u.nom ?? u.email]))

  return entrees.map((e) => ({
    id: e.id,
    createdAt: e.createdAt,
    auteur: (e.utilisateurId && nomParId.get(e.utilisateurId)) || "Système",
    tableCible: e.tableCible,
    action: e.action,
    diff: e.diff,
  }))
}
