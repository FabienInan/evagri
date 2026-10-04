import { prisma } from "@/lib/prisma"

export async function findDocumentActeByFileName(
  transactionSourceId: string,
  nomFichier: string
) {
  return prisma.documentActe.findFirst({
    where: { transactionSourceId, nomFichier },
  })
}

export async function createDocumentActe(
  transactionSourceId: string,
  nomFichier: string,
  cheminStockage: string
) {
  return prisma.documentActe.create({
    data: {
      transactionSourceId,
      nomFichier,
      cheminStockage,
    },
  })
}

export async function updateDocumentActePath(
  id: string,
  cheminStockage: string
) {
  return prisma.documentActe.update({
    where: { id },
    data: { cheminStockage },
  })
}

export async function findTransactionSourceByNumeroInscription(
  organisationId: string,
  numeroInscription: string
) {
  // Exact match: a `contains` lookup made the leading digits of one numero attach an acte to a different
  // transaction (e.g. "123" matching "1234"). An unmatched acte is visible and recoverable; a silently
  // mis-attached one is neither.
  return prisma.transactionSource.findFirst({
    where: {
      organisationId,
      numeroInscription,
    },
    orderBy: { dateVente: "desc" },
  })
}
