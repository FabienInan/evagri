import type { TypeDonneesChamp } from "@/types/champ"

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value)
}

/** Interprets a stored boolean-ish value: the form sends real booleans, but an imported or legacy value
 *  may arrive as text ("false", "0"), which a plain truthiness check would render as "Oui". */
function isTruthy(value: string | number | boolean): boolean {
  if (typeof value === "boolean") return value
  if (typeof value === "number") return value !== 0
  const normalized = value.trim().toLowerCase()
  return normalized !== "" && normalized !== "false" && normalized !== "0" && normalized !== "non"
}

function formatNumber(value: number, maximumFractionDigits: number): string {
  return new Intl.NumberFormat("fr-CA", { maximumFractionDigits }).format(value)
}

/**
 * Canonical display formatting for a stored flat field value, shared by the transaction list, paniers and
 * the fiche. Dates are formatted in UTC (stored at midnight UTC), decimals keep at most 2 fraction digits,
 * empty values render as "—", and arrays join with ", ".
 */
export function formatCellValue(value: unknown, typeDonnees?: TypeDonneesChamp | null): string {
  if (value === null || value === undefined || value === "") return "—"
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—"

  switch (typeDonnees) {
    case "BOOLEAN":
      return isTruthy(value as string | number | boolean) ? "Oui" : "Non"
    case "DATE": {
      const date = new Date(String(value))
      // Les dates sont des valeurs sans heure, stockées à minuit UTC : les formater en heure locale
      // décalerait l'affichage d'un jour dans les fuseaux derrière UTC (ex. Montréal).
      return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("fr-CA", { timeZone: "UTC" })
    }
    case "DECIMAL":
    case "ENTIER": {
      const n = typeof value === "number" ? value : Number(value)
      if (Number.isNaN(n)) return String(value)
      return formatNumber(n, typeDonnees === "DECIMAL" ? 2 : 0)
    }
    default:
      if (typeof value === "boolean") return value ? "Oui" : "Non"
      if (typeof value === "number") return formatNumber(value, 2)
      return String(value)
  }
}
