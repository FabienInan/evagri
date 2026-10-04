"use client"

import { useMemo, useState } from "react"
import { Search, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { createChamp, updateChamp, toggleChampActif } from "@/server/actions/champs"
import type { ChampInput } from "@/server/actions/champs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import type { ChampEnrichissableConfig, NatureChamp, TypeDonneesChamp } from "@/types/champ"
import type { TypologieOption } from "@/repositories/typologie.repository"

const NATURE_LABELS: Record<NatureChamp, string> = {
  SAISISSABLE: "Saisissable",
  CALCULE: "Calculé",
}

const TYPE_DONNEES_LABELS: Record<TypeDonneesChamp, string> = {
  DECIMAL: "Décimal",
  ENTIER: "Entier",
  LISTE: "Liste",
  TEXTE: "Texte",
  BOOLEAN: "Booléen",
  DATE: "Date",
}

const NUMERIC_TYPES: TypeDonneesChamp[] = ["DECIMAL", "ENTIER"]

function isNumericType(type: TypeDonneesChamp): boolean {
  return NUMERIC_TYPES.includes(type)
}

function emptyDraft(): ChampInput {
  return {
    codeMachine: "",
    nomAffichage: "",
    typeDonnees: "DECIMAL",
    nature: "SAISISSABLE",
    unite: "",
    plageMin: null,
    plageMax: null,
    optionsListe: null,
    regleCalcul: null,
    applicableATypes: [],
    ordreAffichage: 0,
    estAffiche: true,
    estObligatoire: false,
  }
}

function toDraft(champ: ChampEnrichissableConfig): ChampInput {
  return {
    codeMachine: champ.codeMachine,
    nomAffichage: champ.nomAffichage,
    typeDonnees: champ.typeDonnees,
    nature: champ.nature,
    unite: champ.unite,
    plageMin: champ.plageMin,
    plageMax: champ.plageMax,
    optionsListe: champ.optionsListe,
    regleCalcul: champ.regleCalcul,
    applicableATypes: champ.applicableATypes,
    ordreAffichage: champ.ordreAffichage,
    estAffiche: champ.estAffiche,
    estObligatoire: champ.estObligatoire,
  }
}


export function ChampsAdmin({
  champs,
  typologies,
}: {
  champs: ChampEnrichissableConfig[]
  typologies: TypologieOption[]
}) {
  const [items, setItems] = useState<ChampEnrichissableConfig[]>(champs)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(champs[0]?.id ?? null)
  const [draft, setDraft] = useState<ChampInput>(emptyDraft())
  const [createError, setCreateError] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<ChampInput | null>(
    champs[0] ? toDraft(champs[0]) : null
  )
  const [editError, setEditError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [lastSaved, setLastSaved] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((c) => c.nomAffichage.toLowerCase().includes(q) || c.codeMachine.toLowerCase().includes(q))
      .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
  }, [items, search])

  const selected = useMemo(() => items.find((c) => c.id === selectedId) ?? null, [items, selectedId])

  function selectChamp(champ: ChampEnrichissableConfig) {
    setSelectedId(champ.id)
    setEditDraft(toDraft(champ))
    setEditError(null)
  }

  async function handleCreate() {
    if (creating) return
    setCreateError(null)
    setCreating(true)
    try {
      const result = await createChamp(draft)
      if (!result.ok) {
        setCreateError(result.error)
        return
      }
      window.location.reload()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur lors de la création du champ.")
    } finally {
      setCreating(false)
    }
  }

  async function handleSave() {
    if (!selected || !editDraft) return
    setEditError(null)
    setSaving(true)
    try {
      const result = await updateChamp(selected.id, editDraft)
      if (!result.ok) {
        setEditError(result.error)
        return
      }
      setItems((prev) => prev.map((c) => (c.id === selected.id ? { ...c, ...editDraft, id: c.id, actif: c.actif, estModifiable: editDraft.nature === "SAISISSABLE" } : c)))
      setLastSaved(selected.id)
      setTimeout(() => setLastSaved((current) => (current === selected.id ? null : current)), 1500)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur lors de la sauvegarde du champ.")
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActif() {
    if (!selected || toggling) return
    const nextActif = !selected.actif
    setToggling(true)
    setEditError(null)
    try {
      const result = await toggleChampActif(selected.id, nextActif)
      if (!result.ok) {
        setEditError(result.error)
        return
      }
      setItems((prev) => prev.map((c) => (c.id === selected.id ? { ...c, actif: nextActif } : c)))
    } catch {
      setEditError("Échec du changement d'état du champ.")
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <Card className="shrink-0 border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Nouveau champ enrichissable</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            {/* Ligne 1 */}
            <div className="space-y-1.5 md:col-start-1">
              <Label className="text-sm font-medium">Code machine</Label>
              <Input
                placeholder="superficie_cultivee"
                value={draft.codeMachine}
                onChange={(e) => setDraft((d) => ({ ...d, codeMachine: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-start-2">
              <Label className="text-sm font-medium">Nom affiché</Label>
              <Input
                value={draft.nomAffichage}
                onChange={(e) => setDraft((d) => ({ ...d, nomAffichage: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-start-3">
              <Label className="text-sm font-medium">Nature</Label>
              <Select
                value={draft.nature}
                onValueChange={(v) => setDraft((d) => ({ ...d, nature: v as NatureChamp }))}
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
            <div className="space-y-1.5 md:col-start-4">
              <Label className="text-sm font-medium">Type de données</Label>
              <Select
                value={draft.typeDonnees}
                onValueChange={(v) => setDraft((d) => ({ ...d, typeDonnees: v as TypeDonneesChamp }))}
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

            {/* Ligne 2 */}
            {isNumericType(draft.typeDonnees) && (
              <div className="space-y-1.5 md:col-start-1">
                <Label className="text-sm font-medium">Unité</Label>
                <Input
                  placeholder="ha"
                  value={draft.unite}
                  onChange={(e) => setDraft((d) => ({ ...d, unite: e.target.value }))}
                />
              </div>
            )}
            <div
              className={cn(
                "space-y-1.5",
                isNumericType(draft.typeDonnees)
                  ? "md:col-span-2 md:col-start-2"
                  : "md:col-span-2 md:col-start-1"
              )}
            >
              <Label className="text-sm font-medium">
                Règle de calcul {draft.nature === "CALCULE" ? "(obligatoire)" : "(optionnelle)"}
              </Label>
              <Input
                placeholder="prix_vente / superficie_totale_hectare"
                value={draft.regleCalcul ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, regleCalcul: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 md:col-start-4">
              <Label className="text-sm font-medium">Types de transaction applicables</Label>
              <Select
                value={draft.applicableATypes[0] ?? ""}
                onValueChange={(v) => setDraft((d) => ({ ...d, applicableATypes: v ? [v] : [] }))}
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
          </div>

          <div className="mt-3 flex items-center gap-4">
            {draft.nature === "SAISISSABLE" && (
              <div className="flex items-center gap-2">
                <Switch
                  checked={draft.estObligatoire}
                  onCheckedChange={(checked) => setDraft((d) => ({ ...d, estObligatoire: checked }))}
                />
                <Label className="text-sm font-medium">Obligatoire</Label>
              </div>
            )}
            <Button onClick={handleCreate} disabled={creating} className="gap-2 rounded-lg">
              <Plus className="h-4 w-4" />
              {creating ? "Création..." : "Créer le champ"}
            </Button>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
        </CardContent>
      </Card>

      <div className="relative w-full max-w-md shrink-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          placeholder="Rechercher un champ"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 rounded-lg border-border pl-10 text-sm"
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="scrollable-list flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun champ ne correspond à la recherche.</p>
            ) : (
              filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectChamp(c)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all",
                    selectedId === c.id
                      ? "border-primary bg-primary/[0.04] shadow-sm"
                      : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30",
                    !c.actif && "opacity-50"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-semibold text-foreground">{c.nomAffichage}</p>
                    <p className="text-sm text-muted-foreground">
                      {c.codeMachine} · {TYPE_DONNEES_LABELS[c.typeDonnees]}
                      {c.unite !== "N/A" ? ` · ${c.unite}` : ""}
                    </p>
                  </div>
                  <Badge variant={c.nature === "CALCULE" ? "secondary" : "outline"}>
                    {NATURE_LABELS[c.nature]}
                  </Badge>
                </button>
              ))
            )}
          </div>
        </div>

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
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, nomAffichage: e.target.value } : d))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Type de données</Label>
                <Select
                  value={editDraft.typeDonnees}
                  onValueChange={(v) => setEditDraft((d) => (d ? { ...d, typeDonnees: v as TypeDonneesChamp } : d))}
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
                      onChange={(e) => setEditDraft((d) => (d ? { ...d, unite: e.target.value } : d))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Min</Label>
                    <Input
                      type="number"
                      value={editDraft.plageMin ?? ""}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, plageMin: e.target.value === "" ? null : Number(e.target.value) } : d))
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">Max</Label>
                    <Input
                      type="number"
                      value={editDraft.plageMax ?? ""}
                      onChange={(e) =>
                        setEditDraft((d) => (d ? { ...d, plageMax: e.target.value === "" ? null : Number(e.target.value) } : d))
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
                  onChange={(e) => setEditDraft((d) => (d ? { ...d, regleCalcul: e.target.value } : d))}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Types de transaction applicables</Label>
                <Select
                  value={editDraft.applicableATypes[0] ?? ""}
                  onValueChange={(v) => setEditDraft((d) => (d ? { ...d, applicableATypes: v ? [v] : [] } : d))}
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

              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <Label className="text-sm font-medium">Affiché sur la fiche</Label>
                <Switch
                  checked={editDraft.estAffiche}
                  onCheckedChange={(checked) => setEditDraft((d) => (d ? { ...d, estAffiche: checked } : d))}
                />
              </div>

              {editDraft.nature === "SAISISSABLE" && (
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <Label className="text-sm font-medium">Obligatoire</Label>
                  <Switch
                    checked={editDraft.estObligatoire}
                    onCheckedChange={(checked) => setEditDraft((d) => (d ? { ...d, estObligatoire: checked } : d))}
                  />
                </div>
              )}

              {editError && <p className="text-sm text-destructive">{editError}</p>}

              <div className="flex items-center gap-2">
                <Button onClick={handleSave} disabled={saving} className="flex-1 rounded-lg">
                  {saving ? "Enregistrement..." : lastSaved === selected.id ? "Enregistré ✓" : "Enregistrer"}
                </Button>
                <Button variant="outline" onClick={handleToggleActif} disabled={toggling} className="rounded-lg">
                  {selected.actif ? "Désactiver" : "Réactiver"}
                </Button>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}
