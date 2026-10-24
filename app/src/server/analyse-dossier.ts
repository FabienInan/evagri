import { computeIndicateursAjustesByTransaction } from "@/lib/analyse-dossier"
import {
  listAnalysesByDossier,
  listTransactionsOfDossier,
  replaceIndicateurs,
} from "@/repositories/analyse-dossier.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { serializeAnalyse } from "@/serializers/analyse-dossier.serializer"

/**
 * Recalcule les indicateurs ajustés de toutes les analyses d'un dossier. Appelé à chaque changement de
 * contenu des paniers : une transaction retirée de tous les paniers perd ainsi sa ligne.
 */
export async function recalculateAnalysesForDossier(organisationId: string, dossierId: string): Promise<void> {
  const analyses = await listAnalysesByDossier(organisationId, dossierId)
  if (analyses.length === 0) return

  const transactions = (await listTransactionsOfDossier(organisationId, dossierId)).map(serializeTransaction)
  for (const analyse of analyses) {
    const rows = computeIndicateursAjustesByTransaction(serializeAnalyse(analyse), transactions)
    await replaceIndicateurs(organisationId, analyse.id, rows)
  }
}
