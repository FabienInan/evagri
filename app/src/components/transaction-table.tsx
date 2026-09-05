"use client"

import { useMemo } from "react"
import { Eye, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import type { SerializedTransaction, EnrichmentValues } from "@/serializers/transaction.serializer"
import type { TransactionSourceField } from "@/lib/transaction-source-fields"
import type { EnrichmentField } from "@/repositories/enrichment.repository"

export type TransactionRow = SerializedTransaction

type TableData = {
  transactions: TransactionRow[]
  total: number
}

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
  const value = statut ?? "A analyser"
  switch (value) {
    case "Analysée":
      return <Badge variant="default">Analysée</Badge>
    case "A analyser":
      return <Badge variant="warning">A analyser</Badge>
    default:
      return <Badge variant="secondary">{value}</Badge>
  }
}

function Actions({ statut }: { statut: string | null | undefined }) {
  const value = statut ?? "A analyser"
  const isAnalysee = value === "Analysée"

  return (
    <div className="flex items-center justify-end gap-1">
      {isAnalysee ? (
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

function isNumericEnrichment(typeDonnees: string): boolean {
  return typeDonnees === "DECIMAL" || typeDonnees === "ENTIER" || typeDonnees === "POURCENTAGE"
}

function defaultCellValue(row: TransactionRow, key: string) {
  if (key === "numeroInscription") return row.numeroInscription ?? row.enrichment["sia"] ?? "—"
  if (key === "dateVente") return row.dateVente ? new Date(row.dateVente).toLocaleDateString("fr-CA") : "—"
  if (key === "lotsCadastraux") return row.lotsCadastraux?.join(", ") ?? "—"
  return formatValue(row[key as keyof TransactionRow] as string | number | boolean | null)
}

function useTableColumns(
  sourceFields: TransactionSourceField[],
  enrichmentFields: EnrichmentField[]
): DataTableColumn<TransactionRow>[] {
  return useMemo(() => {
    const sourceKeys = new Set(sourceFields.map((field) => field.key))
    const seen = new Set<string>(sourceKeys)

    const sourceCols: DataTableColumn<TransactionRow>[] = sourceFields.map((field) => ({
      key: field.key,
      label: field.label,
      numeric: field.numeric,
      sortable: field.sortable,
      defaultVisible: field.defaultVisible,
      minWidth: field.minWidth,
      priority: field.priority,
      render: (row) => defaultCellValue(row, field.key),
    }))

    const enrichmentCols: DataTableColumn<TransactionRow>[] = enrichmentFields
      .filter((field) => !sourceKeys.has(field.codeMachine))
      .filter((field) => {
        if (seen.has(field.codeMachine)) {
          if (process.env.NODE_ENV === "development") {
            console.warn(`[TransactionTable] Duplicate column key ignored: ${field.codeMachine}`)
          }
          return false
        }
        seen.add(field.codeMachine)
        return true
      })
      .map((field) => ({
        key: field.codeMachine,
        label: field.nomAffichage,
        numeric: isNumericEnrichment(field.typeDonnees),
        defaultVisible: false,
        minWidth: 130,
        priority: 1,
        render: (row) => formatValue((row.enrichment as EnrichmentValues)[field.codeMachine]),
      }))

    const computedCols: DataTableColumn<TransactionRow>[] = [
      {
        key: "tauxGlobal",
        label: "Taux global ($/ha)",
        numeric: true,
        defaultVisible: true,
        minWidth: 150,
        priority: 6,
        render: (row) => formatCurrency(computeTauxGlobal(row)),
      },
      {
        key: "statut",
        label: "Statut",
        defaultVisible: true,
        minWidth: 110,
        priority: 3,
        locked: true,
        render: (row) => <StatusBadge statut={row.enrichie?.statut} />,
      },
      {
        key: "actions",
        label: "Actions",
        defaultVisible: true,
        minWidth: 80,
        priority: 10,
        locked: true,
        render: (row) => <Actions statut={row.enrichie?.statut} />,
      },
    ]

    return [...sourceCols, ...enrichmentCols, ...computedCols]
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
  selectedIds?: Set<string>
  onSelectRow?: (row: TransactionRow) => void
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
  selectedIds,
  onSelectRow,
}: TransactionTableProps) {
  const columns = useTableColumns(sourceFields, enrichmentFields)

  return (
    <DataTable
      storageKey="transaction-table"
      columns={columns}
      rows={data.transactions}
      rowKey={(row, index) => `${row.id}-${index}`}
      sortField={sortField}
      sortOrder={sortOrder}
      onSort={onSort}
      loading={loading}
      sentinelRef={sentinelRef}
      title="Résultats"
      totalCount={data.total}
      onRowClick={onSelectRow}
      isRowSelected={selectedIds ? (row) => selectedIds.has(row.id) : undefined}
    />
  )
}

