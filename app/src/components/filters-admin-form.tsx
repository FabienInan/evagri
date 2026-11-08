"use client"

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react"
import { Save } from "lucide-react"
import { createFilter, deleteFilter, publishFilters } from "@/server/actions/filters"
import { useHeaderActions } from "@/components/header-actions"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { recommendFilterType, recommendedTypeForField, DEFAULT_OPERATEURS, moveItemToIndex } from "@/lib/filters"
import type { FilterType } from "@/types/filter"
import type { CreateFilterInput } from "@/server/actions/filters"
import { FilterCreateCard } from "@/components/admin/filters/filter-create-card"
import { Modal } from "@/components/dossier/modal"
import { FilterList } from "@/components/admin/filters/filter-list"
import { FilterDetailsCard } from "@/components/admin/filters/filter-details-card"
import { VIRTUAL_FILTERS, type Champ, type Filter } from "@/components/admin/filters/filter-constants"

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
  // Rien n'est envoyé au serveur avant « Enregistrer » : créations, suppressions et modifications sont en attente.
  type PendingCreate = { tempId: string; input: CreateFilterInput }
  const [pendingCreates, setPendingCreates] = useState<PendingCreate[]>([])
  const [pendingDeletes, setPendingDeletes] = useState<string[]>([])
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(filters))
  const dirty = pendingCreates.length > 0 || pendingDeletes.length > 0 || JSON.stringify(items) !== baseline
  const [publishing, setPublishing] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [draggedId, setDraggedId] = useState<string | null>(null)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  // Dérivé de `items` (et non de la prop initiale) : la cible proposée reste juste après une création,
  // sans rechargement de page.
  const firstAvailableChamp = champs.find((c) => !items.some((f) => f.champ?.id === c.id))
  const firstAvailableVirtual = VIRTUAL_FILTERS.find(
    (v) => !items.some((f) => f.codeMachine === v.codeMachine)
  )
  const [newChampId, setNewChampId] = useState<string>(
    firstAvailableChamp?.id ?? (firstAvailableVirtual ? `__VIRTUAL_${firstAvailableVirtual.codeMachine}` : "")
  )
  const isVirtualSelection = newChampId.startsWith("__VIRTUAL_")
  const selectedVirtualCode = isVirtualSelection ? newChampId.replace("__VIRTUAL_", "") : null
  const isNewChampUsed = isVirtualSelection
    ? items.some((f) => f.codeMachine === selectedVirtualCode)
    : items.some((f) => f.champ?.id === newChampId)
  const recommendedTypeForNew = useMemo<FilterType | null>(() => {
    if (isVirtualSelection) {
      return VIRTUAL_FILTERS.find((v) => v.codeMachine === selectedVirtualCode)?.typeFiltre ?? null
    }
    const champ = champs.find((c) => c.id === newChampId)
    if (!champ) return null
    return recommendFilterType({
      codeMachine: champ.codeMachine,
      nomAffichage: champ.nomAffichage,
      typeDonnees: champ.typeDonnees,
    })
  }, [newChampId, isVirtualSelection, selectedVirtualCode, champs])
  const { setAction, clearAction } = useHeaderActions()
  // The header button is set once per (publishing, lastSaved) change, so a bare `onClick={handlePublish}`
  // would freeze an `items` snapshot: a pure reorder doesn't change those deps and would publish the old
  // order. Keeping the latest handler in a ref avoids the stale closure.
  const publishRef = useRef<() => void>(() => {})

  useEffect(() => {
    setAction(
      <Button
        onClick={() => publishRef.current()}
        disabled={publishing || !dirty}
        className="h-9 gap-2 rounded-lg px-4"
      >
        <Save className="h-4 w-4" />
        {publishing ? "Enregistrement..." : "Enregistrer"}
      </Button>
    )
    return () => clearAction()
  }, [publishing, dirty])

  const selected = useMemo(
    () => (items.find((f) => f.id === selectedId) as Filter | undefined) ?? null,
    [items, selectedId]
  )

  // Recomputed from the target rather than the stored `type_filtre_recommande` column, so the badge and the
  // "Type recommandé" panel stay in sync with the create form and also cover source filters.
  const selectedRecommended = useMemo(
    () => (selected ? recommendedTypeForField(selected) : null),
    [selected]
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

  function handleTypeChange(value: FilterType) {
    if (!selected) return
    updateLocal(selected.id, {
      typeFiltre: value,
      operateursDisponibles: DEFAULT_OPERATEURS[value],
    })
  }

  function handleToggleActive(checked: boolean) {
    if (!selected) return
    updateLocal(selected.id, { estActif: checked })
  }

  // Réordonner un sous-ensemble filtré n'a pas de sens : le glisser-déposer est inactif pendant une recherche.
  const canReorder = search.trim() === ""

  // Position d'insertion = slot (0..length) sous le curseur : moitié haute d'une ligne → avant la
  // ligne, moitié basse → après. Le slot `length` (sous la dernière ligne) permet d'atteindre la fin.
  function computeDropIndex(clientY: number): number {
    const container = listRef.current
    if (!container) return filtered.length
    const rows = Array.from(container.querySelectorAll<HTMLElement>("[data-row-id]"))
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) return i
    }
    return rows.length
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    if (!canReorder || !draggedId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const next = computeDropIndex(e.clientY)
    if (next !== dropIndex) setDropIndex(next)
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    if (!canReorder || !draggedId || dropIndex === null) return
    setItems(moveItemToIndex(filtered, draggedId, dropIndex))
    setDraggedId(null)
    setDropIndex(null)
  }

  async function handleCreate(formData: FormData) {
    setCreateError(null)
    const rawChampId = formData.get("champId") as string
    const type = formData.get("typeFiltre") as FilterType
    // Nouveau filtre ajouté en fin de liste : l'ordre se règle ensuite par glisser-déposer.
    const ordre = items.reduce((max, f) => Math.max(max, f.ordreAffichage), -1) + 1

    const baseInput: Omit<CreateFilterInput, "nomFiltre" | "champId" | "codeMachine"> = {
      typeFiltre: type,
      operateurs: DEFAULT_OPERATEURS[type],
      ordreAffichage: ordre,
    }

    let input: CreateFilterInput

    if (rawChampId.startsWith("__VIRTUAL_")) {
      const virtualCode = rawChampId.replace("__VIRTUAL_", "")
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
        champId: null,
      }
    } else {
      const champ = champs.find((c) => c.id === rawChampId)
      if (!champ) return
      if (items.some((f) => f.champ?.id === champ.id)) {
        setCreateError("Un filtre existe déjà pour ce champ.")
        return
      }
      input = {
        ...baseInput,
        nomFiltre: champ.nomAffichage,
        champId: champ.id,
        codeMachine: null,
      }
    }

    // Pas d'appel serveur ici : le filtre est ajouté à la liste et créé à « Enregistrer ».
    const tempId = `new-${crypto.randomUUID()}`
    const champ = input.champId ? (champs.find((c) => c.id === input.champId) ?? null) : null
    const filter: Filter = {
      id: tempId,
      nomFiltre: input.nomFiltre,
      typeFiltre: input.typeFiltre,
      estActif: true,
      codeMachine: input.codeMachine,
      champ: champ
        ? {
            id: champ.id,
            codeMachine: champ.codeMachine,
            nomAffichage: champ.nomAffichage,
            typeDonnees: champ.typeDonnees,
            unite: champ.unite,
            typeFiltreRecommande: champ.typeFiltreRecommande,
          }
        : null,
      operateursDisponibles: input.operateurs,
      ordreAffichage: input.ordreAffichage,
    }
    setItems((prev) => [...prev, filter])
    setPendingCreates((prev) => [...prev, { tempId, input }])
    setSelectedId(tempId)
    setShowCreate(false)
  }

  function handleDelete(id: string) {
    setActionError(null)
    const remaining = items.filter((f) => f.id !== id)
    setItems(remaining)
    if (id.startsWith("new-")) {
      setPendingCreates((prev) => prev.filter((p) => p.tempId !== id))
    } else {
      setPendingDeletes((prev) => [...prev, id])
    }
    setSelectedId((current) => (current === id ? (remaining[0]?.id ?? null) : current))
  }

  /** Envoie tout en une fois : créations, suppressions, puis ordre, activation et type. */
  async function handlePublish() {
    setPublishing(true)
    setActionError(null)
    try {
      const idMap = new Map<string, string>()
      for (const pending of pendingCreates) {
        const result = await createFilter(pending.input)
        if (!result.ok) {
          setActionError(result.error)
          return
        }
        const realId = result.filter.id
        idMap.set(pending.tempId, realId)
        setItems((prev) => prev.map((f) => (f.id === pending.tempId ? { ...f, id: realId } : f)))
        setSelectedId((current) => (current === pending.tempId ? realId : current))
        setPendingCreates((prev) => prev.filter((p) => p.tempId !== pending.tempId))
      }
      for (const id of pendingDeletes) {
        const result = await deleteFilter(id)
        if (!result.ok) {
          setActionError(result.error)
          return
        }
        setPendingDeletes((prev) => prev.filter((d) => d !== id))
      }
      const ordered = items.map((f) => ({ ...f, id: idMap.get(f.id) ?? f.id }))
      const result = await publishFilters(
        ordered.map((f) => ({
          id: f.id,
          ordreAffichage: f.ordreAffichage,
          estActif: f.estActif,
          typeFiltre: f.typeFiltre as FilterType,
          operateursDisponibles: f.operateursDisponibles,
        }))
      )
      if (!result.ok) {
        setActionError(result.error)
        return
      }
      setBaseline(JSON.stringify(ordered))
      setLastSaved("__all__")
      setTimeout(() => setLastSaved((current) => (current === "__all__" ? null : current)), 1500)
    } catch {
      setActionError("Échec de l'enregistrement de la configuration.")
    } finally {
      setPublishing(false)
    }
  }

  // Keeps `publishRef` pointing at the latest handlePublish (with the current `items`) on every render,
  // so the header button never publishes a stale order.
  useEffect(() => {
    publishRef.current = handlePublish
  })

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <p className="flex items-center gap-3 text-sm text-muted-foreground">
          {items.length} filtre{items.length > 1 ? "s" : ""}
          {dirty && <span className="font-medium text-foreground">Modifications non enregistrées</span>}
          {lastSaved === "__all__" && !dirty && <span className="text-primary">Enregistré ✓</span>}
        </p>
        <Button size="sm" className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" />
          Ajouter un filtre
        </Button>
      </div>

      {showCreate && (
        <Modal title="Ajouter un filtre" onClose={() => setShowCreate(false)} className="max-w-3xl">
          <FilterCreateCard
            champs={champs}
            newChampId={newChampId}
            onNewChampIdChange={setNewChampId}
            recommendedType={recommendedTypeForNew}
            isNewChampUsed={isNewChampUsed}
            createError={createError}
            onCreate={handleCreate}
          />
        </Modal>
      )}

      {actionError && <p className="shrink-0 text-sm text-destructive">{actionError}</p>}

      <FilterList
        filtered={filtered}
        selectedId={selectedId}
        onSelect={setSelectedId}
        search={search}
        onSearchChange={setSearch}
        canReorder={canReorder}
        draggedId={draggedId}
        dropIndex={dropIndex}
        listRef={listRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragStart={setDraggedId}
        onDragEnd={() => {
          setDraggedId(null)
          setDropIndex(null)
        }}
      >
        <FilterDetailsCard
          selected={selected}
          selectedRecommended={selectedRecommended}
          onTypeChange={handleTypeChange}
          onToggleActive={handleToggleActive}
          onDelete={handleDelete}
        />
      </FilterList>
    </div>
  )
}
