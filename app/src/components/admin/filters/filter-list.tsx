"use client"

import type { DragEvent, ReactNode, RefObject } from "react"
import { Search, GripVertical } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { getFilterIcon, getFilterIconColor } from "@/lib/filter-icons"
import type { FilterType } from "@/types/filter"
import { DATA_TYPE_LABELS, FILTER_TYPE_LABELS, type Filter } from "./filter-constants"

export function FilterList({
  filtered,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  canReorder,
  draggedId,
  dropIndex,
  listRef,
  onDragOver,
  onDrop,
  onDragStart,
  onDragEnd,
  children,
}: {
  filtered: Filter[]
  selectedId: string | null
  onSelect: (id: string) => void
  search: string
  onSearchChange: (value: string) => void
  canReorder: boolean
  draggedId: string | null
  dropIndex: number | null
  listRef: RefObject<HTMLDivElement | null>
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  onDragStart: (id: string) => void
  onDragEnd: () => void
  children?: ReactNode
}) {
  return (
    <>
      <div className="relative w-full max-w-md shrink-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          placeholder="Rechercher un filtre"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-10 rounded-lg border-border pl-10 text-sm"
        />
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="scrollable-list flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card p-3 shadow-sm">
          <div
            ref={listRef}
            onDragOver={onDragOver}
            onDrop={onDrop}
            className="flex-1 overflow-y-auto min-h-0 space-y-3 pr-1"
          >
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun filtre ne correspond à la recherche.</p>
            ) : (
              filtered.map((f, index) => {
                const isVirtual = !f.champ && !!f.codeMachine
                const Icon = getFilterIcon(f.typeFiltre, f.champ, f.codeMachine)
                const color = getFilterIconColor(f.typeFiltre)
                const unit = f.champ?.unite
                const dataType = f.champ?.typeDonnees
                const isSelected = selectedId === f.id
                const showTopLine = dropIndex === index
                const showBottomLine = index === filtered.length - 1 && dropIndex === filtered.length

                return (
                  <div
                    key={f.id}
                    data-row-id={f.id}
                    className={cn(
                      "flex w-full items-center gap-1 rounded-xl border p-2 pl-1 transition-all",
                      isSelected
                        ? "border-primary bg-primary/[0.04] shadow-sm"
                        : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30",
                      draggedId === f.id && "opacity-40",
                      showTopLine && "border-t-2 border-t-primary",
                      showBottomLine && "border-b-2 border-b-primary"
                    )}
                  >
                    <span
                      draggable={canReorder}
                      onDragStart={(e) => {
                        onDragStart(f.id)
                        e.dataTransfer.effectAllowed = "move"
                      }}
                      onDragEnd={onDragEnd}
                      role="button"
                      tabIndex={-1}
                      aria-label="Réordonner"
                      title={
                        canReorder
                          ? "Glisser pour réordonner"
                          : "Réordonnancement indisponible pendant une recherche"
                      }
                      className={cn(
                        "flex shrink-0 touch-none items-center justify-center rounded p-2 text-muted-foreground",
                        canReorder
                          ? "cursor-grab hover:bg-muted active:cursor-grabbing"
                          : "cursor-not-allowed opacity-40"
                      )}
                    >
                      <GripVertical className="h-5 w-5" />
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelect(f.id)}
                      className="flex min-w-0 flex-1 items-center gap-4 rounded-lg p-2 text-left"
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
                  </div>
                )
              })
            )}
          </div>
        </div>
        {children}
      </div>
    </>
  )
}
