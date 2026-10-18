"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { FilterType } from "@/types/filter"
import { ChampSelect, TypeSelect } from "./filter-selects"
import type { Champ } from "./filter-constants"

export function FilterCreateCard({
  champs,
  newChampId,
  onNewChampIdChange,
  recommendedType,
  isNewChampUsed,
  createError,
  onCreate,
}: {
  champs: Champ[]
  newChampId: string
  onNewChampIdChange: (value: string) => void
  recommendedType: FilterType | null
  isNewChampUsed: boolean
  createError: string | null
  onCreate: (formData: FormData) => void | Promise<void>
}) {
  return (
    <Card className="shrink-0 border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Ajouter un filtre</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          action={onCreate}
          className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Champ cible</Label>
            <ChampSelect champs={champs} value={newChampId} onValueChange={onNewChampIdChange} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Type de filtre</Label>
            {/* key = cible : le Select (non contrôlé) repart sur la recommandation quand la cible change. */}
            <TypeSelect key={newChampId} name="typeFiltre" recommendedType={recommendedType} />
          </div>
          <Button type="submit" disabled={isNewChampUsed} className="h-10 gap-2 rounded-lg">
            <Plus className="h-4 w-4" />
            {isNewChampUsed ? "Déjà ajouté" : "Ajouter"}
          </Button>
        </form>
        {createError && <p className="mt-3 text-sm text-destructive">{createError}</p>}
      </CardContent>
    </Card>
  )
}
