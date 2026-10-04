"use client"

import { formatFicheValue, type FicheValeur } from "@/lib/fiche"
import { cn } from "@/lib/utils"
import type { TypeDonneesChamp } from "@/types/champ"

export function FieldValue({
  typeDonnees,
  valeur,
  className,
}: {
  typeDonnees: TypeDonneesChamp
  valeur: FicheValeur
  className?: string
}) {
  return (
    <span className={cn("text-sm font-medium tabular-nums text-foreground", className)}>
      {formatFicheValue(typeDonnees, valeur)}
    </span>
  )
}
