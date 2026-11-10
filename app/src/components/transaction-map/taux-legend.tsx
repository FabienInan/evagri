"use client"

import { formatTauxClasse, type TauxClasse } from "@/lib/taux-classes"

/** Légende des couleurs de pins selon le taux global. Absente tant qu'aucune transaction n'a de taux. */
export function TauxLegend({ classes }: { classes: TauxClasse[] }) {
  if (classes.length === 0) return null
  return (
    <div className="absolute bottom-6 left-3 z-[1000] rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-foreground">Taux global ($/ha)</p>
      <ul className="space-y-1">
        {classes.map((classe) => (
          <li key={classe.color} className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block h-3 w-3 rounded-full border border-border" style={{ backgroundColor: classe.color }} />
            <span className="tabular-nums">{formatTauxClasse(classe)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
