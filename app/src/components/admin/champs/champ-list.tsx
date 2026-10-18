"use client"

import type { ReactNode } from "react"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { ChampEnrichissableConfig } from "@/types/champ"
import { NATURE_LABELS, TYPE_DONNEES_LABELS } from "./champs-model"

export function ChampList({
  filtered,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  children,
}: {
  filtered: ChampEnrichissableConfig[]
  selectedId: string | null
  onSelect: (champ: ChampEnrichissableConfig) => void
  search: string
  onSearchChange: (value: string) => void
  children?: ReactNode
}) {
  return (
    <>
      <div className="relative w-full max-w-md shrink-0">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex w-10 items-center justify-center">
          <Search className="h-4 w-4 text-muted-foreground" />
        </div>
        <Input
          placeholder="Rechercher un champ"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
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
                  onClick={() => onSelect(c)}
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
        {children}
      </div>
    </>
  )
}
