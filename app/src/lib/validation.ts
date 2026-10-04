const EPSILON = 1e-9

export type ValidationCode = "V-001" | "V-002" | "V-003" | "V-004" | "V-005" | "V-006" | "V-007"

export interface ValidationError {
  code: ValidationCode
  message: string
  /** codeMachine du champ à corriger, pour afficher le message sous ce champ ; null = message au niveau de la fiche. */
  champ: string | null
}

export interface RangeCheck {
  min?: number | null
  max?: number | null
  valeur: number | null
}

/** Caller is expected to exclude longitude (the one field allowed to be negative per V-006) from valeursNumeriques. */
export interface EnrichmentValidationInput {
  superficieTotaleHectare?: number | null
  superficieCultivee?: number | null
  superficieBoisee?: number | null
  superficieConstructible?: number | null
  superficieDrainee?: number | null
  superficieAcericole?: number | null
  champsPourcentage?: Record<string, number | null>
  valeursNumeriques?: Record<string, number | null>
  plages?: Record<string, RangeCheck>
  /** nomAffichage par codeMachine, pour nommer le champ dans le message (repli : le codeMachine). */
  labels?: Record<string, string>
  /** codeMachine des champs de superficie, pour rattacher V-002/V-005 au champ que l'utilisateur doit corriger. */
  codes?: { drainee?: string | null; acericole?: string | null }
}

function label(champ: string, labels: Record<string, string> | undefined): string {
  return labels?.[champ] ?? champ
}

/** Gender-neutral wrapper: the champ's nomAffichage comes from the database, so its article/gender is unknown
 *  ("le taux", "les zones humides") and a bare name would produce "La taux ...". */
function plageMessage(champ: string, labels: Record<string, string> | undefined, min: number | null, max: number | null): string {
  const nom = label(champ, labels)
  if (min !== null && max !== null) return `Le champ « ${nom} » doit être compris entre ${min} et ${max}.`
  if (min !== null) return `Le champ « ${nom} » doit être supérieur ou égal à ${min}.`
  return `Le champ « ${nom} » doit être inférieur ou égal à ${max}.`
}

/** Blocking rules V-001, V-002, V-003, V-005, V-006, V-007 (cahier des charges §7.8.3). V-004 lives in validateSaleDate. */
export function validateEnrichment(input: EnrichmentValidationInput): ValidationError[] {
  const errors: ValidationError[] = []

  const cultivee = input.superficieCultivee ?? 0
  const boisee = input.superficieBoisee ?? 0
  const constructible = input.superficieConstructible ?? 0
  const drainee = input.superficieDrainee ?? 0
  const acericole = input.superficieAcericole ?? 0

  // V-001/V-002/V-005 compare a component sum against a bound. When the bound itself is unknown (null)
  // the comparison is undefined, so it is skipped rather than run against an implicit 0 (a false error).
  // V-001 sums three champs and so has no single field to point at (champ: null); V-002/V-005 point at
  // the field the user must lower.
  if (
    input.superficieTotaleHectare != null &&
    cultivee + boisee + constructible > input.superficieTotaleHectare + EPSILON
  ) {
    errors.push({
      code: "V-001",
      champ: null,
      message: "La somme des superficies (cultivée, boisée, constructible) dépasse la superficie totale.",
    })
  }

  if (input.superficieCultivee != null && drainee > cultivee + EPSILON) {
    errors.push({
      code: "V-002",
      champ: input.codes?.drainee ?? null,
      message: "La superficie drainée ne peut pas dépasser la superficie cultivée.",
    })
  }

  for (const [champ, valeur] of Object.entries(input.champsPourcentage ?? {})) {
    if (valeur !== null && valeur !== undefined && valeur > 100 + EPSILON) {
      errors.push({
        code: "V-003",
        champ,
        message: `Le champ « ${label(champ, input.labels)} » ne peut pas dépasser 100 %.`,
      })
    }
  }

  if (input.superficieBoisee != null && acericole > boisee + EPSILON) {
    errors.push({
      code: "V-005",
      champ: input.codes?.acericole ?? null,
      message: "La superficie acéricole ne peut pas dépasser la superficie boisée.",
    })
  }

  for (const [champ, valeur] of Object.entries(input.valeursNumeriques ?? {})) {
    if (valeur !== null && valeur !== undefined && valeur < 0) {
      errors.push({
        code: "V-006",
        champ,
        message: `Le champ « ${label(champ, input.labels)} » ne peut pas être négatif.`,
      })
    }
  }

  for (const [champ, range] of Object.entries(input.plages ?? {})) {
    if (range.valeur === null || range.valeur === undefined) continue
    const min = range.min ?? null
    const max = range.max ?? null
    const horsPlage =
      (min !== null && range.valeur < min - EPSILON) || (max !== null && range.valeur > max + EPSILON)
    if (horsPlage) {
      errors.push({ code: "V-007", champ, message: plageMessage(champ, input.labels, min, max) })
    }
  }

  return errors
}

/** V-004: rejects a sale date in the future, compared at day granularity. */
export function validateSaleDate(dateVente: Date): ValidationError[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const dateVenteJour = new Date(dateVente)
  dateVenteJour.setHours(0, 0, 0, 0)

  if (dateVenteJour > today) {
    return [{ code: "V-004", champ: null, message: "La date de vente ne peut pas être postérieure à aujourd'hui." }]
  }

  return []
}
