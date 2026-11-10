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
  data: { numeroDossier: string; nom?: string; dateEvaluation: string }
) {
  return prisma.dossier.create({
    data: {
      organisationId,
      numeroDossier: data.numeroDossier,
      nom: data.nom ?? null,
      dateEvaluation: new Date(data.dateEvaluation),
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
  data: { dossierId: string; nom: string; typeTransactionId?: string | null; tauxCroissancePct: number }
) {
  return prisma.panier.create({
    data: {
      organisationId,
      dossierId: data.dossierId,
      nom: data.nom,
      typeTransactionId: data.typeTransactionId ?? null,
      // Stocké en fraction (3.25 % → 0.0325), comme l'ancienne analyse.
      tauxCroissance: data.tauxCroissancePct / 100,
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

/**
 * Renvoie le nombre de lignes réellement insérées : `skipDuplicates` rend l'ajout idempotent.
 * Le panier et les transactions doivent appartenir à l'organisation : une mutation inter-organisation
 * n'insère rien, même si l'appelant a oublié son pré-contrôle.
 */
export async function addTransactionsToPanier(
  organisationId: string,
  panierId: string,
  transactionIds: string[]
): Promise<number> {
  const ids = Array.from(new Set(transactionIds))
  return prisma.$transaction(async (tx) => {
    const panier = await tx.panier.findFirst({
      where: { id: panierId, organisationId },
      select: { id: true },
    })
    if (!panier) return 0

    const owned = await tx.transaction.findMany({
      where: { id: { in: ids }, organisationId },
      select: { id: true },
    })
    if (owned.length === 0) return 0

    const result = await tx.panierTransaction.createMany({
      data: owned.map(({ id }) => ({ panierId, transactionId: id })),
      skipDuplicates: true,
    })
    return result.count
  })
}

/** `deleteMany` plutôt que `delete` : un retrait d'une transaction déjà absente reste un no-op silencieux. */
export async function removeTransactionFromPanier(
  organisationId: string,
  panierId: string,
  transactionId: string
): Promise<void> {
  await prisma.panierTransaction.deleteMany({
    where: {
      panierId,
      transactionId,
      panier: { organisationId },
      transaction: { organisationId },
    },
  })
}

/** Identifiants des transactions déjà présentes dans un panier, sans charger leurs valeurs. */
export async function listTransactionIdsOfPanier(organisationId: string, panierId: string): Promise<string[]> {
  const rows = await prisma.panierTransaction.findMany({
    where: { panierId, panier: { organisationId } },
    select: { transactionId: true },
  })
  return rows.map((row) => row.transactionId)
}

export async function listTransactionsOfPanier(organisationId: string, panierId: string) {
  return prisma.transaction.findMany({
    where: {
      organisationId,
      paniers: { some: { panierId, panier: { organisationId } } },
    },
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

/**
 * Supprime le panier et ses liens vers les transactions. Les transactions elles-mêmes restent intactes :
 * seul le regroupement disparaît. Retourne false si le panier n'appartient pas à l'organisation.
 */
export async function deletePanier(organisationId: string, panierId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const panier = await tx.panier.findFirst({ where: { id: panierId, organisationId }, select: { id: true } })
    if (!panier) return false
    await tx.panierTransaction.deleteMany({ where: { panierId } })
    await tx.panier.delete({ where: { id: panierId } })
    return true
  })
}
