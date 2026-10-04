"use client"

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { saveFicheLayout } from "@/server/actions/sections"
import {
  UNASSIGNED,
  buildInitialLayout,
  moveBetweenContainers,
  newSectionId,
  removeSection as removeSectionFrom,
  reorderSections,
  reorderWithinContainer,
  toFicheSections,
  type Containers,
  type SectionMeta,
} from "@/lib/fiche-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ChampEnrichissableConfig, FicheSection } from "@/types/champ"

export type SectionsEditorHandle = { save: () => Promise<string | null> }

/** A section owns two droppables (its sortable wrapper and its champ grid), so they need distinct dnd-kit ids. */
const SECTION_PREFIX = "section-handle:"
const toSectionSortableId = (id: string) => `${SECTION_PREFIX}${id}`
const fromSectionSortableId = (id: string) => id.slice(SECTION_PREFIX.length)

function ChampChip({ id, label }: { id: string; label: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { type: "champ" },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      className={cn(
        "flex cursor-grab touch-none items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm select-none active:cursor-grabbing",
        isDragging && "opacity-40"
      )}
    >
      <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </div>
  )
}

function ChampGrid({
  containerId,
  champIds,
  labelOf,
  emptyLabel,
}: {
  containerId: string
  champIds: string[]
  labelOf: (id: string) => string
  emptyLabel: string
}) {
  // Registers the container itself so a champ can be dropped into a section that has no champ yet.
  const { setNodeRef, isOver } = useDroppable({ id: containerId, data: { type: "container" } })

  return (
    <SortableContext items={champIds} strategy={rectSortingStrategy}>
      <div
        ref={setNodeRef}
        className={cn(
          "grid min-h-16 grid-cols-2 content-start gap-2 rounded-lg p-2 transition-colors lg:grid-cols-3 xl:grid-cols-4",
          isOver ? "bg-primary/[0.06]" : "bg-muted/20"
        )}
      >
        {champIds.map((id) => (
          <ChampChip key={id} id={id} label={labelOf(id)} />
        ))}
        {champIds.length === 0 && (
          <p className="col-span-full py-3 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        )}
      </div>
    </SortableContext>
  )
}

function SectionCard({
  section,
  champIds,
  labelOf,
  onRename,
  onRemove,
}: {
  section: SectionMeta
  champIds: string[]
  labelOf: (id: string) => string
  onRename: (id: string, nom: string) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: toSectionSortableId(section.id),
    data: { type: "section" },
  })

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "flex flex-col gap-2 rounded-xl border border-border bg-card p-3 shadow-sm",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-center gap-2">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`Déplacer la section ${section.nom}`}
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Input
          value={section.nom}
          onChange={(e) => onRename(section.id, e.target.value)}
          aria-label="Nom de la section"
          className="h-8 flex-1 text-sm font-semibold"
        />
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onRemove(section.id)}
          aria-label={`Supprimer la section ${section.nom}`}
        >
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <ChampGrid
        containerId={section.id}
        champIds={champIds}
        labelOf={labelOf}
        emptyLabel="Déposez des champs ici"
      />
    </div>
  )
}

