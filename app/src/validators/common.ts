import type { ZodError } from "zod"

export interface FormatZodErrorOptions {
  /** Human label per dotted issue path (e.g. `{ nomAffichage: "Nom affiché" }`). */
  labels?: Record<string, string>
  /** Message returned when the error carries no issue. */
  fallback?: string
  /** Join every issue instead of returning the first one. */
  allIssues?: boolean
  /** Return the schema's custom message instead of the generic label-based sentence. */
  preferIssueMessage?: boolean
}

/**
 * Renders Zod issues as readable French sentences. A bare ZodError's `.message` is the JSON-serialised
 * issues array, which is what ends up on screen when a server action lets it bubble up uncaught.
 */
export function formatZodError(error: ZodError, options: FormatZodErrorOptions = {}): string {
  const { labels = {}, fallback = "Données invalides.", allIssues = false, preferIssueMessage = false } = options

  const messages = error.issues.map((issue) => {
    if (preferIssueMessage) return issue.message

    const key = issue.path.join(".")
    const label = labels[key] ?? key

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

  if (messages.length === 0) return fallback
  return (allIssues ? messages : messages.slice(0, 1)).join(" ")
}
