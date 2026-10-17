"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { AddToPanierDialog } from "@/components/dossier/add-to-panier-dialog"
import type { SerializedTransaction, SerializedValue } from "@/serializers/transaction.serializer"
import { isImportedFieldCode, type ImportedField } from "@/lib/imported-fields"
import type { ChampEnrichissableConfig, TypeDonneesChamp } from "@/types/champ"

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

export function formatValue(value: SerializedValue | undefined): string {
  if (value === null || value === undefined) return "—"
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—"
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return formatNumber(value)
  return String(value)
}

/** Renders a stored flat value according to its champ's data type (dates locale-formatted, arrays joined). */
export function renderFieldValue(value: SerializedValue | undefined, typeDonnees: TypeDonneesChamp): string {
  if (typeDonnees === "DATE" && typeof value === "string" && value !== "") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-CA")
  }
  return formatValue(value)
}

/** Le taux global combine deux valeurs numériques de la carte plate `fields`. */
function computeTauxGlobal(row: TransactionRow): number | null {
  const prix = row.fields.prix_vente
  const superficie = row.fields.superficie_totale_hectare
  if (typeof prix !== "number" || typeof superficie !== "number" || superficie === 0) return null
  return prix / superficie
}

function StatusBadge({ statut }: { statut: string }) {
  return statut === "ANALYSEE" ? (
    <Badge variant="default">Analysée</Badge>
  ) : (
    <Badge variant="warning">Non analysée</Badge>
  )
}

function Actions({ id, statut, onAddToPanier }: { id: string; statut: string; onAddToPanier: () => void }) {
  const router = useRouter()
  const isAnalysee = statut === "ANALYSEE"

  return (
    // stopPropagation: keeps action clicks from toggling the row selection
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {isAnalysee ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Voir"
            onClick={() => router.push(`/transactions/${id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Ajouter au panier"
            onClick={onAddToPanier}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Analyser"
          onClick={() => router.push(`/transactions/${id}`)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

function isNumericType(typeDonnees: string): boolean {
  return typeDonnees === "DECIMAL" || typeDonnees === "ENTIER"
}

/** Colonnes construites depuis le catalogue `IMPORTED_FIELDS` (clé = codeMachine) puis les champs `Champ`
 *  non importés : les deux lisent la même carte plate `row.fields`. */
function useTableColumns(
  importedFields: ImportedField[],
  champs: ChampEnrichissableConfig[],
  onAddToPanier: (id: string) => void
): DataTableColumn<TransactionRow>[] {
  return useMemo(() => {
    const importedCols: DataTableColumn<TransactionRow>[] = importedFields.map((field) => ({
      key: field.code,
      label: field.label,
      numeric: field.numeric,
      sortable: field.display.sortable,
      defaultVisible: field.display.defaultVisible,
      minWidth: field.display.minWidth,
      priority: field.display.priority,
      render: (row) => renderFieldValue(row.fields[field.code], field.typeDonnees),
    }))

    const champCols: DataTableColumn<TransactionRow>[] = champs
      .filter((champ) => champ.actif && !isImportedFieldCode(champ.codeMachine))
      .map((champ) => ({
        key: champ.codeMachine,
        label: champ.nomAffichage,
        numeric: isNumericType(champ.typeDonnees),
        defaultVisible: false,
        minWidth: 130,
        priority: 1,
        render: (row) => renderFieldValue(row.fields[champ.codeMachine], champ.typeDonnees),
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
        render: (row) => <StatusBadge statut={row.statut} />,
      },
      {
        key: "actions",
        label: "Actions",
        defaultVisible: true,
        minWidth: 80,
        priority: 10,
        locked: true,
        render: (row) => <Actions id={row.id} statut={row.statut} onAddToPanier={() => onAddToPanier(row.id)} />,
      },
    ]

    return [...importedCols, ...champCols, ...computedCols]
  }, [importedFields, champs, onAddToPanier])
}

interface TransactionTableProps {
  data: TableData
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
  onSort: (field: string) => void
  sortField: string
  sortOrder: "asc" | "desc"
  hasMore: boolean
  loading: boolean
  sentinelRef: React.RefObject<HTMLDivElement | null>
  selectedIds?: Set<string>
  onSelectRow?: (row: TransactionRow) => void
  fillHeight?: boolean
}

export function TransactionTable({
  data,
  importedFields,
  champs,
  onSort,
  sortField,
  sortOrder,
  loading,
  sentinelRef,
  selectedIds,
  onSelectRow,
  fillHeight,
}: TransactionTableProps) {
  const [addToPanierIds, setAddToPanierIds] = useState<string[] | null>(null)
  const columns = useTableColumns(importedFields, champs, (id) => setAddToPanierIds([id]))

  return (
    <>
      <DataTable
        storageKey="transaction-table:v2"
        columns={columns}
        rows={data.transactions}
        rowKey={(row, index) => `${row.id}-${index}`}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        loading={loading}
        sentinelRef={sentinelRef}
        fillHeight={fillHeight}
        title="Résultats"
        totalCount={data.total}
        onRowClick={onSelectRow}
        isRowSelected={selectedIds ? (row) => selectedIds.has(row.id) : undefined}
      />
      <AddToPanierDialog
        transactionIds={addToPanierIds ?? []}
        open={addToPanierIds !== null}
        onOpenChange={(open) => {
          if (!open) setAddToPanierIds(null)
        }}
      />
    </>
  )
}
