import type { ChampEnrichissableConfig, FicheSection, TypeDonneesChamp } from "@/types/champ"
import { SOURCE_FIELDS } from "@/lib/transaction-source-fields"
import { evaluateRule, roundToInteger, type CalculationContext } from "@/lib/calculator"
import type { TypologieOption } from "@/repositories/typologie.repository"
import { validateEnrichment, validateSaleDate, type RangeCheck } from "@/lib/validation"

export type FicheMode = "edition" | "consultation"
export type FicheValeur = string | number | boolean | null

/** codeMachine of the champ that carries the transaction type (§7.5.3). Rendered in the header, not in a section. */
export const TYPE_TRANSACTION_CODE = "typeTransaction"

export interface FicheChamp {
  config: ChampEnrichissableConfig
  valeur: FicheValeur
}

export interface FicheSectionChamps {
  section: FicheSection
  champs: FicheChamp[]
}

export interface FicheViewModel {
  mainSections: FicheSectionChamps[]
  indicateurs: FicheChamp[]
}

export function deriveFicheMode(statut: string | null | undefined): FicheMode {
  return statut === "Analysée" ? "consultation" : "edition"
}

/** An empty applicableATypes means the champ applies everywhere; an unset transaction type disables filtering
 *  so the user can still fill the form (including the mandatory type). */
export function isChampApplicable(champ: { applicableATypes: string[] }, typeCode: string | null): boolean {
  if (!champ.applicableATypes || champ.applicableATypes.length === 0) return true
  if (!typeCode) return true
  return champ.applicableATypes.includes(typeCode)
}

export function buildFicheViewModel(input: {
  sections: FicheSection[]
  champs: ChampEnrichissableConfig[]
  valeurs: Record<string, FicheValeur>
  typeCode: string | null
}): FicheViewModel {
  const byId = new Map(input.champs.map((c) => [c.id, c]))

  const mainSections: FicheSectionChamps[] = []
  for (const section of [...input.sections].sort((a, b) => a.ordre - b.ordre)) {
    const champs: FicheChamp[] = []
    for (const id of section.champs) {
      const config = byId.get(id)
      if (!config) continue
      if (config.nature !== "SAISISSABLE") continue
      if (config.codeMachine === TYPE_TRANSACTION_CODE) continue
      if (!config.actif || !config.estAffiche) continue
      if (!isChampApplicable(config, input.typeCode)) continue
      champs.push({ config, valeur: input.valeurs[config.codeMachine] ?? null })
    }
    if (champs.length > 0) mainSections.push({ section, champs })
  }

  const indicateurs: FicheChamp[] = input.champs
    .filter((c) => c.nature === "CALCULE" && c.actif && c.estAffiche && isChampApplicable(c, input.typeCode))
    .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
    .map((config) => ({ config, valeur: input.valeurs[config.codeMachine] ?? null }))

  return { mainSections, indicateurs }
}

export function formatFicheValue(typeDonnees: TypeDonneesChamp, valeur: FicheValeur): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—"
  switch (typeDonnees) {
    case "BOOLEAN":
      return valeur ? "Oui" : "Non"
    case "DATE":
      return new Date(String(valeur)).toLocaleDateString("fr-CA")
    case "DECIMAL":
      return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(Number(valeur))
    case "ENTIER":
      return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(Number(valeur))
    default:
      return String(valeur)
  }
}

export function formatSourceFieldValue(
  field: { column: string; typeDonnees: TypeDonneesChamp; array?: boolean },
  transaction: Record<string, unknown>
): string {
  const raw = transaction[field.column]
  if (field.array) {
    const list = Array.isArray(raw) ? raw : []
    return list.length > 0 ? list.join(", ") : "—"
  }
  if (raw === null || raw === undefined || raw === "") return "—"
  return formatFicheValue(field.typeDonnees, raw as FicheValeur)
}

/** Only numeric source columns feed the calculation/validation context; text/date/array columns yield null. */
export function buildSourceNumbers(transaction: Record<string, unknown>): Record<string, number | null> {
  const source: Record<string, number | null> = {}
  for (const field of SOURCE_FIELDS) {
    if (field.array) continue
    const raw = transaction[field.column]
    source[field.code] = typeof raw === "number" ? raw : null
  }
  return source
}

export function buildCalculationContext(
  transaction: Record<string, unknown>,
  enrichiValues: Record<string, number | null>
): CalculationContext {
  return { source: buildSourceNumbers(transaction), enrichi: enrichiValues }
}

export function toNumericValues(valeurs: Record<string, FicheValeur>): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const [code, valeur] of Object.entries(valeurs)) {
    if (typeof valeur === "number") {
      result[code] = valeur
    } else if (typeof valeur === "string" && valeur.trim() !== "") {
      const n = Number(valeur)
      if (!Number.isNaN(n)) result[code] = n
    }
  }
  return result
}

