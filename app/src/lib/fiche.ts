import type { ChampEnrichissableConfig, FicheSection, TypeDonneesChamp } from "@/types/champ"
import { SOURCE_FIELDS } from "@/lib/transaction-source-fields"
import { evaluateRule, roundToInteger, type CalculationContext } from "@/lib/calculator"
import type { TypologieOption } from "@/repositories/typologie.repository"
import { validateEnrichment, validateSaleDate, type RangeCheck } from "@/lib/validation"
import { joinMultiValue } from "@/lib/multi-value"

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

/** A champ is visible on the fiche iff it is active, displayed, applicable to the transaction type,
 *  and placed in a saved section (Decision 2: the saved layout is the source of truth). Rendering and
 *  validation MUST use this same predicate so an invisible champ can never block the save. */
export function isChampVisible(
  champ: ChampEnrichissableConfig,
  typeCode: string | null,
  placedChampIds: ReadonlySet<string>
): boolean {
  return (
    champ.actif &&
    champ.estAffiche &&
    isChampApplicable(champ, typeCode) &&
    placedChampIds.has(champ.id)
  )
}

export function buildFicheViewModel(input: {
  sections: FicheSection[]
  champs: ChampEnrichissableConfig[]
  valeurs: Record<string, FicheValeur>
  typeCode: string | null
}): FicheViewModel {
  const byId = new Map(input.champs.map((c) => [c.id, c]))
  const placedChampIds = new Set(input.sections.flatMap((s) => s.champs))

  const mainSections: FicheSectionChamps[] = []
  for (const section of [...input.sections].sort((a, b) => a.ordre - b.ordre)) {
    const champs: FicheChamp[] = []
    for (const id of section.champs) {
      const config = byId.get(id)
      if (!config) continue
      if (config.nature !== "SAISISSABLE") continue
      if (config.codeMachine === TYPE_TRANSACTION_CODE) continue
      if (!isChampVisible(config, input.typeCode, placedChampIds)) continue
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

/** Interprets a stored boolean-ish value: the form sends real booleans, but an imported or legacy value
 *  may arrive as text ("false", "0"), which a plain truthiness check would render as "Oui". */
function isTruthy(valeur: FicheValeur): boolean {
  if (typeof valeur === "boolean") return valeur
  if (typeof valeur === "number") return valeur !== 0
  const normalized = String(valeur).trim().toLowerCase()
  return normalized !== "" && normalized !== "false" && normalized !== "0" && normalized !== "non"
}

export function formatFicheValue(typeDonnees: TypeDonneesChamp, valeur: FicheValeur): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—"
  switch (typeDonnees) {
    case "BOOLEAN":
      return isTruthy(valeur) ? "Oui" : "Non"
    case "DATE": {
      const date = new Date(String(valeur))
      return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-CA")
    }
    case "DECIMAL":
    case "ENTIER": {
      const n = typeof valeur === "number" ? valeur : Number(valeur)
      if (Number.isNaN(n)) return String(valeur)
      return new Intl.NumberFormat("fr-CA", {
        maximumFractionDigits: typeDonnees === "DECIMAL" ? 2 : 0,
      }).format(n)
    }
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
  const calcule = champs.filter((champ) => champ.nature === "CALCULE" && champ.regleCalcul)
  const enrichi: Record<string, number | null> = { ...context.enrichi }
  const result: Record<string, number | null> = {}

  // Iterate to a fixpoint so a rule can reference another CALCULE field whose own value is computed in
  // this same pass, regardless of the order the champs are listed in. Bounded to avoid a cyclic-rule loop.
  let changed = true
  let passes = 0
  while (changed && passes <= calcule.length) {
    passes += 1
    changed = false
    for (const champ of calcule) {
      const value = roundToInteger(evaluateRule(champ.regleCalcul as string, { source: context.source, enrichi }))
      if (!(champ.codeMachine in result) || result[champ.codeMachine] !== value) {
        changed = true
      }
      result[champ.codeMachine] = value
      enrichi[champ.codeMachine] = value
    }
  }

  return result
}

/** Returns the displayed values with the CALCULE indicators recomputed from the source columns and the
 *  current enrichment values. Used both when the fiche opens (indicators must show immediately, not only
 *  after a blur) and whenever a field changes; the computed values are persisted on save like any other. */
export function withRecomputedIndicateurs(
  champs: ChampEnrichissableConfig[],
  transaction: Record<string, unknown>,
  valeurs: Record<string, FicheValeur>
): Record<string, FicheValeur> {
  const context = buildCalculationContext(transaction, toNumericValues(valeurs))
  return { ...valeurs, ...recomputeIndicateurs(champs, context) }
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
    case "MULTI_SELECT": {
      const text = Array.isArray(valeur) ? joinMultiValue(valeur) : String(valeur)
      return text === null ? empty : { ...empty, valeurTexte: text }
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
  /** codeMachine du champ à corriger, pour afficher le message sous ce champ ; null = au niveau de la fiche. */
  champ: string | null
}

/** Comparison roots for the enrichi fields checked against superficie_totale_hectare (V-001/V-002/V-005).
 *  Codes differ between the importer (`superficie_cultive_ha`), a manually created champ
 *  (`superficie_cultivee`) and accented forms, so matching is normalized (see superficieMatchKey)
 *  rather than literal. See filters.ts / filter-icons.ts for the authoritative code list. */
const SUPERFICIE_ROOTS = {
  superficieCultivee: ["superficiecultive"],
  superficieBoisee: ["superficieboise"],
  superficieConstructible: ["superficieconstructible"],
  superficieDrainee: ["superficiedraine"],
  // The importer drops the accent (acricole) while a transliterated manual code keeps it (acericole).
  superficieAcericole: ["superficieacricole", "superficieacericole"],
} as const

/** Reduces a codeMachine to a comparison key: case, accents, separators, the hectare/metre unit suffix and
 *  repeated letters are ignored, so `superficie_cultive_ha`, `superficieCultivée` and `superficie_cultivee`
 *  all reduce to `superficiecultive`. */
function superficieMatchKey(code: string): string {
  return code
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .replace(/(hectares?|ha|m2|m)$/, "")
    .replace(/(.)\1+/g, "$1")
}

/** The enrichi field whose normalized code matches one of the roots (see SUPERFICIE_ROOTS), with its
 *  codeMachine so a rule can point the user at the field to correct. */
function pickSuperficie(
  valeurs: Record<string, FicheValeur>,
  roots: readonly string[]
): { code: string; valeur: number } | null {
  for (const [code, valeur] of Object.entries(valeurs)) {
    if (!roots.includes(superficieMatchKey(code))) continue
    if (typeof valeur === "number") return { code, valeur }
    if (typeof valeur === "string" && valeur.trim() !== "") {
      const n = Number(valeur)
      if (!Number.isNaN(n)) return { code, valeur: n }
    }
  }
  return null
}

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
  sections: FicheSection[]
  valeurs: Record<string, FicheValeur>
  source: Record<string, number | null>
  typeCode: string | null
  dateVente: string | null
}): FicheValidationError[] {
  const errors: FicheValidationError[] = []

  const placedChampIds = new Set(input.sections.flatMap((s) => s.champs))
  // Validation uses the SAME visibility predicate as rendering: a champ the user cannot see must never
  // block the save (an obligatory-but-hidden or unplaced champ would brick Enregistrer/Analyser forever),
  // and a stale value of a hidden champ must not raise spurious V-003/V-006/V-007.
  const champs = input.champs.filter((c) => isChampVisible(c, input.typeCode, placedChampIds))
  const visibleCodes = new Set(champs.map((c) => c.codeMachine))
  const valeursVisibles: Record<string, FicheValeur> = Object.fromEntries(
    Object.entries(input.valeurs).filter(([code]) => visibleCodes.has(code))
  )

  if (!input.typeCode) {
    errors.push({ code: "V-TYPE", champ: TYPE_TRANSACTION_CODE, message: "Le type de transaction est obligatoire." })
  }

  for (const champ of champs) {
    if (champ.nature !== "SAISISSABLE" || !champ.estObligatoire) continue
    const v = input.valeurs[champ.codeMachine]
    if (v === null || v === undefined || v === "") {
      errors.push({
        code: "V-OBLIG",
        champ: champ.codeMachine,
        message: `Le champ « ${champ.nomAffichage} » est obligatoire.`,
      })
    }
  }

  if (input.dateVente) {
    errors.push(...validateSaleDate(new Date(input.dateVente)))
  }

  const valeursNumeriques: Record<string, number | null> = {}
  const champsPourcentage: Record<string, number | null> = {}
  const plages: Record<string, RangeCheck> = {}

  for (const champ of champs) {
    if (champ.nature !== "SAISISSABLE") continue
    const value = pickNumber(input.valeurs, [champ.codeMachine])

    if (value !== null && champ.typeDonnees !== "TEXTE" && champ.typeDonnees !== "LISTE" && champ.typeDonnees !== "MULTI_SELECT" && champ.typeDonnees !== "DATE" && champ.typeDonnees !== "BOOLEAN") {
      if (champ.codeMachine !== "longitude") valeursNumeriques[champ.codeMachine] = value
    }
    if (value !== null && champ.unite === "%") champsPourcentage[champ.codeMachine] = value
    if (champ.plageMin !== null || champ.plageMax !== null) {
      plages[champ.codeMachine] = { min: champ.plageMin, max: champ.plageMax, valeur: value }
    }
  }

  const cultivee = pickSuperficie(valeursVisibles, SUPERFICIE_ROOTS.superficieCultivee)
  const boisee = pickSuperficie(valeursVisibles, SUPERFICIE_ROOTS.superficieBoisee)
  const constructible = pickSuperficie(valeursVisibles, SUPERFICIE_ROOTS.superficieConstructible)
  const drainee = pickSuperficie(valeursVisibles, SUPERFICIE_ROOTS.superficieDrainee)
  const acericole = pickSuperficie(valeursVisibles, SUPERFICIE_ROOTS.superficieAcericole)

  const surfaceErrors = validateEnrichment({
    superficieTotaleHectare: input.source["superficie_totale_hectare"] ?? null,
    superficieCultivee: cultivee?.valeur ?? null,
    superficieBoisee: boisee?.valeur ?? null,
    superficieConstructible: constructible?.valeur ?? null,
    superficieDrainee: drainee?.valeur ?? null,
    superficieAcericole: acericole?.valeur ?? null,
    champsPourcentage,
    valeursNumeriques,
    plages,
    labels: Object.fromEntries(champs.map((c) => [c.codeMachine, c.nomAffichage])),
    codes: { drainee: drainee?.code ?? null, acericole: acericole?.code ?? null },
  })

  errors.push(...surfaceErrors)
  return errors
}

/** Entries persisted for a save: enrichment champs plus the header's type de transaction. */
export function buildStorageEntries(
  champs: ChampEnrichissableConfig[],
  valeurs: Record<string, FicheValeur>,
  typeTransactionCode: string | null
): { champEnrichissableId: string; valeurNombre: number | null; valeurTexte: string | null; valeurBooleen: boolean | null }[] {
  const entries: { champEnrichissableId: string; valeurNombre: number | null; valeurTexte: string | null; valeurBooleen: boolean | null }[] = []

  for (const champ of champs) {
    if (champ.codeMachine === TYPE_TRANSACTION_CODE) continue
    const raw = valeurs[champ.codeMachine]
    if (raw === undefined) continue
    const stored = toStorageValue(champ.typeDonnees, raw)
    if (stored.valeurNombre === null && stored.valeurTexte === null && stored.valeurBooleen === null) continue
    entries.push({ champEnrichissableId: champ.id, ...stored })
  }

  if (typeTransactionCode) {
    const typeChamp = champs.find((c) => c.codeMachine === TYPE_TRANSACTION_CODE)
    if (typeChamp) {
      entries.push({
        champEnrichissableId: typeChamp.id,
        valeurNombre: null,
        valeurTexte: typeTransactionCode,
        valeurBooleen: null,
      })
    }
  }

  return entries
}
