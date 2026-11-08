"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { ChampInput } from "@/server/actions/champs"
import type { ChampEnrichissableConfig, TypeDonneesChamp } from "@/types/champ"
import { hasOptions } from "@/types/champ"
import type { TypologieOption } from "@/types/typologie"
import { NATURE_LABELS, TYPE_DONNEES_LABELS, isNumericType } from "./champs-model"
import { RegleCalculInput, type RuleFieldOption } from "./regle-calcul-input"
import { TypesTransactionField } from "./types-transaction-field"

type EditTab = "general" | "regle" | "affichage"

const EDIT_TABS: { id: EditTab; label: string }[] = [
  { id: "general", label: "Général" },
  { id: "regle", label: "Règle et types" },
  { id: "affichage", label: "Affichage" },
]

/**
 * Détail d'un champ, en trois onglets pour ne pas faire défiler une longue page : Général (identité, type, plage,
 * options), Règle et types (calcul, types de transaction), Affichage (fiche, obligatoire, lecture seule).
 * Le bouton Enregistrer reste visible en bas du panneau, quel que soit l'onglet.
 */
export function ChampEditPanel({
  selected,
  ruleFieldOptions,
  inferType,
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
  ruleFieldOptions: RuleFieldOption[]
  /** Type déduit d'une règle de calcul (entier ou décimal), pour un champ calculé. */
  inferType: (rule: string) => TypeDonneesChamp | null
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
  const [tab, setTab] = useState<EditTab>("general")

  return (
    <Card className="flex w-[420px] shrink-0 flex-col overflow-hidden border-border p-0 shadow-sm">
      <CardHeader className="shrink-0 space-y-1 px-5 pb-3 pt-5">
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
        <>
          <div role="tablist" aria-label="Sections du champ" className="flex shrink-0 gap-1 border-b border-border px-3">
            {EDIT_TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "-mb-px border-b-2 px-2.5 pb-2 pt-1 text-sm font-medium transition-colors",
                  tab === t.id
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          <CardContent className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            {tab === "general" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Nom affiché</Label>
                  <Input
                    value={editDraft.nomAffichage}
                    onChange={(e) => onEditDraftChange((d) => ({ ...d, nomAffichage: e.target.value }))}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Type de données
                    {editDraft.nature === "CALCULE" && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">(déduit de la règle)</span>
                    )}
                  </Label>
                  <Select
                    value={
                      editDraft.nature === "CALCULE"
                        ? (editDraft.regleCalcul ? (inferType(editDraft.regleCalcul) ?? "") : "")
                        : editDraft.typeDonnees
                    }
                    disabled={editDraft.nature === "CALCULE"}
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

                {hasOptions(editDraft.typeDonnees) && editDraft.nature !== "CALCULE" && (
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
              </>
            )}

            {tab === "regle" && (
              <>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    Règle de calcul {editDraft.nature === "CALCULE" ? "(obligatoire)" : "(optionnelle)"}
                  </Label>
                  <RegleCalculInput
                    placeholder="prix_vente / superficie_totale_hectare"
                    value={editDraft.regleCalcul ?? ""}
                    onChange={(value) => onEditDraftChange((d) => ({ ...d, regleCalcul: value }))}
                    options={ruleFieldOptions}
                    excludeCode={editDraft.codeMachine}
                  />
                  <p className="text-xs text-muted-foreground">
                    Champs décimaux ou entiers seulement, codes machine, opérateurs + - * / et parenthèses. Pas de nombre négatif.
                  </p>
                </div>

                <TypesTransactionField
                  value={editDraft.applicableATypes}
                  onChange={(codes) => onEditDraftChange((d) => ({ ...d, applicableATypes: codes }))}
                  typologies={typologies}
                />
              </>
            )}

            {tab === "affichage" && (
              <>
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
              </>
            )}

            {editError && <p className="text-sm text-destructive">{editError}</p>}
          </CardContent>

          <CardFooter className="shrink-0 flex items-center gap-2 border-t border-border px-5 py-3">
            <Button onClick={onSave} disabled={saving} className="flex-1 rounded-lg">
              {saving ? "Enregistrement..." : lastSaved === selected.id ? "Enregistré ✓" : "Enregistrer"}
            </Button>
            <Button variant="outline" onClick={onToggleActif} disabled={toggling} className="rounded-lg">
              {selected.actif ? "Désactiver" : "Réactiver"}
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  )
}
