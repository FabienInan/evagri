import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

const ficheInclude = {
  enrichie: { include: { valeurs: { include: { champEnrichissable: true } } } },
} satisfies Prisma.TransactionSourceInclude

export type FicheTransactionRecord = Prisma.TransactionSourceGetPayload<{
  include: typeof ficheInclude
}>

export async function findTransactionFiche(
  organisationId: string,
  id: string
): Promise<FicheTransactionRecord | null> {
  return prisma.transactionSource.findFirst({
    where: { id, organisationId },
    include: ficheInclude,
  })
}

export interface StorageValueEntry {
  champEnrichissableId: string
  valeurNombre: number | null
  valeurTexte: string | null
  valeurBooleen: boolean | null
}

/** Remplace toutes les valeurs de la transaction en une seule fois : plus simple que des upserts
 *  et garantit trivialement la contrainte unique [transactionEnrichieId, champEnrichissableId]. */
export async function saveFicheValues(
  transactionEnrichieId: string,
  entries: StorageValueEntry[]
): Promise<void> {
  await prisma.$transaction([
    prisma.valeurEnrichissement.deleteMany({ where: { transactionEnrichieId } }),
    prisma.valeurEnrichissement.createMany({
      data: entries.map((e) => ({ transactionEnrichieId, ...e })),
    }),
  ])
}

export async function updateFicheStatut(
  transactionEnrichieId: string,
  statut: string,
  dateStatut: Date | null
): Promise<void> {
  await prisma.transactionEnrichie.update({
    where: { id: transactionEnrichieId },
    data: { statut, dateStatut },
  })
}

export interface DocumentRecord {
  id: string
  nomFichier: string
  dateUpload: Date
}

export async function listDocuments(transactionSourceId: string): Promise<DocumentRecord[]> {
  return prisma.documentActe.findMany({
    where: { transactionSourceId },
    orderBy: { dateUpload: "desc" },
    select: { id: true, nomFichier: true, dateUpload: true },
  })
}

export async function createDocument(data: {
  transactionSourceId: string
  nomFichier: string
  cheminStockage: string
}): Promise<void> {
  await prisma.documentActe.create({ data })
}

/** Scoped through the owning transaction so a document id from another tenant matches nothing. */
export async function deleteDocument(organisationId: string, id: string): Promise<boolean> {
  const result = await prisma.documentActe.deleteMany({
    where: { id, transactionSource: { organisationId } },
  })
  return result.count > 0
}
