"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Eye, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { AddToPanierDialog } from "@/components/dossier/add-to-panier-dialog"
import type { SerializedTransaction } from "@/types/transaction"
import type { ImportedField } from "@/lib/imported-fields"
import type { ChampEnrichissableConfig } from "@/types/champ"
import { formatCurrency } from "@/lib/format"
import { buildTransactionFieldColumns } from "@/lib/transaction-columns"

export type TransactionRow = SerializedTransaction

type TableData = {
  transactions: TransactionRow[]
  total: number
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

/** Colonnes de champs partagées avec le panier, puis les colonnes calculées propres à la liste. */
function useTableColumns(
  importedFields: ImportedField[],
  champs: ChampEnrichissableConfig[],
  onAddToPanier: (id: string) => void
): DataTableColumn<TransactionRow>[] {
  return useMemo(() => {
    const fieldCols = buildTransactionFieldColumns({ importedFields, champs })

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

    return [...fieldCols, ...computedCols]
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
