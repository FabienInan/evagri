import { prisma } from "@/lib/prisma"
import { ecrireAvecJournal, type JournalBase } from "@/repositories/audit.repository"

// Each write below records its journal entry in the same transaction: the change and its trace commit together.

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
  data: {
    numeroDossier: string
    nom?: string
    dateEvaluation: string
    lotsCadastraux: string[]
    latitude: number
    longitude: number
  },
  journal: JournalBase
) {
  return ecrireAvecJournal(organisationId, async (tx) => {
    const dossier = await tx.dossier.create({
      data: {
        organisationId,
        numeroDossier: data.numeroDossier,
        nom: data.nom ?? null,
        dateEvaluation: new Date(data.dateEvaluation),
        lotsCadastraux: data.lotsCadastraux,
        latitude: data.latitude,
        longitude: data.longitude,
        createurId: null,
      },
    })
    return { resultat: dossier, journal: { ...journal, enregistrementId: dossier.id } }
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

/** Modifie le taux de croissance d'un panier (fraction stockée, comme à la création). Renvoie false si absent : rien n'est journalisé. */
export async function updatePanierTauxCroissance(
  organisationId: string,
  panierId: string,
  tauxCroissancePct: number,
  journal: JournalBase
): Promise<boolean> {
  return ecrireAvecJournal(organisationId, async (tx) => {
    const { count } = await tx.panier.updateMany({
      where: { id: panierId, organisationId },
      data: { tauxCroissance: tauxCroissancePct / 100 },
    })
    return { resultat: count > 0, journal: count > 0 ? { ...journal, enregistrementId: panierId } : undefined }
  })
}

export async function createPanier(
  organisationId: string,
  data: { dossierId: string; nom: string; typeTransactionId?: string | null; tauxCroissancePct: number },
  journal: JournalBase
) {
  return ecrireAvecJournal(organisationId, async (tx) => {
    const panier = await tx.panier.create({
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
    return { resultat: panier, journal: { ...journal, enregistrementId: panier.id } }
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
 * n'insère rien, même si l'appelant a oublié son pré-contrôle. Rien n'est journalisé quand le panier est absent.
 */
export async function addTransactionsToPanier(
  organisationId: string,
  panierId: string,
  transactionIds: string[],
  journal: JournalBase
): Promise<number> {
  const ids = Array.from(new Set(transactionIds))
  return ecrireAvecJournal(organisationId, async (tx) => {
    const panier = await tx.panier.findFirst({
      where: { id: panierId, organisationId },
      select: { id: true },
    })
    if (!panier) return { resultat: 0 }

    const owned = await tx.transaction.findMany({
      where: { id: { in: ids }, organisationId },
      select: { id: true },
    })
    const added =
      owned.length === 0
        ? 0
        : (
            await tx.panierTransaction.createMany({
              data: owned.map(({ id }) => ({ panierId, transactionId: id })),
              skipDuplicates: true,
            })
          ).count

    return {
      resultat: added,
      journal: { ...journal, enregistrementId: panierId, diff: { ajoutees: added } },
    }
  })
}

/** `deleteMany` plutôt que `delete` : un retrait d'une transaction déjà absente reste un no-op silencieux. */
export async function removeTransactionFromPanier(
  organisationId: string,
  panierId: string,
  transactionId: string,
  journal: JournalBase
): Promise<void> {
  await ecrireAvecJournal(organisationId, async (tx) => {
    await tx.panierTransaction.deleteMany({
      where: {
        panierId,
        transactionId,
        panier: { organisationId },
        transaction: { organisationId },
      },
    })
    return { resultat: undefined, journal: { ...journal, enregistrementId: panierId } }
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
 * seul le regroupement disparaît. Retourne false si le panier n'appartient pas à l'organisation (rien n'est journalisé).
 */
export async function deletePanier(
  organisationId: string,
  panierId: string,
  journal: JournalBase
): Promise<boolean> {
  return ecrireAvecJournal(organisationId, async (tx) => {
    const panier = await tx.panier.findFirst({ where: { id: panierId, organisationId }, select: { id: true } })
    if (!panier) return { resultat: false }
    await tx.panierTransaction.deleteMany({ where: { panierId } })
    await tx.panier.delete({ where: { id: panierId } })
    return { resultat: true, journal: { ...journal, enregistrementId: panierId } }
  })
}
