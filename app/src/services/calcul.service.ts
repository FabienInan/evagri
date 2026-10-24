import Decimal from "decimal.js"
import { recomputeIndicateurs } from "@/lib/fiche"
import { ruleIdentifiers } from "@/lib/calculator"
import { applyValeursCalculees, listTransactionValeursByOrganisation, type ValeurCalculee } from "@/repositories/calcul.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import type { ChampEnrichissableConfig } from "@/types/champ"

const WRITE_BATCH_SIZE = 500

/**
 * Stored values of CALCULE champs are a cache of the rule: after a rule changes, every transaction of the
 * organisation is recomputed so exports and filters read values consistent with the current rules.
 */
export async function recalculerChampsCalcules(organisationId: string): Promise<void> {
  const champs = await listChampsEnrichissablesByOrganisation(organisationId)
  const calcules = champs.filter((champ) => champ.nature === "CALCULE")
  if (calcules.length === 0) return

  // Only the operands of the rules and the CALCULE values themselves can change a result.
  const operandCodes = new Set(calcules.flatMap((champ) => ruleIdentifiers(champ.regleCalcul ?? "")))
  const relevantIds = champs
    .filter((champ) => champ.nature === "CALCULE" || operandCodes.has(champ.codeMachine))
    .map((champ) => champ.id)
  const transactions = await listTransactionValeursByOrganisation(organisationId, relevantIds)
  const changes: ValeurCalculee[] = []

  for (const transaction of transactions) {
    const fields: Record<string, number | null> = {}
    const stored = new Map<string, number | null>()
    for (const valeur of transaction.valeurs) {
      const nombre = valeur.valeurNombre === null ? null : valeur.valeurNombre.toNumber()
      stored.set(valeur.champId, nombre)
      fields[valeur.champ.codeMachine] = nombre
    }

    const computed = recomputeIndicateurs(champs, { fields })
    for (const champ of calcules) {
      const value = computed[champ.codeMachine] ?? null
      if ((stored.get(champ.id) ?? null) !== value) {
        changes.push({ transactionId: transaction.id, champId: champ.id, valeurNombre: value })
      }
    }
  }

  for (let start = 0; start < changes.length; start += WRITE_BATCH_SIZE) {
    await applyValeursCalculees(changes.slice(start, start + WRITE_BATCH_SIZE))
  }
}

/**
 * Values of the CALCULE champs for a transaction about to be imported, computed from its enrichment values.
 * Champs without a result get no value.
 */
export function computeCalculatedEnrichment(
  champs: ChampEnrichissableConfig[],
  values: { champId: string; valeurNombre?: { toNumber(): number } | null }[]
): { champId: string; valeurNombre: Decimal }[] {
  const codeById = new Map(champs.map((champ) => [champ.id, champ.codeMachine]))
  const fields: Record<string, number | null> = {}
  for (const valeur of values) {
    const code = codeById.get(valeur.champId)
    if (code && valeur.valeurNombre) fields[code] = valeur.valeurNombre.toNumber()
  }

  const computed = recomputeIndicateurs(champs, { fields })
  return champs
    .filter((champ) => champ.nature === "CALCULE" && computed[champ.codeMachine] != null)
    .map((champ) => ({ champId: champ.id, valeurNombre: new Decimal(computed[champ.codeMachine] as number) }))
}
