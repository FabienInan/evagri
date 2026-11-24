import { prisma } from "@/lib/prisma"
import type { Prisma, StatutTransaction } from "@prisma/client"
import { createAuditLog, ecrireAvecJournal, type AuditLogInput } from "@/repositories/audit.repository"

/** Entrée de journal écrite dans la même transaction que la modification qu'elle décrit. */
export type JournalFiche = Omit<AuditLogInput, "organisationId">

const ficheInclude = {
  valeurs: { include: { champ: true } },
} satisfies Prisma.TransactionInclude

export type FicheTransactionRecord = Prisma.TransactionGetPayload<{
  include: typeof ficheInclude
}>

export async function findTransactionFiche(
  organisationId: string,
  id: string
): Promise<FicheTransactionRecord | null> {
  return prisma.transaction.findFirst({
    where: { id, organisationId },
    include: ficheInclude,
  })
}

export interface StorageValueEntry {
  champId: string
  valeurNombre: number | null
  valeurTexte: string | null
  valeurTexteMultiple: string[]
  valeurBooleen: boolean | null
  valeurDate: Date | null
}

/** Remplace toutes les valeurs de la transaction en une seule fois (contrainte unique [transactionId, champId]
 *  garantie) et enregistre l'entrée de journal dans la même transaction : tout est écrit, ou rien. */
export async function saveFicheValuesAvecJournal(
  organisationId: string,
  transactionId: string,
  entries: StorageValueEntry[],
  journal: JournalFiche
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.valeurChamp.deleteMany({ where: { transactionId } })
    await tx.valeurChamp.createMany({
      data: entries.map((e) => ({ transactionId, ...e })),
    })
    await createAuditLog({ ...journal, organisationId }, tx)
  })
}

/**
 * Changes the status and records the audit entry in the same transaction. `contributeurId` undefined leaves the
 * recorded contributor untouched (a reopening keeps it).
 */
export async function updateFicheStatutAvecJournal(
  organisationId: string,
  transactionId: string,
  statut: string,
  dateStatut: Date | null,
  contributeurId: string | undefined,
  journal: JournalFiche
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.transaction.update({
      where: { id: transactionId },
      data: { statut: statut as StatutTransaction, dateStatut, contributeurId },
    })
    await createAuditLog({ ...journal, organisationId }, tx)
  })
}

export interface DocumentRecord {
  id: string
  nomFichier: string
  dateUpload: Date
}

export async function listDocuments(transactionId: string): Promise<DocumentRecord[]> {
  return prisma.documentActe.findMany({
    where: { transactionId },
    orderBy: { dateUpload: "desc" },
    select: { id: true, nomFichier: true, dateUpload: true },
  })
}

/** The document and its journal entry are written in one transaction. */
export async function createDocument(
  organisationId: string,
  data: { transactionId: string; nomFichier: string; cheminStockage: string },
  journal: JournalFiche
): Promise<void> {
  await ecrireAvecJournal(organisationId, async (tx) => {
    await tx.documentActe.create({ data })
    return { resultat: undefined, journal: { ...journal, enregistrementId: data.transactionId } }
  })
}

/** Scoped through the owning transaction so a document id from another tenant matches nothing. Nothing is journalised when no document matched. */
export async function deleteDocument(organisationId: string, id: string, journal: JournalFiche): Promise<boolean> {
  return ecrireAvecJournal(organisationId, async (tx) => {
    const result = await tx.documentActe.deleteMany({
      where: { id, transaction: { organisationId } },
    })
    return { resultat: result.count > 0, journal: result.count > 0 ? { ...journal, enregistrementId: id } : undefined }
  })
}
