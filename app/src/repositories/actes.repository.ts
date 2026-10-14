import { prisma } from "@/lib/prisma"

export async function findDocumentActeByFileName(
  transactionId: string,
  nomFichier: string
) {
  return prisma.documentActe.findFirst({
    where: { transactionId, nomFichier },
  })
}

export async function createDocumentActe(
  transactionId: string,
  nomFichier: string,
  cheminStockage: string
) {
  return prisma.documentActe.create({
    data: {
      transactionId,
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

export async function findTransactionByNumeroInscription(
  organisationId: string,
  numeroInscription: string
) {
  // Exact match: a `contains` lookup made the leading digits of one numero attach an acte to a different
  // transaction (e.g. "123" matching "1234"). An unmatched acte is visible and recoverable; a silently
  // mis-attached one is neither.
  return prisma.transaction.findFirst({
    where: {
      organisationId,
      valeurs: { some: { champ: { codeMachine: "numero_inscription" }, valeurTexte: numeroInscription } },
    },
    orderBy: { createdAt: "desc" },
  })
}