export function recomputeIndicateurs(
  champs: ChampEnrichissableConfig[],
  context: CalculationContext
): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const champ of champs) {
    if (champ.nature !== "CALCULE" || !champ.regleCalcul) continue
    result[champ.codeMachine] = roundToInteger(evaluateRule(champ.regleCalcul, context))
  }
  return result
}

export function toStorageValue(
  typeDonnees: TypeDonneesChamp,
  valeur: FicheValeur
): { valeurNombre: number | null; valeurTexte: string | null; valeurBooleen: boolean | null } {
  const empty = { valeurNombre: null, valeurTexte: null, valeurBooleen: null }
  if (valeur === null || valeur === undefined || valeur === "") return empty

  switch (typeDonnees) {
    case "DECIMAL":
    case "ENTIER": {
      const n = typeof valeur === "number" ? valeur : Number(valeur)
      return Number.isNaN(n) ? empty : { ...empty, valeurNombre: n }
    }
    case "BOOLEAN": {
      const b = typeof valeur === "boolean" ? valeur : valeur === "true"
      return { ...empty, valeurBooleen: b }
    }
    default:
      return { ...empty, valeurTexte: String(valeur) }
  }
}

/** Resolves the stored type value (canonical code, or a legacy display name written by the importer). */
export function resolveTypeTransaction(
  valeur: FicheValeur,
  typologies: TypologieOption[]
): TypologieOption | null {
  if (typeof valeur !== "string" || valeur === "") return null
  return typologies.find((t) => t.code === valeur) ?? typologies.find((t) => t.nom === valeur) ?? null
}

export interface FicheValidationError {
  code: string
  message: string
}

/** Enrichi codeMachine aliases for the superficie slots used by V-001/V-002/V-005. Accent-free variants cover
 *  the codes produced by the importer's buildCodeMachine (accents stripped). */
const SUPERFICIE_ALIASES = {
  superficieCultivee: ["superficie_cultivee"],
  superficieBoisee: ["superficie_boisee"],
  superficieConstructible: ["superficie_constructible"],
  superficieDrainee: ["superficie_drainee"],
  superficieAcericole: ["superficie_acericole", "superficie_acéricole"],
} as const

function pickNumber(valeurs: Record<string, FicheValeur>, aliases: readonly string[]): number | null {
  for (const code of aliases) {
    const v = valeurs[code]
    if (typeof v === "number") return v
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v)
      if (!Number.isNaN(n)) return n
    }
  }
  return null
}

/** Blocking rules (§7.8.3): V-001..V-007, mandatory sale type (§7.5.3) and est_obligatoire fields. */
export function validateFiche(input: {
  champs: ChampEnrichissableConfig[]
  valeurs: Record<string, FicheValeur>
  source: Record<string, number | null>
  typeCode: string | null
  dateVente: string | null
}): FicheValidationError[] {
  const errors: FicheValidationError[] = []

  if (!input.typeCode) {
    errors.push({ code: "V-TYPE", message: "Le type de transaction est obligatoire." })
  }

  for (const champ of input.champs) {
    if (champ.nature !== "SAISISSABLE" || !champ.estObligatoire) continue
    const v = input.valeurs[champ.codeMachine]
    if (v === null || v === undefined || v === "") {
      errors.push({ code: "V-OBLIG", message: `${champ.nomAffichage} est obligatoire.` })
    }
  }

  if (input.dateVente) {
    errors.push(...validateSaleDate(new Date(input.dateVente)))
  }

  const valeursNumeriques: Record<string, number | null> = {}
  const champsPourcentage: Record<string, number | null> = {}
  const plages: Record<string, RangeCheck> = {}

  for (const champ of input.champs) {
    if (champ.nature !== "SAISISSABLE") continue
    const value = pickNumber(input.valeurs, [champ.codeMachine])

    if (value !== null && champ.typeDonnees !== "TEXTE" && champ.typeDonnees !== "LISTE" && champ.typeDonnees !== "DATE" && champ.typeDonnees !== "BOOLEAN") {
      if (champ.codeMachine !== "longitude") valeursNumeriques[champ.codeMachine] = value
    }
    if (value !== null && champ.unite === "%") champsPourcentage[champ.codeMachine] = value
    if (champ.plageMin !== null || champ.plageMax !== null) {
      plages[champ.codeMachine] = { min: champ.plageMin, max: champ.plageMax, valeur: value }
    }
  }

  const surfaceErrors = validateEnrichment({
    superficieTotaleHectare: input.source["superficie_totale_hectare"] ?? null,
    superficieCultivee: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieCultivee),
    superficieBoisee: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieBoisee),
    superficieConstructible: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieConstructible),
    superficieDrainee: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieDrainee),
    superficieAcericole: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieAcericole),
    champsPourcentage,
    valeursNumeriques,
    plages,
  })

  errors.push(...surfaceErrors)
  return errors
}
