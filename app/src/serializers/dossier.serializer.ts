import type { Prisma } from "@prisma/client"

export type SerializedDossier = {
  id: string
  numeroDossier: string
  nom: string | null
  /** Date d'évaluation au format AAAA-MM-JJ, fixée à la création du dossier. */
  dateEvaluation: string | null
  createdAt: string
  panierCount: number
}

export type SerializedPanier = {
  id: string
  nom: string
  dossierId: string
  numeroDossier: string
  typeTransactionId: string | null
  typeTransactionNom: string | null
  /** Taux de croissance annuel en pourcentage (3.25 pour 3,25 %), fixé à la création du panier. */
  tauxCroissancePct: number | null
  createdAt: string
  transactionCount: number
}

type DossierWithCount = Prisma.DossierGetPayload<{
  include: { _count: { select: { paniers: true } } }
}>

export function serializeDossier(dossier: DossierWithCount): SerializedDossier {
  return {
    id: dossier.id,
    numeroDossier: dossier.numeroDossier,
    nom: dossier.nom,
    dateEvaluation: dossier.dateEvaluation ? dossier.dateEvaluation.toISOString().slice(0, 10) : null,
    createdAt: dossier.createdAt.toISOString(),
    panierCount: dossier._count.paniers,
  }
}

type PanierWithRelations = Prisma.PanierGetPayload<{
  include: {
    _count: { select: { transactions: true } }
    dossier: true
    typeTransaction: true
  }
}>

export function serializePanier(panier: PanierWithRelations): SerializedPanier {
  return {
    id: panier.id,
    nom: panier.nom,
    dossierId: panier.dossierId,
    numeroDossier: panier.dossier.numeroDossier,
    typeTransactionId: panier.typeTransactionId,
    typeTransactionNom: panier.typeTransaction?.nom ?? null,
    tauxCroissancePct: panier.tauxCroissance === null ? null : panier.tauxCroissance.toNumber() * 100,
    createdAt: panier.createdAt.toISOString(),
    transactionCount: panier._count.transactions,
  }
}
