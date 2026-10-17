import { prisma } from "@/lib/prisma"

export async function listDossiers(organisationId: string) {
  return prisma.dossier.findMany({
    where: { organisationId, actif: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { paniers: true } } },
  })
}

export async function findDossierById(organisationId: string, id: string) {
  return prisma.dossier.findFirst({
    where: { id, organisationId },
    include: { _count: { select: { paniers: true } } },
  })
}

export async function findDossierByNumero(organisationId: string, numeroDossier: string) {
  return prisma.dossier.findFirst({ where: { organisationId, numeroDossier } })
}

export async function createDossier(
  organisationId: string,
  data: { numeroDossier: string; nom?: string }
) {
  return prisma.dossier.create({
    data: {
      organisationId,
      numeroDossier: data.numeroDossier,
      nom: data.nom ?? null,
      createurId: null,
    },
  })
}

export async function listPaniersByDossier(organisationId: string, dossierId: string) {
  return prisma.panier.findMany({
    where: { organisationId, dossierId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { transactions: true } },
      dossier: true,
      typeTransaction: true,
    },
  })
}

export async function createPanier(
  organisationId: string,
  data: { dossierId: string; nom: string; typeTransactionId?: string | null }
) {
  return prisma.panier.create({
    data: {
      organisationId,
      dossierId: data.dossierId,
      nom: data.nom,
      typeTransactionId: data.typeTransactionId ?? null,
      createurId: null,
    },
  })
}

export async function findPanierById(organisationId: string, id: string) {
  return prisma.panier.findFirst({
    where: { id, organisationId },
    include: {
      _count: { select: { transactions: true } },
      dossier: true,
      typeTransaction: true,
    },
  })
}

/** Renvoie le nombre de lignes réellement insérées : `skipDuplicates` rend l'ajout idempotent. */
export async function addTransactionsToPanier(
  panierId: string,
  transactionIds: string[]
): Promise<number> {
  const result = await prisma.panierTransaction.createMany({
    data: transactionIds.map((transactionId) => ({ panierId, transactionId })),
    skipDuplicates: true,
  })
  return result.count
}

/** `deleteMany` plutôt que `delete` : un retrait d'une transaction déjà absente reste un no-op silencieux. */
export async function removeTransactionFromPanier(
  panierId: string,
  transactionId: string
): Promise<void> {
  await prisma.panierTransaction.deleteMany({ where: { panierId, transactionId } })
}

export async function listTransactionsOfPanier(panierId: string) {
  return prisma.transaction.findMany({
    where: { paniers: { some: { panierId } } },
    include: { valeurs: { include: { champ: true } } },
  })
}

export async function countEligibleTransactions(
  organisationId: string,
  transactionIds: string[]
): Promise<number> {
  return prisma.transaction.count({
    where: { id: { in: transactionIds }, organisationId, statut: "ANALYSEE" },
  })
}
