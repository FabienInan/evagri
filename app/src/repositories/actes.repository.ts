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
  return prisma.transactionSource.findFirst({
    where: {
      organisationId,
      numeroInscription: { contains: numeroInscription, mode: "insensitive" },
    },
    orderBy: { dateVente: "desc" },
  })
}
