"use client"

import { formatFicheValue, type FicheValeur } from "@/lib/fiche"
import type { TypeDonneesChamp } from "@/types/champ"

export function FieldValue({
  typeDonnees,
  valeur,
}: {
  typeDonnees: TypeDonneesChamp
  valeur: FicheValeur
}) {
  return <span className="text-sm text-foreground">{formatFicheValue(typeDonnees, valeur)}</span>
}
