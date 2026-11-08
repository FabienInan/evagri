"use client"

import { useId } from "react"
import { Label } from "@/components/ui/label"
import type { TypologieOption } from "@/types/typologie"

/**
 * Types de transaction auxquels un champ s'applique : une case par type, plusieurs choix possibles.
 * Le champ reste vide tant qu'aucun type n'est coché (la validation le refuse à l'enregistrement).
 */
export function TypesTransactionField({
  value,
  onChange,
  typologies,
}: {
  value: string[]
  onChange: (codes: string[]) => void
  typologies: TypologieOption[]
}) {
  const groupId = useId()

  function toggle(code: string) {
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code])
  }

  return (
    <div className="space-y-1.5" role="group" aria-labelledby={`${groupId}-label`}>
      <Label id={`${groupId}-label`} className="text-sm font-medium">
        Types de transaction applicables
        {value.length > 0 && <span className="ml-1 text-xs font-normal text-muted-foreground">({value.length})</span>}
      </Label>
      <div className="grid grid-cols-2 gap-x-2 gap-y-0 rounded-lg border border-input p-1.5">
        {typologies.map((t) => (
          <label key={t.id} className="flex cursor-pointer items-center gap-1.5 rounded px-1.5 py-0.5 text-sm leading-tight hover:bg-muted">
            <input type="checkbox" checked={value.includes(t.code)} onChange={() => toggle(t.code)} />
            {t.nom}
          </label>
        ))}
      </div>
    </div>
  )
}
