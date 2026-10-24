"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { ChampInput } from "@/server/actions/champs"
import type { ChampEnrichissableConfig, TypeDonneesChamp } from "@/types/champ"
import { hasOptions } from "@/types/champ"
import type { TypologieOption } from "@/types/typologie"
import { NATURE_LABELS, TYPE_DONNEES_LABELS, isNumericType } from "./champs-model"

export function ChampEditPanel({
  selected,
  editDraft,
  onEditDraftChange,
  editOptionsText,
  onEditOptionsTextChange,
  typologies,
  saving,
  toggling,
  lastSaved,
  editError,
  onSave,
  onToggleActif,
}: {
  selected: ChampEnrichissableConfig | null
  editDraft: ChampInput | null
  onEditDraftChange: (updater: (draft: ChampInput) => ChampInput) => void
  editOptionsText: string
  onEditOptionsTextChange: (value: string) => void
  typologies: TypologieOption[]
  saving: boolean
  toggling: boolean
  lastSaved: string | null
  editError: string | null
  onSave: () => void
  onToggleActif: () => void
}) {
  return (
    <Card className="w-[380px] shrink-0 flex flex-col overflow-hidden border-border shadow-sm">
      <CardHeader className="shrink-0 space-y-1 pb-4">
        <CardTitle className="text-lg font-semibold">
          {selected ? selected.nomAffichage : "Détails du champ"}
        </CardTitle>
        <CardDescription className="text-sm">
          {selected
            ? `${selected.codeMachine} · ${NATURE_LABELS[selected.nature]}`
            : "Sélectionnez un champ dans la liste pour l'éditer"}
        </CardDescription>
      </CardHeader>
      {selected && editDraft && (
        <CardContent className="flex-1 overflow-y-auto min-h-0 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Nom affiché</Label>
            <Input
              value={editDraft.nomAffichage}
              onChange={(e) => onEditDraftChange((d) => ({ ...d, nomAffichage: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Type de données</Label>
            <Select
              value={editDraft.typeDonnees}
              onValueChange={(v) => onEditDraftChange((d) => ({ ...d, typeDonnees: v as TypeDonneesChamp }))}
            >
              <SelectTrigger className="h-10 w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_DONNEES_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isNumericType(editDraft.typeDonnees) && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Unité</Label>
                <Input
                  value={editDraft.unite}
                  onChange={(e) => onEditDraftChange((d) => ({ ...d, unite: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Min</Label>
                <Input
                  type="number"
                  value={editDraft.plageMin ?? ""}
                  onChange={(e) =>
                    onEditDraftChange((d) => ({ ...d, plageMin: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Max</Label>
                <Input
                  type="number"
                  value={editDraft.plageMax ?? ""}
                  onChange={(e) =>
                    onEditDraftChange((d) => ({ ...d, plageMax: e.target.value === "" ? null : Number(e.target.value) }))
                  }
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">
              Règle de calcul {editDraft.nature === "CALCULE" ? "(obligatoire)" : "(optionnelle)"}
            </Label>
            <Input
              placeholder="prix_vente / superficie_totale_hectare"
              value={editDraft.regleCalcul ?? ""}
              onChange={(e) => onEditDraftChange((d) => ({ ...d, regleCalcul: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Champs décimaux ou entiers seulement, codes machine, opérateurs + - * / et parenthèses. Pas de nombre négatif.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Types de transaction applicables</Label>
            <Select
              value={editDraft.applicableATypes[0] ?? ""}
              onValueChange={(v) => onEditDraftChange((d) => ({ ...d, applicableATypes: v ? [v] : [] }))}
            >
              <SelectTrigger className="h-10 w-full rounded-lg">
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

          {hasOptions(editDraft.typeDonnees) && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Options de liste</Label>
              <Textarea
                placeholder="Une option par ligne"
                className="min-h-24"
                value={editOptionsText}
                onChange={(e) => onEditOptionsTextChange(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Une option par ligne.</p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm font-medium">Affiché sur la fiche</Label>
            <Switch
              checked={editDraft.estAffiche}
              onCheckedChange={(checked) => onEditDraftChange((d) => ({ ...d, estAffiche: checked }))}
            />
          </div>

          {editDraft.nature === "SAISISSABLE" && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-sm font-medium">Obligatoire</Label>
              <Switch
                checked={editDraft.estObligatoire}
                onCheckedChange={(checked) => onEditDraftChange((d) => ({ ...d, estObligatoire: checked }))}
              />
            </div>
          )}

          {editDraft.nature !== "CALCULE" && (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <Label className="text-sm font-medium">Lecture seule</Label>
              <Switch
                checked={editDraft.estLectureSeule ?? false}
                onCheckedChange={(checked) => onEditDraftChange((d) => ({ ...d, estLectureSeule: checked }))}
              />
            </div>
          )}

          {editError && <p className="text-sm text-destructive">{editError}</p>}

          <div className="flex items-center gap-2">
            <Button onClick={onSave} disabled={saving} className="flex-1 rounded-lg">
              {saving ? "Enregistrement..." : lastSaved === selected.id ? "Enregistré ✓" : "Enregistrer"}
            </Button>
            <Button variant="outline" onClick={onToggleActif} disabled={toggling} className="rounded-lg">
              {selected.actif ? "Désactiver" : "Réactiver"}
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
