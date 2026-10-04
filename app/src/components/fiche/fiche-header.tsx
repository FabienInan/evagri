"use client"

import { Check, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"
import type { TypologieOption } from "@/repositories/typologie.repository"
import type { FicheMode } from "@/lib/fiche"

export function FicheHeader({
  transaction,
  mode,
  typologies,
  typeCode,
  statut,
  saving,
  errors,
  typeError,
  onTypeChange,
  onSave,
  onAnalyse,
}: {
  transaction: SerializedTransaction
  mode: FicheMode
  typologies: TypologieOption[]
  typeCode: string | null
  statut: string
  saving: boolean
  /** Fiche-wide messages (V-001, V-004, échec générique) — the per-field ones render under their field. */
  errors: string[]
  typeError: string | null
  onTypeChange: (code: string | null) => void
  onSave: () => void
  onAnalyse: () => void
}) {
  const isEdition = mode === "edition"

  return (
    <Card className="gap-0 py-0 pb-0">
      <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            N° d&apos;inscription
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {transaction.numeroInscription ?? "—"}
            </p>
            <Badge variant={statut === "Analysée" ? "default" : "warning"}>{statut}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            N° de lot :{" "}
            <span className="font-medium tabular-nums text-foreground">
              {transaction.lotsCadastraux.length > 0 ? transaction.lotsCadastraux.join(", ") : "—"}
            </span>
          </p>
        </div>

        {isEdition && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" disabled={saving} onClick={onSave}>
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
            <Button size="sm" className="gap-2" disabled={saving} onClick={onAnalyse}>
              <Check className="h-4 w-4" />
              Analyser
            </Button>
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-foreground">
            Type de transaction <span className="text-destructive">*</span>
          </span>
          <Select
            value={typeCode ?? ""}
            disabled={!isEdition}
            onValueChange={(v) => onTypeChange(v || null)}
          >
            <SelectTrigger
              className="h-9 w-64 rounded-lg"
              aria-invalid={typeError ? true : undefined}
              aria-describedby={typeError ? "type-transaction-error" : undefined}
            >
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              {typologies.map((t) => (
                <SelectItem key={t.id} value={t.code}>
                  {t.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {typeError && (
          <p id="type-transaction-error" className="mt-1.5 text-sm text-destructive">
            {typeError}
          </p>
        )}
      </div>

      {errors.length > 0 && (
        <ul className="space-y-1 px-5 pb-4 text-sm text-destructive">
          {errors.map((message, i) => (
            <li key={i}>{message}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}
