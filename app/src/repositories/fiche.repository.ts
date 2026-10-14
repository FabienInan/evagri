import { prisma } from "@/lib/prisma"
import type { Prisma, StatutTransaction } from "@prisma/client"

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

/** Remplace toutes les valeurs de la transaction en une seule fois : plus simple que des upserts
 *  et garantit trivialement la contrainte unique [transactionId, champId]. */
export async function saveFicheValues(
  transactionId: string,
  entries: StorageValueEntry[]
): Promise<void> {
  await prisma.$transaction([
    prisma.valeurChamp.deleteMany({ where: { transactionId } }),
    prisma.valeurChamp.createMany({
      data: entries.map((e) => ({ transactionId, ...e })),
    }),
  ])
}

export async function updateFicheStatut(
  transactionId: string,
  statut: string,
  dateStatut: Date | null
): Promise<void> {
  await prisma.transaction.update({
    where: { id: transactionId },
    data: { statut: statut as StatutTransaction, dateStatut },
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

export async function createDocument(data: {
  transactionId: string
  nomFichier: string
  cheminStockage: string
}): Promise<void> {
  await prisma.documentActe.create({ data })
}

/** Scoped through the owning transaction so a document id from another tenant matches nothing. */
export async function deleteDocument(organisationId: string, id: string): Promise<boolean> {
  const result = await prisma.documentActe.deleteMany({
    where: { id, transaction: { organisationId } },
  })
  return result.count > 0
}
