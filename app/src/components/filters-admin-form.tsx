"use client"

import { useEffect, useMemo, useState } from "react"
import { Search, Trash2, Plus, Globe } from "lucide-react"
import { cn } from "@/lib/utils"
import { createFilter, deleteFilter, publishFilters } from "@/server/actions/filters"
import { useHeaderActions } from "@/components/header-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { getFilterIcon, getFilterIconColor } from "@/lib/filter-icons"
import { recommendFilterType, DEFAULT_OPERATEURS } from "@/lib/filters"
import type { FilterConfig, FilterType } from "@/types/filter"
import type { CreateFilterInput } from "@/server/actions/filters"

const FILTER_TYPES: { value: FilterType; label: string }[] = [
  { value: "PLAGE_NUMERIQUE", label: "Plage de valeurs" },
  { value: "PLAGE_DATE", label: "Plage de dates" },
  { value: "LISTE", label: "Liste" },
  { value: "MULTI_SELECT", label: "Multi-sélection" },
  { value: "RECHERCHE_TEXTE", label: "Recherche texte" },
  { value: "BOOLEEN", label: "Booléen" },
]

const FILTER_TYPE_LABELS: Record<FilterType, string> = {
  PLAGE_NUMERIQUE: "Plage de valeurs",
  PLAGE_DATE: "Plage de dates",
  LISTE: "Liste",
  MULTI_SELECT: "Multi-sélection",
  RECHERCHE_TEXTE: "Recherche texte",
  BOOLEEN: "Booléen",
  NUMERO_LOT: "Numéro de lot",
  TYPE_TRANSACTION: "Type de transaction",
  STATUT: "Statut",
  ZONE_GEO: "Zone géographique",
}

const DATA_TYPE_LABELS: Record<string, string> = {
  TEXTE: "Texte",
  DECIMAL: "Décimal",
  ENTIER: "Entier",
  DATE: "Date",
  LISTE: "Liste",
  BOOLEAN: "Booléen",
}

const VIRTUAL_FILTERS = [
  { codeMachine: "statut", nomFiltre: "Statut d'analyse", typeFiltre: "LISTE" as const },
]

type Champ = {
  id: string
  codeMachine: string
  nomAffichage: string
  typeDonnees: string
  nature: string
  unite: string
  typeFiltreRecommande: string | null
}

type Filter = FilterConfig

