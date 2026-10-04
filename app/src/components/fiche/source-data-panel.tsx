"use client"

import { SectionCard } from "@/components/fiche/section-card"
import { formatSourceFieldValue } from "@/lib/fiche"
import { SOURCE_FIELDS } from "@/lib/transaction-source-fields"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"

export function SourceDataPanel({ transaction }: { transaction: SerializedTransaction }) {
  return (
    <SectionCard title="Données sources">
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {SOURCE_FIELDS.map((field) => (
          <div key={field.code} className="space-y-0.5">
            <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
            <dd className="text-sm tabular-nums text-foreground">
              {formatSourceFieldValue(field, transaction as unknown as Record<string, unknown>)}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
