"use client"

import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FilterType } from "@/types/filter"
import { FILTER_TYPE_OPTIONS, VIRTUAL_FILTERS, type Champ } from "./filter-constants"

export function ChampSelect({
  champs,
  value,
  onValueChange,
}: {
  champs: Champ[]
  value?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <Select name="champId" value={value} defaultValue={champs[0]?.id} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 w-full rounded-lg">
        <SelectValue placeholder="Champ cible" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__champs-heading__" disabled className="font-semibold text-muted-foreground">
          Champs
        </SelectItem>
        {champs.map((c) => (
          <SelectItem key={c.id} value={c.id} className="pl-6">
            {c.nomAffichage}
          </SelectItem>
        ))}
        <SelectItem value="__virtual-heading__" disabled className="font-semibold text-muted-foreground">
          Filtres virtuels
        </SelectItem>
        {VIRTUAL_FILTERS.map((v) => (
          <SelectItem key={v.codeMachine} value={`__VIRTUAL_${v.codeMachine}`} className="pl-6">
            {v.nomFiltre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function TypeSelect({
  recommendedType,
  defaultValue,
  name,
}: {
  recommendedType?: FilterType | null
  defaultValue?: string
  name?: string
}) {
  return (
    <Select name={name} defaultValue={defaultValue ?? recommendedType ?? "PLAGE_NUMERIQUE"}>
      <SelectTrigger className="h-10 w-full rounded-lg">
        <SelectValue placeholder="Type de filtre" />
      </SelectTrigger>
      <SelectContent>
        {FILTER_TYPE_OPTIONS.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            <span className="flex items-center gap-2">
              {t.label}
              {t.value === recommendedType && (
                <Badge variant="outline" className="text-xs">
                  Recommandé
                </Badge>
              )}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