export const SectionsEditor = forwardRef<SectionsEditorHandle, {
  champs: ChampEnrichissableConfig[]
  initialSections: FicheSection[]
}>(function SectionsEditor({
  champs,
  initialSections,
}, ref) {
  const initial = useMemo(
    () => buildInitialLayout(champs.map((c) => c.id), initialSections),
    [champs, initialSections]
  )
  const [containers, setContainers] = useState<Containers>(initial.containers)
  const [sections, setSections] = useState<SectionMeta[]>(initial.sections)
  const [newSectionName, setNewSectionName] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<"champ" | "section" | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const champById = useMemo(() => new Map(champs.map((c) => [c.id, c])), [champs])
  const labelOf = (id: string) => champById.get(id)?.nomAffichage ?? id

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // Sticky fallback: once a container is targeted, keep targeting it if the pointer briefly leaves every droppable
  // (e.g. passing over padding or a gap), instead of the drop silently reverting to the origin.
  const lastOverId = useRef<string | null>(null)

  /**
   * Champs may only target champs or container grids (section handles are drop targets for sections only).
   * Rect/corner-distance algorithms (closestCorners/closestCenter) frequently misresolve overlapping or
   * adjacent multi-container drop zones; pointer-based hit testing (with a rect-intersection fallback) is
   * the pattern dnd-kit's own multi-container example uses to fix exactly this "drop reverts" symptom.
   */
  const collisionDetection: CollisionDetection = (args) => {
    if (activeType === "section") {
      return closestCenter({
        ...args,
        droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type === "section"),
      })
    }

    const scoped = {
      ...args,
      droppableContainers: args.droppableContainers.filter((c) => c.data.current?.type !== "section"),
    }

    const pointerCollisions = pointerWithin(scoped)
    const intersections = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(scoped)
    const overId = getFirstCollision(intersections, "id")

    if (overId != null) {
      lastOverId.current = String(overId)
      return intersections
    }

    return lastOverId.current ? [{ id: lastOverId.current }] : []
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id))
    setActiveType(event.active.data.current?.type === "section" ? "section" : "champ")
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.data.current?.type === "section") return

    const translatedTop = active.rect.current.translated?.top
    const insertBelow =
      translatedTop !== undefined && !!over.rect && translatedTop > over.rect.top + over.rect.height / 2

    setContainers((prev) => moveBetweenContainers(prev, String(active.id), String(over.id), insertBelow))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    resetDrag()
    if (!over) return

    if (active.data.current?.type === "section") {
      setSections((prev) =>
        reorderSections(prev, fromSectionSortableId(String(active.id)), fromSectionSortableId(String(over.id)))
      )
      return
    }

    setContainers((prev) => reorderWithinContainer(prev, String(active.id), String(over.id)))
  }

  function resetDrag() {
    setActiveId(null)
    setActiveType(null)
    lastOverId.current = null
  }

  function addSection() {
    const nom = newSectionName.trim()
    if (!nom) return
    const id = newSectionId()
    setSections((prev) => [...prev, { id, nom }])
    setContainers((prev) => ({ ...prev, [id]: [] }))
    setNewSectionName("")
  }

  function renameSection(id: string, nom: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, nom } : s)))
  }

  function handleRemoveSection(id: string) {
    const next = removeSectionFrom({ containers, sections }, id)
    setContainers(next.containers)
    setSections(next.sections)
  }

  /** Returns null on success, or the error message, so the parent owns where the failure is shown. */
  async function handleSave(): Promise<string | null> {
    setSaving(true)
    try {
      const result = await saveFicheLayout(toFicheSections({ containers, sections }))
      if (!result.ok) return result.error
      setSaved(true)
      setTimeout(() => setSaved(false), 1500)
      return null
    } catch {
      return "Échec de l'enregistrement de la disposition."
    } finally {
      setSaving(false)
    }
  }

  useImperativeHandle(ref, () => ({ save: handleSave }))

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={resetDrag}
      >
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
          <div className="shrink-0 rounded-xl border border-dashed border-border p-3">
            <p className="mb-2 text-sm font-semibold text-muted-foreground">
              Champs non assignés ({containers[UNASSIGNED]?.length ?? 0})
            </p>
            <div className="max-h-60 overflow-y-auto">
              <ChampGrid
                containerId={UNASSIGNED}
                champIds={containers[UNASSIGNED] ?? []}
                labelOf={labelOf}
                emptyLabel="Tous les champs sont assignés à une section."
              />
            </div>
          </div>

          <SortableContext items={sections.map((s) => toSectionSortableId(s.id))} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {sections.map((section) => (
                <SectionCard
                  key={section.id}
                  section={section}
                  champIds={containers[section.id] ?? []}
                  labelOf={labelOf}
                  onRename={renameSection}
                  onRemove={handleRemoveSection}
                />
              ))}
            </div>
          </SortableContext>

          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3">
            <Input
              placeholder="Nom de la nouvelle section (ex. : Superficies)"
              value={newSectionName}
              onChange={(e) => setNewSectionName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addSection()}
              className="h-9 max-w-sm"
            />
            <Button variant="outline" onClick={addSection} className="gap-2 rounded-lg">
              <Plus className="h-4 w-4" />
              Ajouter une section
            </Button>
          </div>
        </div>

        <DragOverlay>
          {activeId && activeType === "champ" && (
            <div className="flex items-center gap-2 rounded-lg border border-primary bg-card px-3 py-2 text-sm shadow-lg">
              <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="truncate">{labelOf(activeId)}</span>
            </div>
          )}
          {activeId && activeType === "section" && (
            <div className="rounded-xl border border-primary bg-card p-3 text-sm font-semibold shadow-lg">
              {sections.find((s) => s.id === fromSectionSortableId(activeId))?.nom}
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  )
})
