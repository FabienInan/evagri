import type { ChampEnrichissableConfig, TypeDonneesChamp } from "@/types/champ"
import { isImportedFieldCode, type ImportedField } from "@/lib/imported-fields"
import type { SerializedTransaction, SerializedValue } from "@/types/transaction"

export type ExportColumnNature = "importe" | "saisissable" | "calcule" | "ajuste"

export interface ExportColumn {
  /** codeMachine du champ, ou clé fixe pour un indicateur ajusté. */
  key: string
  label: string
  nature: ExportColumnNature
  typeDonnees: TypeDonneesChamp
  defaultVisible: boolean
}

export const EXPORT_NATURE_LABELS: Record<ExportColumnNature, string> = {
  importe: "Champs importés",
  saisissable: "Champs à enrichir",
  calcule: "Indicateurs calculés",
  ajuste: "Indicateurs ajustés",
}

/** Indicateurs calculés uniquement dans le contexte de l'export (§7.8.2 / §7.9.3). */
export const ADJUSTED_EXPORT_COLUMNS: ExportColumn[] = [
  { key: "prix_actualise", label: "Prix actualisé", nature: "ajuste", typeDonnees: "DECIMAL", defaultVisible: true },
  { key: "taux_global_ajuste", label: "Taux global ajusté ($/ha)", nature: "ajuste", typeDonnees: "ENTIER", defaultVisible: true },
  { key: "taux_residuel_cultive_ajuste", label: "Taux résiduel cultivé ajusté ($/ha)", nature: "ajuste", typeDonnees: "ENTIER", defaultVisible: true },
  { key: "taux_residuel_boise_ajuste", label: "Taux résiduel boisé ajusté ($/ha)", nature: "ajuste", typeDonnees: "ENTIER", defaultVisible: true },
  { key: "taux_residuel_batiment_ajuste", label: "Taux résiduel bâtiment ajusté ($/pi²)", nature: "ajuste", typeDonnees: "ENTIER", defaultVisible: true },
  { key: "taux_par_entaille_ajuste", label: "Taux par entaille ajusté ($/entaille)", nature: "ajuste", typeDonnees: "ENTIER", defaultVisible: true },
]

export interface ExportAnalysisParams {
  tauxCroissancePct: number
  /** Date d'évaluation au format `YYYY-MM-DD`. */
  dateEvaluation: string
  tauxBoiseRef?: number
  tauxCultiveRef?: number
  valeurBatiment?: number
  valeurMaison?: number
  valeurTerrainResidentiel?: number
}

/**
 * Colonnes proposées à l'export : catalogue importé, puis champs saisissables et calculés actifs, puis les
 * indicateurs ajustés. Les champs de la base qui doublonnent un code importé sont ignorés.
 */
export function buildExportColumns(
  importedFields: ImportedField[],
  champs: ChampEnrichissableConfig[]
): ExportColumn[] {
  const imported: ExportColumn[] = importedFields.map((field) => ({
    key: field.code,
    label: field.label,
    nature: "importe",
    typeDonnees: field.typeDonnees,
    defaultVisible: field.display.defaultVisible,
  }))

  const enrichis: ExportColumn[] = champs
    .filter(
      (champ) =>
        champ.actif &&
        champ.nature !== "IMPORTE" &&
        !isImportedFieldCode(champ.codeMachine)
    )
    .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
    .map((champ) => ({
      key: champ.codeMachine,
      label: champ.nomAffichage,
      nature: champ.nature === "CALCULE" ? "calcule" : "saisissable",
      typeDonnees: champ.typeDonnees,
      defaultVisible: champ.estAffiche,
    }))

  return [...imported, ...enrichis, ...ADJUSTED_EXPORT_COLUMNS]
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

  const tauxBoise = params.tauxBoiseRef ?? 0
  const tauxCultive = params.tauxCultiveRef ?? 0
  const valeurBatiment = params.valeurBatiment ?? 0
  const valeurMaison = params.valeurMaison ?? 0
  const valeurTerrain = params.valeurTerrainResidentiel ?? 0

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

function isTruthyText(value: SerializedValue): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  const normalized = String(value).trim().toLowerCase()
  return normalized !== "" && normalized !== "false" && normalized !== "0" && normalized !== "non"
}

/** Valeur prête pour une cellule Excel : nombres conservés tels quels, dates ISO, listes jointes. */
export function toCellValue(
  value: SerializedValue | undefined,
  typeDonnees: TypeDonneesChamp | null
): string | number | null {
  if (value === null || value === undefined || value === "") return null
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : null

  switch (typeDonnees) {
    case "DATE": {
      const date = new Date(String(value))
      return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10)
    }
    case "BOOLEAN":
      return isTruthyText(value) ? "Oui" : "Non"
    case "DECIMAL":
    case "ENTIER": {
      const n = toNumber(value)
      return n !== null ? n : String(value)
    }
    default:
      if (typeof value === "boolean") return value ? "Oui" : "Non"
      return value
  }
}

export interface ExportTable {
  header: string[]
  rows: (string | number | null)[][]
}

/**
 * Construit la feuille de calcul (en-tête + lignes) pour les colonnes choisies. Les indicateurs ajustés
 * proviennent de l'Analyse de Dossier stockée, indexée par identifiant de transaction.
 */
export function buildExportTable(input: {
  transactions: SerializedTransaction[]
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
  adjustedByTransaction: Record<string, Record<string, number | null>>
  selectedKeys: Iterable<string>
}): ExportTable {
  const selected = new Set(input.selectedKeys)
  const columns = buildExportColumns(input.importedFields, input.champs).filter((column) => selected.has(column.key))

  const rows = input.transactions.map((transaction) => {
    const adjusted = input.adjustedByTransaction[transaction.id] ?? {}
    return columns.map((column) =>
      column.nature === "ajuste"
        ? adjusted[column.key] ?? null
        : toCellValue(transaction.fields[column.key], column.typeDonnees)
    )
  })

  return { header: columns.map((column) => column.label), rows }
}

/** Nom de fichier du classeur, dérivé du nom du panier. */
export function buildExportFileName(nom: string): string {
  const slug = nom
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return `export-${slug || "panier"}.xlsx`
}
