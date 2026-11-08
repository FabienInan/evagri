"use client"

import { Input } from "@/components/ui/input"

/**
 * Saisie d'une date de filtre avec calendrier. L'opérateur « entre » prend deux dates (début, fin), jointes par une
 * virgule comme l'attend le serveur ; les autres opérateurs prennent une seule date (AAAA-MM-JJ).
 */
export function DateFilterInput({
  value,
  operator,
  onChange,
}: {
  value: string
  operator: string
  onChange: (value: string) => void
}) {
  if (operator === "entre") {
    const [debut = "", fin = ""] = value.split(",")
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <Input
          type="date"
          aria-label="Date de début"
          className="min-w-0 flex-1 text-sm"
          value={debut}
          max={fin || undefined}
          onChange={(e) => onChange(`${e.target.value},${fin}`)}
        />
        <span className="text-xs text-muted-foreground">au</span>
        <Input
          type="date"
          aria-label="Date de fin"
          className="min-w-0 flex-1 text-sm"
          value={fin}
          min={debut || undefined}
          onChange={(e) => onChange(`${debut},${e.target.value}`)}
        />
      </div>
    )
  }

  return (
    <Input
      type="date"
      aria-label="Date"
      className="min-w-0 flex-1 text-sm"
      value={value.split(",")[0] ?? ""}
      onChange={(e) => onChange(e.target.value)}
    />
  )
}
