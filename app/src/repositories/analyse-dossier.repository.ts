import { prisma } from "@/lib/prisma"
import type { IndicateursAjustesValues } from "@/lib/analyse-dossier"

export interface AnalyseDossierData {
  dateEvaluation: Date
  /** Fraction (0.05 pour 5 %), telle que stockée en base. */
  tauxCroissance: number
  tauxBoiseRef: number | null
  tauxCultiveRef: number | null
  valeurBatimentRef: number | null
  valeurMaisonRef: number | null
  valeurTerrainResidentielRef: number | null
}

const ANALYSE_INCLUDE = { _count: { select: { resultats: true } } } as const

export async function listAnalysesByDossier(organisationId: string, dossierId: string) {
  return prisma.analyseDossier.findMany({
    where: { organisationId, dossierId },
    orderBy: [{ dateEvaluation: "desc" }, { createdAt: "desc" }],
    include: ANALYSE_INCLUDE,
  })
}

export async function findAnalyseById(organisationId: string, id: string) {
  return prisma.analyseDossier.findFirst({
    where: { id, organisationId },
    include: ANALYSE_INCLUDE,
  })
}

export async function createAnalyse(organisationId: string, dossierId: string, data: AnalyseDossierData) {
  return prisma.analyseDossier.create({
    data: { organisationId, dossierId, createurId: null, ...data },
    include: ANALYSE_INCLUDE,
  })
}

export async function updateAnalyse(organisationId: string, id: string, data: AnalyseDossierData) {
  return prisma.analyseDossier.update({
    where: { id, organisationId },
    data,
    include: ANALYSE_INCLUDE,
  })
}

/** Supprime l'analyse et ses indicateurs dans une même transaction (pas de cascade côté schéma). */
export async function deleteAnalyse(organisationId: string, id: string): Promise<void> {
  await prisma.$transaction([
    prisma.indicateursAjustes.deleteMany({ where: { analyseDossierId: id, analyseDossier: { organisationId } } }),
    prisma.analyseDossier.deleteMany({ where: { id, organisationId } }),
  ])
}

/** Transactions de tous les paniers du dossier : périmètre de calcul d'une Analyse de Dossier. */
export async function listTransactionsOfDossier(organisationId: string, dossierId: string) {
  return prisma.transaction.findMany({
    where: {
      organisationId,
      paniers: { some: { panier: { dossierId, organisationId } } },
    },
    include: { valeurs: { include: { champ: true } } },
  })
}

/** Remplace l'ensemble des indicateurs ajustés d'une analyse (recalcul complet, idempotent). */
export async function replaceIndicateurs(
  organisationId: string,
  analyseDossierId: string,
  rows: { transactionId: string; values: IndicateursAjustesValues }[]
): Promise<void> {
  await prisma.$transaction([
    prisma.indicateursAjustes.deleteMany({
      where: { analyseDossierId, analyseDossier: { organisationId } },
    }),
    prisma.indicateursAjustes.createMany({
      data: rows.map(({ transactionId, values }) => ({
        analyseDossierId,
        transactionId,
        prixVenteAjuste: values.prix_actualise ?? null,
        tauxGlobalAjuste: values.taux_global_ajuste ?? null,
        tauxResiduelCultiveAjuste: values.taux_residuel_cultive_ajuste ?? null,
        tauxResiduelBoiseAjuste: values.taux_residuel_boise_ajuste ?? null,
        tauxResiduelBatimentAjuste: values.taux_residuel_batiment_ajuste ?? null,
        tauxParEntailleAjuste: values.taux_par_entaille_ajuste ?? null,
      })),
    }),
  ])
}

export async function listIndicateursForAnalyse(
  organisationId: string,
  analyseDossierId: string,
  transactionIds: string[]
) {
  return prisma.indicateursAjustes.findMany({
    where: {
      analyseDossierId,
      transactionId: { in: transactionIds },
      analyseDossier: { organisationId },
    },
  })
}
