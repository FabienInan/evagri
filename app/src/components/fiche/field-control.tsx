"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FicheValeur } from "@/lib/fiche"
import type { ChampEnrichissableConfig } from "@/types/champ"

function toInputValue(valeur: FicheValeur): string {
  if (valeur === null || valeur === undefined) return ""
  return String(valeur)
}

export function FieldControl({
  champ,
  valeur,
  onChange,
  onBlur,
  disabled,
}: {
  champ: ChampEnrichissableConfig
  valeur: FicheValeur
  onChange: (valeur: FicheValeur) => void
  onBlur?: () => void
  disabled?: boolean
}) {
  const readOnly = disabled || !champ.estModifiable
  const label = `${champ.nomAffichage}${champ.estObligatoire ? " *" : ""}${champ.unite !== "N/A" ? ` (${champ.unite})` : ""}`

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>

      {champ.typeDonnees === "BOOLEAN" ? (
        <div className="h-10 flex items-center">
          <Switch
            checked={Boolean(valeur)}
            disabled={readOnly}
            onCheckedChange={(checked) => {
              onChange(checked)
              onBlur?.()
            }}
          />
        </div>
      ) : champ.typeDonnees === "LISTE" ? (
        <Select
          value={toInputValue(valeur)}
          disabled={readOnly}
          onValueChange={(v) => {
            onChange(v)
            onBlur?.()
          }}
        >
          <SelectTrigger className="h-10 w-full rounded-lg">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent>
            {(champ.optionsListe ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : champ.typeDonnees === "DATE" ? (
        <Input
          type="date"
          className="h-10"
          value={toInputValue(valeur)}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          onBlur={onBlur}
        />
      ) : (
        <Input
          type={champ.typeDonnees === "DECIMAL" || champ.typeDonnees === "ENTIER" ? "number" : "text"}
          step={champ.typeDonnees === "DECIMAL" ? "any" : undefined}
          className="h-10"
          value={toInputValue(valeur)}
          disabled={readOnly}
          onChange={(e) => {
            if (e.target.value === "") {
              onChange(null)
            } else if (champ.typeDonnees === "DECIMAL" || champ.typeDonnees === "ENTIER") {
              const n = Number(e.target.value)
              onChange(Number.isNaN(n) ? null : n)
            } else {
              onChange(e.target.value)
            }
          }}
          onBlur={onBlur}
        />
      )}
    </div>
  )
}
