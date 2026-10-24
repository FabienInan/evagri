import { computeAdjustedValues, type ExportAnalysisParams } from "@/lib/excel-export"
import type { SerializedTransaction } from "@/types/transaction"

/** Paramètres d'une Analyse de Dossier, en unités d'affichage (taux en pourcentage, montants en $). */
export interface AnalyseParams {
  dateEvaluation: string
  tauxCroissancePct: number
  tauxBoiseRef: number | null
  tauxCultiveRef: number | null
  valeurBatimentRef: number | null
  valeurMaisonRef: number | null
  valeurTerrainResidentielRef: number | null
}

/** Valeurs ajustées d'une transaction, indexées par clé d'indicateur (voir ADJUSTED_EXPORT_COLUMNS). */
export type IndicateursAjustesValues = Record<string, number | null>

export function toExportParams(params: AnalyseParams): ExportAnalysisParams {
  return {
    tauxCroissancePct: params.tauxCroissancePct,
    dateEvaluation: params.dateEvaluation,
    tauxBoiseRef: params.tauxBoiseRef ?? undefined,
    tauxCultiveRef: params.tauxCultiveRef ?? undefined,
    valeurBatiment: params.valeurBatimentRef ?? undefined,
    valeurMaison: params.valeurMaisonRef ?? undefined,
    valeurTerrainResidentiel: params.valeurTerrainResidentielRef ?? undefined,
  }
}

/** Calcule les indicateurs ajustés de chaque transaction, à partir des paramètres de l'analyse. */
export function computeIndicateursAjustesByTransaction(
  params: AnalyseParams,
  transactions: Pick<SerializedTransaction, "id" | "fields">[]
): { transactionId: string; values: IndicateursAjustesValues }[] {
  const exportParams = toExportParams(params)
  return transactions.map((transaction) => ({
    transactionId: transaction.id,
    values: computeAdjustedValues(transaction.fields, exportParams),
  }))
}
