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
import type { SerializedTransaction, EnrichmentValues } from "@/serializers/transaction.serializer"
import type { TransactionSourceField } from "@/lib/transaction-source-fields"
import type { EnrichmentField } from "@/repositories/enrichment.repository"

export type TransactionRow = SerializedTransaction

type TableData = {
  transactions: TransactionRow[]
  total: number
}

const COMPUTED_COLUMNS = [
  { key: "tauxGlobal", label: "Taux global ($/ha)", numeric: true, sortable: false, defaultVisible: true, minWidth: 150, priority: 6 },
  { key: "statut", label: "Statut", numeric: false, sortable: false, defaultVisible: true, minWidth: 110, priority: 3 },
  { key: "actions", label: "Actions", numeric: false, sortable: false, defaultVisible: true, minWidth: 80, priority: 10 },
]

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatNumber(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined) return "—"
  return new Intl.NumberFormat("fr-CA", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value)
}

export function formatValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return formatNumber(value)
  return String(value)
}

function computeTauxGlobal(row: TransactionRow): number | null {
  if (!row.prixVente || !row.superficieTotaleHectare) return null
  return row.prixVente / row.superficieTotaleHectare
}

function StatusBadge({ statut }: { statut: string | null | undefined }) {
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

type ColumnDef = {
  key: string
  label: string
  numeric: boolean
  sortable: boolean
  defaultVisible: boolean
  minWidth: number
  priority: number
  enrichment?: boolean
}

function isNumericEnrichment(typeDonnees: string): boolean {
  return typeDonnees === "DECIMAL" || typeDonnees === "ENTIER" || typeDonnees === "POURCENTAGE"
}

function useTableColumns(
  sourceFields: TransactionSourceField[],
  enrichmentFields: EnrichmentField[]
) {
  return useMemo<ColumnDef[]>(() => {
    const sourceCols: ColumnDef[] = sourceFields.map((field) => ({
      key: field.key,
      label: field.label,
      numeric: field.numeric,
      sortable: field.sortable,
      defaultVisible: field.defaultVisible,
      minWidth: field.minWidth,
      priority: field.priority,
    }))

    const enrichmentCols: ColumnDef[] = enrichmentFields.map((field) => ({
      key: field.codeMachine,
      label: field.nomAffichage,
      numeric: isNumericEnrichment(field.typeDonnees),
      sortable: false,
      defaultVisible: false,
      minWidth: 130,
      priority: 1,
      enrichment: true,
    }))

    return [...sourceCols, ...enrichmentCols, ...COMPUTED_COLUMNS]
  }, [sourceFields, enrichmentFields])
}

interface TransactionTableProps {
  data: TableData
  sourceFields: TransactionSourceField[]
  enrichmentFields: EnrichmentField[]
  onSort: (field: string) => void
  sortField: string
  sortOrder: "asc" | "desc"
  hasMore: boolean
  loading: boolean
  sentinelRef: React.RefObject<HTMLDivElement | null>
}

function ColumnMenu({
  columns,
  visibleColumns,
  toggleColumn,
  hasUserOverride,
  resetColumns,
}: {
  columns: ColumnDef[]
  visibleColumns: Set<string>
  toggleColumn: (key: string) => void
  hasUserOverride: boolean
  resetColumns: () => void
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-2 text-xs"
        onClick={() => setShow((prev) => !prev)}
      >
        <Settings2 className="h-4 w-4" />
        Colonnes
      </Button>
      {show && (
        <div className="absolute right-0 z-20 mt-1 max-h-80 w-64 overflow-y-auto rounded-md border border-border bg-card p-2 shadow-md">
          <div className="space-y-0.5">
            {columns
              .filter((c) => c.key !== "actions")
              .map((col) => (
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
          </div>
          {hasUserOverride && (
            <>
              <div className="my-1 border-t border-border" />
              <button
                className="w-full rounded px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                onClick={() => {
                  resetColumns()
                  setShow(false)
                }}
              >
                Réinitialiser l'affichage auto
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TransactionTableHeader({
  visible,
  sortField,
  sortOrder,
  onSort,
}: {
  visible: ColumnDef[]
  sortField: string
  sortOrder: "asc" | "desc"
  onSort: (field: string) => void
}) {
  return (
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
  )
}

function TransactionTableCell({
  row,
  col,
}: {
  row: TransactionRow
  col: ColumnDef
}) {
  if (col.key === "tauxGlobal") {
    return <TableCell className="py-2 text-right">{formatCurrency(computeTauxGlobal(row))}</TableCell>
  }
  if (col.key === "statut") {
    return <TableCell className="py-2"><StatusBadge statut={row.enrichie?.statut} /></TableCell>
  }
  if (col.key === "actions") {
    return (
      <TableCell className="py-2 text-right">
        <Actions statut={row.enrichie?.statut} />
      </TableCell>
    )
  }
  if (col.enrichment) {
    const value = row.enrichment[col.key]
    return (
      <TableCell className={`py-2 ${typeof value === "number" ? "text-right" : ""}`}>
        {formatValue(value)}
      </TableCell>
    )
  }
  if (col.key === "numeroInscription") {
    return <TableCell className="py-2 font-medium">{row.numeroInscription ?? row.enrichment["sia"] ?? "—"}</TableCell>
  }
  if (col.key === "dateVente") {
    return <TableCell className="py-2">{row.dateVente ? new Date(row.dateVente).toLocaleDateString("fr-CA") : "—"}</TableCell>
  }
  if (col.key === "lotsCadastraux") {
    return <TableCell className="py-2">{row.lotsCadastraux?.join(", ") ?? "—"}</TableCell>
  }

  const value = row[col.key as keyof TransactionRow]
  if (col.numeric) {
    return (
      <TableCell className="py-2 text-right">
        {formatValue(value as string | number | boolean | null)}
      </TableCell>
    )
  }
  return <TableCell className="py-2">{formatValue(value as string | number | boolean | null)}</TableCell>
}

function TransactionTableBody({
  transactions,
  visible,
}: {
  transactions: TransactionRow[]
  visible: ColumnDef[]
}) {
  return (
    <TableBody>
      {transactions.map((t) => (
        <TableRow key={t.id} className="cursor-pointer hover:bg-muted/30">
          {visible.map((col) => (
            <TransactionTableCell key={col.key} row={t} col={col} />
          ))}
        </TableRow>
      ))}
    </TableBody>
  )
}

export function TransactionTable({
  data,
  sourceFields,
  enrichmentFields,
  onSort,
  sortField,
  sortOrder,
  loading,
  sentinelRef,
}: TransactionTableProps) {
  const columns = useTableColumns(sourceFields, enrichmentFields)
  const initialVisible = useMemo(
    () => new Set(columns.filter((c) => c.defaultVisible).map((c) => c.key)),
    [columns]
  )
  const columnMeta = useMemo(
    () => columns.map((c) => ({ key: c.key, minWidth: c.minWidth, priority: c.priority })),
    [columns]
  )
  const {
    containerRef,
    visibleColumns,
    toggleColumn,
    resetColumns,
    hasUserOverride,
  } = useResponsiveColumns(columnMeta, initialVisible, ["actions", "statut"])

  const visible = useMemo(() => columns.filter((c) => visibleColumns.has(c.key)), [columns, visibleColumns])

  return (
    <Card className="flex flex-col min-w-0" ref={containerRef}>
      <div className="flex items-center justify-between border-b px-4 py-1">
        <span className="text-sm font-semibold text-foreground">
          Résultats
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({data.total} transaction{data.total > 1 ? "s" : ""})
          </span>
        </span>
        <ColumnMenu
          columns={columns}
          visibleColumns={visibleColumns}
          toggleColumn={toggleColumn}
          hasUserOverride={hasUserOverride}
          resetColumns={resetColumns}
        />
      </div>
      <CardContent className="p-0">
        <Table>
          <TransactionTableHeader
            visible={visible}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
          />
          <TransactionTableBody transactions={data.transactions} visible={visible} />
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
