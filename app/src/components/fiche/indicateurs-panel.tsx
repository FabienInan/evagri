"use client"

import { SectionCard } from "@/components/fiche/section-card"
import { FieldValue } from "@/components/fiche/field-value"
import type { FicheChamp } from "@/lib/fiche"

export function IndicateursPanel({ indicateurs }: { indicateurs: FicheChamp[] }) {
  return (
    <SectionCard
      title="Indicateurs"
      headerClassName="bg-primary/5"
      contentClassName="py-2"
    >
      {indicateurs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun indicateur.</p>
      ) : (
        <dl className="divide-y divide-border/60">
          {indicateurs.map(({ config, valeur }) => (
            <div
              key={config.id}
              className="flex items-baseline justify-between gap-3 py-2.5 first:pt-1 last:pb-1"
            >
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {config.nomAffichage}
                {config.unite !== "N/A" && (
                  <span className="ml-1 normal-case tracking-normal text-muted-foreground/70">
                    ({config.unite})
                  </span>
                )}
              </dt>
              <dd>
                <FieldValue
                  typeDonnees={config.typeDonnees}
                  valeur={valeur}
                  className="text-lg font-semibold"
                />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SectionCard>
  )
}
