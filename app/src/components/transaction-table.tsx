"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronUp, Eye, Pencil, Plus, Loader2, Settings2 } from "lucide-react"
import { useResponsiveColumns } from "@/hooks/use-responsive-columns"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type TransactionRow = {
  id: string
  numeroInscription: string
  dateVente: string
  mrc: string | null
  municipalite: string | null
  superficieTotaleHectare: number | null
  prixVente: number | null
  typeTransaction: string | null
  enrichie?: { statut: string } | null
}

type TableData = {
  transactions: TransactionRow[]
  total: number
}

const COLUMNS = [
  { key: "numeroInscription", label: "Numéro d'acte", numeric: false, sortable: true, defaultVisible: true, minWidth: 140, priority: 9 },
  { key: "typeTransaction", label: "Type", numeric: false, sortable: false, defaultVisible: true, minWidth: 100, priority: 2 },
  { key: "dateVente", label: "Date", numeric: false, sortable: true, defaultVisible: true, minWidth: 110, priority: 8 },
  { key: "mrc", label: "MRC", numeric: false, sortable: true, defaultVisible: true, minWidth: 120, priority: 4 },
  { key: "municipalite", label: "Municipalité", numeric: false, sortable: true, defaultVisible: false, minWidth: 150, priority: 1 },
  { key: "superficieTotaleHectare", label: "Superficie (ha)", numeric: true, sortable: true, defaultVisible: true, minWidth: 130, priority: 5 },
  { key: "prixVente", label: "Prix à l'acte", numeric: true, sortable: true, defaultVisible: true, minWidth: 140, priority: 7 },
  { key: "tauxGlobal", label: "Taux global ($/ha)", numeric: true, sortable: false, defaultVisible: true, minWidth: 140, priority: 6 },
  { key: "statut", label: "Statut", numeric: false, sortable: false, defaultVisible: true, minWidth: 110, priority: 3 },
  { key: "actions", label: "Actions", numeric: false, sortable: false, defaultVisible: true, minWidth: 80, priority: 10 },
]

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatNumber(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("fr-CA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

function computeTauxGlobal(row: TransactionRow): number | null {
  if (!row.prixVente || !row.superficieTotaleHectare) return null
  return row.prixVente / row.superficieTotaleHectare
}

function statusBadge(statut: string | null | undefined) {
  const value = statut ?? "NON_ANALYSEE"
  switch (value.toUpperCase()) {
    case "ANALYSEE":
    case "VALIDEE":
      return <Badge variant="default">Analysée</Badge>
    case "A_ANALYSER":
    case "A ANALYSER":
    case "NON_ANALYSEE":
    case "EN_COURS":
    case "EN COURS D'ANALYSE":
      return <Badge variant="warning">À analyser</Badge>
    case "ERREUR":
    case "REFUSEE":
      return <Badge variant="destructive">Refusée</Badge>
    default:
      return <Badge variant="secondary">{value}</Badge>
  }
}

function Actions({ statut }: { statut: string | null | undefined }) {
  const value = statut ?? "NON_ANALYSEE"
  const isAnalyzed = ["ANALYSEE", "VALIDEE"].includes(value.toUpperCase())

  return (
    <div className="flex items-center justify-end gap-1">
      {isAnalyzed ? (
        <>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Voir">
            <Eye className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ajouter au panier">
            <Plus className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button variant="ghost" size="icon" className="h-8 w-8" title="Analyser">
          <Pencil className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

export function TransactionTable({
  data,
  onSort,
  sortField,
  sortOrder,
  hasMore,
  loading,
  sentinelRef,
}: {
  data: TableData
  onSort: (field: string) => void
  sortField: string
  sortOrder: "asc" | "desc"
  hasMore: boolean
  loading: boolean
  sentinelRef: React.RefObject<HTMLDivElement | null>
}) {
  const initialVisible = useMemo(
    () => new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key)),
    []
  )
  const columnMeta = useMemo(
    () => COLUMNS.map((c) => ({ key: c.key, minWidth: c.minWidth, priority: c.priority })),
    []
  )
  const {
    containerRef,
    visibleColumns,
    toggleColumn,
    resetColumns,
    hasUserOverride,
  } = useResponsiveColumns(columnMeta, initialVisible, ["actions"])

  const [showColumnMenu, setShowColumnMenu] = useState(false)
  const visible = useMemo(() => COLUMNS.filter((c) => visibleColumns.has(c.key)), [visibleColumns])

  return (
    <Card className="flex flex-col min-w-0" ref={containerRef}>
      <div className="flex items-center justify-between border-b px-4 py-1">
        <span className="text-sm font-semibold text-foreground">
          Résultats
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({data.total} transaction{data.total > 1 ? "s" : ""})
          </span>
        </span>
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-2 text-xs"
            onClick={() => setShowColumnMenu((prev) => !prev)}
          >
            <Settings2 className="h-4 w-4" />
            Colonnes
          </Button>
          {showColumnMenu && (
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-md border border-border bg-card p-2 shadow-md">
              {COLUMNS.filter((c) => c.key !== "actions").map((col) => (
                <label
                  key={col.key}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                  />
                  {col.label}
                </label>
              ))}
              {hasUserOverride && (
                <>
                  <div className="my-1 border-t border-border" />
                  <button
                    className="w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => {
                      resetColumns()
                      setShowColumnMenu(false)
                    }}
                  >
                    Réinitialiser l'affichage auto
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      <CardContent className="p-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              {visible.map((col) => (
                <TableHead
                  key={col.key}
                  className={`py-2 ${col.numeric ? "text-right" : ""}`}
                  onClick={() => col.sortable && onSort(col.key)}
                >
                  {col.sortable ? (
                    <button className="flex items-center gap-1 font-semibold">
                      {col.label}
                      {sortField === col.key &&
                        (sortOrder === "asc" ? (
                          <ChevronUp className="h-3.5 w-3.5" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        ))}
                    </button>
                  ) : (
                    <span className="font-semibold">{col.label}</span>
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.transactions.map((t) => (
              <TableRow key={t.id} className="cursor-pointer hover:bg-muted/30">
                {visibleColumns.has("numeroInscription") && <TableCell className="py-2 font-medium">{t.numeroInscription}</TableCell>}
                {visibleColumns.has("typeTransaction") && <TableCell className="py-2">{t.typeTransaction ?? "—"}</TableCell>}
                {visibleColumns.has("dateVente") && <TableCell className="py-2">{new Date(t.dateVente).toLocaleDateString("fr-CA")}</TableCell>}
                {visibleColumns.has("mrc") && <TableCell className="py-2">{t.mrc ?? "—"}</TableCell>}
                {visibleColumns.has("municipalite") && <TableCell className="py-2">{t.municipalite ?? "—"}</TableCell>}
                {visibleColumns.has("superficieTotaleHectare") && <TableCell className="py-2 text-right">{formatNumber(t.superficieTotaleHectare)}</TableCell>}
                {visibleColumns.has("prixVente") && <TableCell className="py-2 text-right">{formatCurrency(t.prixVente)}</TableCell>}
                {visibleColumns.has("tauxGlobal") && <TableCell className="py-2 text-right">{formatCurrency(computeTauxGlobal(t))}</TableCell>}
                {visibleColumns.has("statut") && <TableCell className="py-2">{statusBadge(t.enrichie?.statut)}</TableCell>}
                <TableCell className="py-2 text-right">
                  <Actions statut={t.enrichie?.statut} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {loading && (
          <div className="flex items-center justify-center gap-2 border-t border-border py-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement...
          </div>
        )}
        <div ref={sentinelRef} className="h-4" />
      </CardContent>
    </Card>
  )
}
