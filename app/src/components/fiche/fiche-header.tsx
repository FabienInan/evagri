"use client"

import { Check, Save, Plus, RotateCcw } from "lucide-react"
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
import type { SerializedValue } from "@/serializers/transaction.serializer"
import type { TypologieOption } from "@/types/typologie"
import type { FicheMode } from "@/lib/fiche"

/** Libellés d'affichage du statut (le modèle stocke les codes "ANALYSEE"/"NON_ANALYSEE"). */
export function statutLabel(statut: string): string {
  return statut === "ANALYSEE" ? "Analysée" : "Non analysée"
}

export function FicheHeader({
  fields,
  mode,
  typologies,
  typeCode,
  statut,
  typeError,
  onTypeChange,
  errors,
}: {
  fields: Record<string, SerializedValue>
  mode: FicheMode
  typologies: TypologieOption[]
  typeCode: string | null
  statut: string
  typeError: string | null
  onTypeChange: (code: string | null) => void
  /** Messages de fiche (sans champ) : les messages par champ restent sous leur champ. */
  errors: string[]
}) {
  const isEdition = mode === "edition"
  const numeroInscription = fields.numero_inscription
  const lots = Array.isArray(fields.lots_cadastraux) ? fields.lots_cadastraux : []

  return (
    <Card className="gap-0 py-0 pb-0">
      <div className="flex flex-col gap-4 px-5 pt-5 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            N° d&apos;inscription
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <p className="text-2xl font-semibold tracking-tight tabular-nums text-foreground">
              {numeroInscription ?? "—"}
            </p>
            <Badge variant={statut === "ANALYSEE" ? "default" : "warning"}>{statutLabel(statut)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            N° de lot :{" "}
            <span className="font-medium tabular-nums text-foreground">
              {lots.length > 0 ? lots.join(", ") : "—"}
            </span>
          </p>
        </div>

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

/** Actions de la fiche (Enregistrer / Finaliser en édition, Rouvrir / Ajouter au panier en consultation), au-dessus du layout. */
export function FicheActions({
  mode,
  saving,
  onSave,
  onAnalyse,
  onReopen,
  onAddToPanier,
}: {
  mode: FicheMode
  saving: boolean
  onSave: () => void
  onAnalyse: () => void
  onReopen: () => void
  onAddToPanier: () => void
}) {
  const isEdition = mode === "edition"
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      {isEdition ? (
        <>
          <Button variant="outline" size="sm" className="gap-2" disabled={saving} onClick={onSave}>
            <Save className="h-4 w-4" />
            Enregistrer
          </Button>
          <Button size="sm" className="gap-2" disabled={saving} onClick={onAnalyse}>
            <Check className="h-4 w-4" />
            Finaliser
          </Button>
        </>
      ) : (
        <>
          <Button variant="outline" size="sm" className="gap-2" disabled={saving} onClick={onReopen}>
            <RotateCcw className="h-4 w-4" />
            Rouvrir
          </Button>
          <Button variant="default" size="sm" className="gap-2" onClick={onAddToPanier}>
            <Plus className="h-4 w-4" />
            Ajouter au panier
          </Button>
        </>
      )}
    </div>
  )
}
