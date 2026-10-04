import { z } from "zod"
import { validateRuleSyntax } from "@/lib/calculator"
import { isSourceFieldCode } from "@/lib/transaction-source-fields"
import type { ChampEnrichissableInput, NatureChamp } from "@/types/champ"

export interface ChampValidationError {
  field: string
  message: string
}

const CODE_MACHINE_PATTERN = /^[a-z][a-z0-9_]*$/

const CHAMP_FIELD_LABELS: Record<string, string> = {
  codeMachine: "Code machine",
  nomAffichage: "Nom affiché",
  typeDonnees: "Type de données",
  nature: "Nature",
  unite: "Unité",
  plageMin: "Plage minimale",
  plageMax: "Plage maximale",
  optionsListe: "Options de liste",
  regleCalcul: "Règle de calcul",
  applicableATypes: "Types de transaction applicables",
  ordreAffichage: "Ordre d'affichage",
  estAffiche: "Affiché sur la fiche",
  estObligatoire: "Obligatoire",
}

/**
 * Renders Zod issues as readable French sentences. A bare ZodError's `.message` is the JSON-serialised
 * issues array, which is what ends up on screen when a server action lets it bubble up uncaught.
 */
export function formatChampInputErrors(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const key = issue.path.join(".")
      const label = CHAMP_FIELD_LABELS[key] ?? key

      switch (issue.code) {
        case "too_small":
          return issue.origin === "array"
            ? `« ${label} » : au moins une valeur doit être sélectionnée.`
            : `« ${label} » est obligatoire.`
        case "too_big":
          return `« ${label} » contient trop de valeurs.`
        case "invalid_value":
          return `« ${label} » contient une valeur non autorisée.`
        default:
          return `« ${label} » est invalide.`
      }
    })
    .join(" ")
}

/** est_modifiable is never client-supplied: it is entirely derived from nature (§6.5). */
export function deriveEstModifiable(nature: NatureChamp): boolean {
  return nature === "SAISISSABLE"
}

/**
 * Applies the nature-dependent invariants from §6.5 before persisting:
 * unite forced to "N/A" for non-numeric types, est_obligatoire ignored for CALCULE fields.
 */
export function normalizeChampInput(input: ChampEnrichissableInput): ChampEnrichissableInput {
  const isNumeric = input.typeDonnees === "DECIMAL" || input.typeDonnees === "ENTIER"

  return {
    ...input,
    unite: isNumeric ? input.unite : "N/A",
    estObligatoire: input.nature === "SAISISSABLE" ? input.estObligatoire : false,
    regleCalcul: input.regleCalcul?.trim() ? input.regleCalcul.trim() : null,
  }
}

/** knownFieldCodes must contain every source field code and every other champ's codeMachine for the organisation. */
export function validateChampConfig(
  input: ChampEnrichissableInput,
  knownFieldCodes: Set<string>
): ChampValidationError[] {
  const errors: ChampValidationError[] = []

  if (!CODE_MACHINE_PATTERN.test(input.codeMachine)) {
    errors.push({
      field: "codeMachine",
      message: "Le code machine doit etre en snake_case (minuscules, chiffres, underscores, commence par une lettre).",
    })
  } else if (isSourceFieldCode(input.codeMachine)) {
    // A champ shadowing a source code would make a regle_calcul ambiguous (enrichi wins over source).
    errors.push({ field: "codeMachine", message: "Ce code machine est reserve a un champ source." })
  }

  if (!input.nomAffichage.trim()) {
    errors.push({ field: "nomAffichage", message: "Le nom affiche est obligatoire." })
  }

  const isNumeric = input.typeDonnees === "DECIMAL" || input.typeDonnees === "ENTIER"
  if (isNumeric && (!input.unite || input.unite === "N/A")) {
    errors.push({ field: "unite", message: "L'unite est obligatoire pour un champ decimal ou entier." })
  }

  if (input.plageMin !== null && input.plageMax !== null && input.plageMin > input.plageMax) {
    errors.push({
      field: "plageMax",
      message: "La plage maximale doit etre superieure ou egale a la plage minimale.",
    })
  }

  if (input.typeDonnees === "LISTE" && (!input.optionsListe || input.optionsListe.length === 0)) {
    errors.push({ field: "optionsListe", message: "Une liste doit contenir au moins une option." })
  }

  const regleCalcul = input.regleCalcul?.trim() ?? ""

  if (input.nature === "CALCULE" && !regleCalcul) {
    errors.push({ field: "regleCalcul", message: "La regle de calcul est obligatoire pour un champ calcule." })
  }

  if (regleCalcul) {
    const result = validateRuleSyntax(regleCalcul, knownFieldCodes)
    if (!result.valid) {
      errors.push({ field: "regleCalcul", message: result.error })
    }
  }

  if (!input.applicableATypes || input.applicableATypes.length === 0) {
    errors.push({ field: "applicableATypes", message: "Au moins un type de transaction doit etre selectionne." })
  }

  return errors
}