export function FiltersAdminForm({
  filters,
  champs,
}: {
  filters: Filter[]
  champs: Champ[]
}) {
  const [items, setItems] = useState<Filter[]>(filters)
  const [search, setSearch] = useState("")
  const [selectedId, setSelectedId] = useState<string | null>(filters[0]?.id ?? null)
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [publishing, setPublishing] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const firstAvailableChamp = champs.find(
    (c) => !filters.some((f) => f.champEnrichissable?.id === c.id)
  )
  const firstAvailableVirtual = VIRTUAL_FILTERS.find(
    (v) => !filters.some((f) => f.codeMachine === v.codeMachine)
  )
  const [newChampId, setNewChampId] = useState<string>(
    firstAvailableChamp?.id ?? (firstAvailableVirtual ? `__VIRTUAL_${firstAvailableVirtual.codeMachine}` : "")
  )
  const isVirtualSelection = newChampId.startsWith("__VIRTUAL_")
  const selectedVirtualCode = isVirtualSelection ? newChampId.replace("__VIRTUAL_", "") : null
  const isNewChampUsed = isVirtualSelection
    ? items.some((f) => f.codeMachine === selectedVirtualCode)
    : items.some((f) => f.champEnrichissable?.id === newChampId)
  const recommendedTypeForNew = useMemo<FilterType | null>(() => {
    if (isVirtualSelection) return null
    const champ = champs.find((c) => c.id === newChampId)
    if (!champ) return null
    return recommendFilterType({
      codeMachine: champ.codeMachine,
      nomAffichage: champ.nomAffichage,
      typeDonnees: champ.typeDonnees,
      nature: champ.nature,
    })
  }, [newChampId, isVirtualSelection, champs])
  const { setAction, clearAction } = useHeaderActions()

  useEffect(() => {
    setAction(
      <Button
        onClick={handlePublish}
        disabled={publishing}
        className="h-9 gap-2 rounded-lg px-4"
      >
        <Globe className="h-4 w-4" />
        {publishing ? "Publication..." : "Publier la configuration"}
      </Button>
    )
    return () => clearAction()
  }, [publishing, lastSaved])

  const selected = useMemo(
    () => (items.find((f) => f.id === selectedId) as Filter | undefined) ?? null,
    [items, selectedId]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return items
      .filter((f) => f.nomFiltre.toLowerCase().includes(q))
      .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
  }, [items, search])

  function updateLocal(id: string, patch: Partial<Filter>) {
    setItems((prev) => prev.map((f) => (f.id === id ? ({ ...f, ...patch } as Filter) : f)))
  }

  function saveFilter(id: string, patch: Partial<Filter>) {
    updateLocal(id, patch)
    setLastSaved(id)
    setTimeout(() => setLastSaved((current) => (current === id ? null : current)), 1500)
  }

  function handleTypeChange(value: FilterType) {
    if (!selected) return
    saveFilter(selected.id, {
      typeFiltre: value,
      operateursDisponibles: DEFAULT_OPERATEURS[value],
    })
  }

  function handleToggleActive(checked: boolean) {
    if (!selected) return
    saveFilter(selected.id, { estActif: checked })
  }

  function handleOrderChange(value: string) {
    if (!selected) return
    const ordre = Number(value)
    if (Number.isNaN(ordre)) return
    saveFilter(selected.id, { ordreAffichage: ordre })
  }

  async function handleCreate(formData: FormData) {
    setCreateError(null)
    const rawChampId = formData.get("champEnrichissableId") as string
    const isVirtual = rawChampId.startsWith("__VIRTUAL_")
    const virtualCode = isVirtual ? rawChampId.replace("__VIRTUAL_", "") : null
    const type = formData.get("typeFiltre") as FilterType
    const ordre = Number(formData.get("ordreAffichage") || items.length)

    const baseInput: Omit<CreateFilterInput, "nomFiltre" | "champEnrichissableId" | "codeMachine"> = {
      typeFiltre: type,
      operateurs: DEFAULT_OPERATEURS[type],
      ordreAffichage: ordre,
    }

    let input: CreateFilterInput

    if (isVirtual) {
      const virtual = VIRTUAL_FILTERS.find((v) => v.codeMachine === virtualCode)
      if (!virtual) return
      if (items.some((f) => f.codeMachine === virtual.codeMachine)) {
        setCreateError("Un filtre existe déjà pour ce filtre virtuel.")
        return
      }
      input = {
        ...baseInput,
        nomFiltre: virtual.nomFiltre,
        codeMachine: virtual.codeMachine,
        champEnrichissableId: null,
      }
    } else {
      const champ = champs.find((c) => c.id === rawChampId)
      if (!champ) return
      if (items.some((f) => f.champEnrichissable?.id === champ.id)) {
        setCreateError("Un filtre existe déjà pour ce champ.")
        return
      }
      input = {
        ...baseInput,
        nomFiltre: champ.nomAffichage,
        champEnrichissableId: champ.id,
        codeMachine: null,
      }
    }

    try {
      await createFilter(input)
      window.location.reload()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur lors de la création du filtre.")
    }
  }

  async function handleDelete(id: string) {
    await deleteFilter(id)
    window.location.reload()
  }

  async function handlePublish() {
    setPublishing(true)
    await publishFilters(
      items.map((f) => ({
        id: f.id,
        ordreAffichage: f.ordreAffichage,
        estActif: f.estActif,
      }))
    )
    setPublishing(false)
    setLastSaved("__all__")
    setTimeout(() => setLastSaved((current) => (current === "__all__" ? null : current)), 1500)
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <Card className="shrink-0 border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Ajouter un filtre</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            action={handleCreate}
            className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Champ cible</Label>
              <ChampSelect champs={champs} value={newChampId} onValueChange={setNewChampId} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Type de filtre</Label>
              <TypeSelect name="typeFiltre" recommendedType={recommendedTypeForNew} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="newOrdre" className="text-sm font-medium">
                Ordre
              </Label>
              <Input id="newOrdre" name="ordreAffichage" type="number" defaultValue={items.length} />
            </div>
            <Button type="submit" disabled={isNewChampUsed} className="h-10 gap-2 rounded-lg">
              <Plus className="h-4 w-4" />
              {isNewChampUsed ? "Déjà ajouté" : "Ajouter"}
            </Button>
          </form>
          {createError && (
            <p className="mt-3 text-sm text-destructive">{createError}</p>
          )}
        </CardContent>
      </Card>

      <div className="relative w-full max-w-md shrink-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          placeholder="Rechercher un filtre"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 rounded-lg border-border pl-10 text-sm"
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="scrollable-list flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm">
          <div className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun filtre ne correspond à la recherche.</p>
            ) : (
              filtered.map((f) => {
                const isVirtual = !f.champEnrichissable && f.codeMachine
                const Icon = getFilterIcon(f.typeFiltre, f.champEnrichissable, f.codeMachine)
                const color = getFilterIconColor(f.typeFiltre)
                const unit = f.champEnrichissable?.unite
                const dataType = f.champEnrichissable?.typeDonnees
                const isSelected = selectedId === f.id

                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedId(f.id)}
                    className={cn(
                      "flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
                      isSelected
                        ? "border-primary bg-primary/[0.04] shadow-sm"
                        : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-12 w-12 shrink-0 items-center justify-center rounded-full",
                        color
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-base font-semibold text-foreground">{f.nomFiltre}</p>
                      <p className="text-sm text-muted-foreground">
                        Type : {FILTER_TYPE_LABELS[f.typeFiltre as FilterType] ?? f.typeFiltre}
                        {unit && unit !== "N/A" ? ` · Unité : ${unit}` : ""}
                        {dataType ? ` · ${DATA_TYPE_LABELS[dataType] ?? dataType}` : ""}
                        {isVirtual ? ` · Virtuel (${f.codeMachine})` : ""}
                      </p>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

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
                  <Select value={selected.typeFiltre} onValueChange={handleTypeChange}>
                    <SelectTrigger id="typeFiltre" className="h-10 w-full rounded-lg">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          <span className="flex items-center gap-2">
                            {t.label}
                            {t.value === selected.champEnrichissable?.typeFiltreRecommande && (
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

                {selected.champEnrichissable?.typeFiltreRecommande &&
                  selected.champEnrichissable.typeFiltreRecommande !== selected.typeFiltre && (
                    <div className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">Type recommandé</p>
                        <p className="text-xs text-muted-foreground">
                          {
                            FILTER_TYPE_LABELS[
                              selected.champEnrichissable.typeFiltreRecommande as FilterType
                            ]
                          }
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleTypeChange(
                            selected.champEnrichissable!.typeFiltreRecommande as FilterType
                          )
                        }
                      >
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
                  <Switch id="estActif" checked={selected.estActif} onCheckedChange={handleToggleActive} />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ordreAffichage" className="text-sm font-medium">
                    Ordre d&apos;affichage
                  </Label>
                  <Input
                    id="ordreAffichage"
                    type="number"
                    value={selected.ordreAffichage}
                    onChange={(e) => handleOrderChange(e.target.value)}
                    className="h-10 w-full rounded-lg"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(selected.id)}
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
      </div>
    </div>
  )
}

function ChampSelect({
  champs,
  value,
  onValueChange,
}: {
  champs: Champ[]
  value?: string
  onValueChange?: (value: string) => void
}) {
  const sourceChamps = champs.filter((c) => c.nature === "SOURCE")
  const enrichedChamps = champs.filter((c) => c.nature !== "SOURCE")

  return (
    <Select name="champEnrichissableId" value={value} defaultValue={champs[0]?.id} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 w-full rounded-lg">
        <SelectValue placeholder="Champ cible" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__source-heading__" disabled className="font-semibold text-muted-foreground">
          Champs sources
        </SelectItem>
        {sourceChamps.map((c) => (
          <SelectItem key={c.id} value={c.id} className="pl-6">
            {c.nomAffichage}
          </SelectItem>
        ))}
        <SelectItem value="__enrichi-heading__" disabled className="font-semibold text-muted-foreground">
          Champs enrichis
        </SelectItem>
        {enrichedChamps.map((c) => (
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

function TypeSelect({
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
        {FILTER_TYPES.map((t) => (
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
