"use client"

import { SectionCard } from "@/components/fiche/section-card"
import { FieldValue } from "@/components/fiche/field-value"
import type { FicheChamp } from "@/lib/fiche"

export function IndicateursPanel({ indicateurs }: { indicateurs: FicheChamp[] }) {
  return (
    <SectionCard title="Indicateurs">
      {indicateurs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun indicateur.</p>
      ) : (
        <dl className="space-y-2">
          {indicateurs.map(({ config, valeur }) => (
            <div key={config.id} className="flex items-center justify-between gap-3">
              <dt className="text-sm text-muted-foreground">
                {config.nomAffichage}
                {config.unite !== "N/A" ? ` (${config.unite})` : ""}
              </dt>
              <dd>
                <FieldValue typeDonnees={config.typeDonnees} valeur={valeur} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SectionCard>
  )
}
