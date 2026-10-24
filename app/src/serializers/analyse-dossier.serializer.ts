import type { Prisma } from "@prisma/client"
import Decimal from "decimal.js"
import type { AnalyseParams } from "@/lib/analyse-dossier"

export type SerializedAnalyse = AnalyseParams & {
  id: string
  dossierId: string
  resultCount: number
}

type AnalyseWithCount = Prisma.AnalyseDossierGetPayload<{
  include: { _count: { select: { resultats: true } } }
}>

function toNumberOrNull(value: Prisma.Decimal | null): number | null {
  return value === null ? null : new Decimal(value.toString()).toNumber()
}

export function serializeAnalyse(analyse: AnalyseWithCount): SerializedAnalyse {
  return {
    id: analyse.id,
    dossierId: analyse.dossierId,
    dateEvaluation: analyse.dateEvaluation.toISOString().slice(0, 10),
    // Stocké en fraction (0.05) ; exposé en pourcentage (5) comme dans le formulaire.
    tauxCroissancePct: new Decimal(analyse.tauxCroissance.toString()).times(100).toNumber(),
    tauxBoiseRef: toNumberOrNull(analyse.tauxBoiseRef),
    tauxCultiveRef: toNumberOrNull(analyse.tauxCultiveRef),
    valeurBatimentRef: toNumberOrNull(analyse.valeurBatimentRef),
    valeurMaisonRef: toNumberOrNull(analyse.valeurMaisonRef),
    valeurTerrainResidentielRef: toNumberOrNull(analyse.valeurTerrainResidentielRef),
    resultCount: analyse._count.resultats,
  }
}
