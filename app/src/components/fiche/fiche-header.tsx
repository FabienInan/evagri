"use client"

import { Check, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
  error,
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
  error: string | null
  onTypeChange: (code: string | null) => void
  onSave: () => void
  onAnalyse: () => void
}) {
  const isEdition = mode === "edition"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <p className="text-xs text-muted-foreground">N° d&apos;inscription</p>
            <p className="text-sm font-medium text-foreground">{transaction.numeroInscription ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">N° de lot</p>
            <p className="text-sm font-medium text-foreground">
              {transaction.lotsCadastraux.length > 0 ? transaction.lotsCadastraux.join(", ") : "—"}
            </p>
          </div>
          <Badge variant={statut === "Analysée" ? "default" : "warning"}>{statut}</Badge>
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

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Type de transaction *</span>
        <Select
          value={typeCode ?? ""}
          disabled={!isEdition}
          onValueChange={(v) => onTypeChange(v || null)}
        >
          <SelectTrigger className="h-9 w-64 rounded-lg">
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

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
