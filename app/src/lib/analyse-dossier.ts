import { computeAdjustedValues, type ExportAnalysisParams } from "@/lib/excel-export"
import type { SerializedTransaction } from "@/types/transaction"

/** Valeurs ajustées d'une transaction, indexées par clé d'indicateur (voir ADJUSTED_EXPORT_COLUMNS). */
export type IndicateursAjustesValues = Record<string, number | null>

/**
 * Indicateurs ajustés de chaque transaction, calculés à l'export à partir de la date d'évaluation (dossier) et du
 * taux de croissance (panier). Rien n'est stocké : le calcul est reproductible à tout moment.
 */
export function computeIndicateursAjustesByTransaction(
  params: ExportAnalysisParams,
  transactions: Pick<SerializedTransaction, "id" | "fields">[]
): Record<string, IndicateursAjustesValues> {
  const out: Record<string, IndicateursAjustesValues> = {}
  for (const transaction of transactions) {
    out[transaction.id] = computeAdjustedValues(transaction.fields, params)
  }
  return out
}
