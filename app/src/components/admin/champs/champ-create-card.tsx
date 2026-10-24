"use client"

import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChampInput } from "@/server/actions/champs"
import { deriveEstLectureSeule } from "@/lib/champs"
import type { NatureChamp, TypeDonneesChamp } from "@/types/champ"
import { hasOptions } from "@/types/champ"
import type { TypologieOption } from "@/types/typologie"
import { TYPE_DONNEES_LABELS, isNumericType } from "./champs-model"

export function ChampCreateCard({
  draft,
  onDraftChange,
  createOptionsText,
  onCreateOptionsTextChange,
  derivedCodeMachine,
  typologies,
  creating,
  createError,
  onCreate,
}: {
  draft: ChampInput
  onDraftChange: (updater: (draft: ChampInput) => ChampInput) => void
  createOptionsText: string
  onCreateOptionsTextChange: (value: string) => void
  derivedCodeMachine: string
  typologies: TypologieOption[]
  creating: boolean
  createError: string | null
  onCreate: () => void
}) {
  // Les trois champs de la 2ᵉ rangée (Règle de calcul / Types de transaction / Options de liste) sont
  // définis une fois et placés par la suite : sur la même ligne, chacun occupe une largeur identique.
  const uniteField = (
    <div className="space-y-1.5 md:col-start-1">
      <Label className="text-sm font-medium">Unité</Label>
      <Input
        placeholder="ha"
        value={draft.unite}
        onChange={(e) => onDraftChange((d) => ({ ...d, unite: e.target.value }))}
      />
    </div>
  )

  const regleField = (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">
        Règle de calcul {draft.nature === "CALCULE" ? "(obligatoire)" : "(optionnelle)"}
      </Label>
      <Input
        placeholder="prix_vente / superficie_totale_hectare"
        value={draft.regleCalcul ?? ""}
        onChange={(e) => onDraftChange((d) => ({ ...d, regleCalcul: e.target.value }))}
      />
      <p className="text-xs text-muted-foreground">
        Champs décimaux ou entiers seulement, codes machine, opérateurs + - * / et parenthèses. Pas de nombre négatif.
      </p>
    </div>
  )

  const typesField = (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">Types de transaction applicables</Label>
      <Select
        value={draft.applicableATypes[0] ?? ""}
        onValueChange={(v) => onDraftChange((d) => ({ ...d, applicableATypes: v ? [v] : [] }))}
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
  )

  const optionsField = (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">Options de liste</Label>
      <Textarea
        placeholder={"Une option par ligne\nTerres cultivées\nTerres boisées"}
        className="min-h-24"
        value={createOptionsText}
        onChange={(e) => onCreateOptionsTextChange(e.target.value)}
      />
      <p className="text-xs text-muted-foreground">Une option par ligne.</p>
    </div>
  )

  return (
    <Card className="shrink-0 border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Nouveau champ enrichissable</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-3">
          {/* Ligne 1 : le code machine n'est plus saisi — il est dérivé du nom affiché (norme
              buildCodeMachine) et affiché en lecture seule à titre indicatif. */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Nom affiché</Label>
            <Input
              value={draft.nomAffichage}
              onChange={(e) => onDraftChange((d) => ({ ...d, nomAffichage: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Code machine : <span className="font-mono">{derivedCodeMachine || "—"}</span>
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Nature</Label>
            <Select
              value={draft.nature}
              onValueChange={(v) =>
                onDraftChange((d) => ({
                  ...d,
                  nature: v as NatureChamp,
                  // CALCULE is always read-only; SAISISSABLE resets to editable when re-selected.
                  estLectureSeule: deriveEstLectureSeule(v as NatureChamp),
                }))
              }
            >
              <SelectTrigger className="h-10 w-full rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAISISSABLE">Saisissable</SelectItem>
                <SelectItem value="CALCULE">Calculé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Type de données</Label>
            <Select
              value={draft.typeDonnees}
              onValueChange={(v) => onDraftChange((d) => ({ ...d, typeDonnees: v as TypeDonneesChamp }))}
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

          {/* Ligne 2 : pour une liste / multi-sélection, Règle de calcul, Types de transaction et
              Options de liste partagent la ligne à largeur égale ; sinon Unité (si numérique), Règle de
              calcul et Types de transaction. */}
          {hasOptions(draft.typeDonnees) ? (
            <div className="grid grid-cols-1 gap-3 md:col-span-3 md:grid-cols-3">
              {regleField}
              {typesField}
              {optionsField}
            </div>
          ) : isNumericType(draft.typeDonnees) ? (
            <>
              {uniteField}
              {regleField}
              {typesField}
            </>
          ) : (
            <>
              <div className="md:col-span-2">{regleField}</div>
              {typesField}
            </>
          )}
        </div>

        <div className="mt-3 flex items-center gap-4">
          {draft.nature === "SAISISSABLE" && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draft.estObligatoire}
                onCheckedChange={(checked) => onDraftChange((d) => ({ ...d, estObligatoire: checked }))}
              />
              <Label className="text-sm font-medium">Obligatoire</Label>
            </div>
          )}
          {draft.nature !== "CALCULE" && (
            <div className="flex items-center gap-2">
              <Switch
                checked={draft.estLectureSeule ?? false}
                onCheckedChange={(checked) => onDraftChange((d) => ({ ...d, estLectureSeule: checked }))}
              />
              <Label className="text-sm font-medium">Lecture seule</Label>
            </div>
          )}
          <Button onClick={onCreate} disabled={creating} className="gap-2 rounded-lg">
            <Plus className="h-4 w-4" />
            {creating ? "Création..." : "Créer le champ"}
          </Button>
          {createError && <p className="text-sm text-destructive">{createError}</p>}
        </div>
      </CardContent>
    </Card>
  )
}
