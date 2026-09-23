"use client"

import { SectionCard } from "@/components/fiche/section-card"
import { formatSourceFieldValue } from "@/lib/fiche"
import { SOURCE_FIELDS } from "@/lib/transaction-source-fields"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"

export function SourceDataPanel({ transaction }: { transaction: SerializedTransaction }) {
  return (
    <SectionCard title="Données sources">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SOURCE_FIELDS.map((field) => (
          <div key={field.code}>
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="text-sm text-foreground">
              {formatSourceFieldValue(field, transaction as unknown as Record<string, unknown>)}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
