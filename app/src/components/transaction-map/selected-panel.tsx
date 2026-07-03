"use client"

import { MapPin, Trash2, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"

type TransactionMapSelectedPanelProps = {
  selectedCount: number
  onClear: () => void
  onFilter: () => void
}

export function TransactionMapSelectedPanel({
  selectedCount,
  onClear,
  onFilter,
}: TransactionMapSelectedPanelProps) {
  return (
    <Card className="absolute bottom-4 left-4 z-[9999] w-80 border-border shadow-lg">
      <CardContent className="flex flex-col gap-3 p-3">
        <div className="flex items-center justify-between gap-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            <span className="text-foreground">
              <strong>{selectedCount}</strong>{" "}
              transaction{selectedCount > 1 ? "s" : ""} sélectionnée
              {selectedCount > 1 ? "s" : ""}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={onClear}
            title="Effacer la sélection"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" className="w-full gap-2" onClick={onFilter}>
          <Filter className="h-4 w-4" />
          Filtrer dans la liste
        </Button>
      </CardContent>
    </Card>
  )
}
