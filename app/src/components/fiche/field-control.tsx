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
import { parseFrenchNumber } from "@/lib/normalization/parsing"
import { joinMultiValue, parseMultiValue } from "@/lib/multi-value"
import { MultiSelect } from "@/components/ui/multi-select"
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
  error,
}: {
  champ: ChampEnrichissableConfig
  valeur: FicheValeur
  onChange: (valeur: FicheValeur) => void
  onBlur?: () => void
  disabled?: boolean
  error?: string | null
}) {
  const readOnly = disabled || !champ.estModifiable
  const label = `${champ.nomAffichage}${champ.estObligatoire ? " *" : ""}${champ.unite !== "N/A" ? ` (${champ.unite})` : ""}`
  const errorId = error ? `${champ.codeMachine}-error` : undefined

  const currentText = toInputValue(valeur)
  const options = champ.optionsListe ?? []
  // Tolerant display: a value the options list does not know (a legacy combination, "Friche", ...) is kept
  // visible as an extra choice rather than rendered blank, so nothing already stored is lost from view.
  const listOptions =
    currentText !== "" && !options.includes(currentText) ? [currentText, ...options] : options
  const multiSelection = parseMultiValue(valeur)
  const multiOptions = (() => {
    const extras = multiSelection.filter((v) => !options.includes(v))
    return extras.length > 0 ? [...extras, ...options] : options
  })()

  // Le contrôle est un simple enfant de la cellule : l'alignement entre champs d'une même rangée est
  // assuré par les trois pistes partagées (subgrid) — libellé, contrôle, erreur —, pas par un mt-auto.
  const control =
    champ.typeDonnees === "BOOLEAN" ? (
      <div className="flex h-10 items-center">
        <Switch
          checked={Boolean(valeur)}
          disabled={readOnly}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
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
        <SelectTrigger className="h-10 w-full rounded-lg" aria-invalid={error ? true : undefined} aria-describedby={errorId}>
          <SelectValue placeholder="Sélectionner..." />
        </SelectTrigger>
        <SelectContent>
          {listOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    ) : champ.typeDonnees === "MULTI_SELECT" ? (
      <MultiSelect
        options={multiOptions}
        selected={multiSelection}
        disabled={readOnly}
        invalid={Boolean(error)}
        describedBy={errorId}
        onChange={(next) => {
          onChange(joinMultiValue(next))
          onBlur?.()
        }}
      />
    ) : champ.typeDonnees === "DATE" ? (
      <Input
        type="date"
        className="h-10"
        value={toInputValue(valeur)}
        disabled={readOnly}
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
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
        aria-invalid={error ? true : undefined}
        aria-describedby={errorId}
        onChange={(e) => {
          if (e.target.value === "") {
            onChange(null)
          } else if (champ.typeDonnees === "DECIMAL" || champ.typeDonnees === "ENTIER") {
            // parseFrenchNumber tolerates a decimal comma and thousands separators, so a value pasted
            // from a spreadsheet ("1 234,5") is not silently dropped to null.
            onChange(parseFrenchNumber(e.target.value))
          } else {
            onChange(e.target.value)
          }
        }}
        onBlur={onBlur}
      />
    )

  // Subgrid sur 3 pistes : libellé, contrôle, erreur. Les pistes sont partagées avec les champs de
  // la même rangée, donc les contrôles restent alignés qu'un libellé passe sur deux lignes ou qu'une
  // erreur apparaisse sous un champ (la piste erreur est simplement vide pour les autres).
  return (
    <div className="grid grid-rows-subgrid row-span-3 gap-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {control}
      {error && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
