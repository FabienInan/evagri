"use client"

import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { FilterType } from "@/types/filter"
import { FILTER_TYPE_LABELS, FILTER_TYPE_OPTIONS, type Filter } from "./filter-constants"

export function FilterDetailsCard({
  selected,
  selectedRecommended,
  lastSaved,
  onTypeChange,
  onToggleActive,
  onDelete,
}: {
  selected: Filter | null
  selectedRecommended: FilterType | null
  lastSaved: string | null
  onTypeChange: (value: FilterType) => void
  onToggleActive: (checked: boolean) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="w-[380px] shrink-0 overflow-hidden border-border shadow-sm">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-lg font-semibold">{selected ? selected.nomFiltre : "Détails du filtre"}</CardTitle>
        <CardDescription className="text-sm">
          {selected ? "Consultez les attributs du filtre sélectionné" : "Sélectionnez un filtre dans la liste pour voir ses détails"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {selected ? (
          <>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Nom affiché</Label>
              <p className="text-sm text-foreground">{selected.nomFiltre}</p>
            </div>

            {selected.codeMachine && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Code virtuel</Label>
                <p className="text-sm text-foreground">{selected.codeMachine}</p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="typeFiltre" className="text-sm font-medium">
                Type de filtres
              </Label>
              <Select value={selected.typeFiltre} onValueChange={onTypeChange}>
                <SelectTrigger id="typeFiltre" className="h-10 w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FILTER_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        {t.label}
                        {t.value === selectedRecommended && (
                          <Badge variant="outline" className="text-xs">
                            Recommandé
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRecommended && selectedRecommended !== selected.typeFiltre && (
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium">Type recommandé</p>
                  <p className="text-xs text-muted-foreground">
                    {FILTER_TYPE_LABELS[selectedRecommended]}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={() => onTypeChange(selectedRecommended)}>
                  Appliquer
                </Button>
              </div>
            )}

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="estActif" className="text-sm font-medium">
                  Affichée à l&apos;utilisateur
                </Label>
                <p className="text-xs text-muted-foreground">Le filtre apparaît dans le panneau de filtres</p>
              </div>
              <Switch id="estActif" checked={selected.estActif} onCheckedChange={onToggleActive} />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(selected.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Supprimer
              </Button>
              {lastSaved === selected.id || lastSaved === "__all__" ? (
                <p className="text-sm text-muted-foreground">Enregistré</p>
              ) : null}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}
