import type { SerializedTransaction } from "@/types/transaction"

/**
 * Indicateurs ajustés du panier (§7.8.2) : prix actualisé et taux ajustés, calculés à partir de la date d'évaluation
 * du dossier et du taux de croissance du panier. Utilisés par l'export Excel et le tableau du panier.
 */

/**
 * Paramètres des indicateurs ajustés : la date d'évaluation vient du dossier, le taux de croissance du panier.
 * Les valeurs de référence (taux boisé, taux cultivé, valeurs des constructions) ne se choisissent pas à l'export :
 * elles sont lues sur chaque transaction.
 */
export interface ExportAnalysisParams {
  tauxCroissancePct: number
  /** Date d'évaluation au format `YYYY-MM-DD`. */
  dateEvaluation: string
}


function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/**
 * Prix actualisé (§7.8.2) : `prix_vente × (1 + taux) ^ ((date_evaluation − date_vente) / 365)`.
 * Retourne null dès qu'une donnée indispensable manque plutôt que d'inventer une valeur.
 */
export function computePrixActualise(
  fields: SerializedTransaction["fields"],
  params: Pick<ExportAnalysisParams, "tauxCroissancePct" | "dateEvaluation">
): number | null {
  const prix = toNumber(fields.prix_vente)
  if (prix === null) return null

  const dateVente = typeof fields.date_vente === "string" ? new Date(fields.date_vente) : null
  const dateEvaluation = new Date(params.dateEvaluation)
  if (!dateVente || Number.isNaN(dateVente.getTime()) || Number.isNaN(dateEvaluation.getTime())) return null
  if (!Number.isFinite(params.tauxCroissancePct)) return null

  const base = 1 + params.tauxCroissancePct / 100
  // Une base nulle ou négative rendrait la puissance fractionnaire non définie : on laisse la case vide.
  if (base <= 0) return null

  const jours = (dateEvaluation.getTime() - dateVente.getTime()) / 86_400_000
  const value = prix * Math.pow(base, jours / 365)
  return Number.isFinite(value) ? Math.round(value * 100) / 100 : null
}

function normalizeCode(code: string): string {
  return code
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/** Résout la première valeur numérique dont le codeMachine normalisé satisfait le prédicat. */
function findNumericField(
  fields: SerializedTransaction["fields"],
  matches: (normalizedCode: string) => boolean
): number | null {
  for (const [code, value] of Object.entries(fields)) {
    if (!matches(normalizeCode(code))) continue
    const n = toNumber(value)
    if (n !== null) return n
  }
  return null
}

const roundInt = (value: number | null): number | null => (value === null ? null : Math.round(value))

/**
 * Indicateurs ajustés dans le temps (§7.8.2). Les surfaces sont retrouvées par code normalisé car les
 * libellés importés varient (`superficie_cultive_ha`, `superficieCultivée`, …). Les valeurs de référence
 * absentes comptent pour 0, ce qui correspond à un taux résiduel calculé sans construction à soustraire.
 */
export function computeAdjustedValues(
  fields: SerializedTransaction["fields"],
  params: ExportAnalysisParams
): Record<string, number | null> {
  const prixAjuste = computePrixActualise(fields, params)
  const superficieTotale = findNumericField(fields, (code) => code.startsWith("superficietotale"))
  const cultivee = findNumericField(fields, (code) => code.startsWith("superficiecultiv"))
  const boisee = findNumericField(fields, (code) => code.startsWith("superficiebois"))
  const batiment = findNumericField(fields, (code) => code.startsWith("superficiebatim"))
  const entailles = findNumericField(fields, (code) => code.startsWith("nombreentail") || code.startsWith("nbentail"))

  const tauxBoise = findNumericField(fields, (code) => code === "tauxboiseref") ?? 0
  const tauxCultive = findNumericField(fields, (code) => code === "tauxcultiveref") ?? 0
  const valeurBatiment = findNumericField(fields, (code) => code === "valeurbatiments") ?? 0
  const valeurMaison = findNumericField(fields, (code) => code === "valeurmaison") ?? 0
  const valeurTerrain = findNumericField(fields, (code) => code === "valeurterrainresidentiel") ?? 0

  const constructions = valeurBatiment + valeurMaison + valeurTerrain

  return {
    prix_actualise: prixAjuste,
    taux_global_ajuste:
      prixAjuste !== null && superficieTotale !== null && superficieTotale > 0
        ? roundInt(prixAjuste / superficieTotale)
        : null,
    taux_residuel_cultive_ajuste:
      prixAjuste !== null && cultivee !== null && cultivee > 0
        ? roundInt((prixAjuste - (boisee ?? 0) * tauxBoise - constructions) / cultivee)
        : null,
    taux_residuel_boise_ajuste:
      prixAjuste !== null && boisee !== null && boisee > 0
        ? roundInt((prixAjuste - (cultivee ?? 0) * tauxCultive - constructions) / boisee)
        : null,
    taux_residuel_batiment_ajuste:
      prixAjuste !== null && batiment !== null && batiment > 0
        ? roundInt(
            (prixAjuste - (cultivee ?? 0) * tauxCultive - (boisee ?? 0) * tauxBoise - valeurMaison - valeurTerrain) /
              batiment
          )
        : null,
    taux_par_entaille_ajuste:
      prixAjuste !== null && entailles !== null && entailles > 0
        ? roundInt(
            (prixAjuste - (cultivee ?? 0) * tauxCultive - (boisee ?? 0) * tauxBoise - constructions) / entailles
          )
        : null,
  }
}
