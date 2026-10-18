"use client"

import { useMemo, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { removeTransactionFromPanier } from "@/server/actions/dossier"
import { sortTransactionRows } from "@/lib/transaction-sort"
import { buildTransactionFieldColumns } from "@/lib/transaction-columns"
import { PanierExcelExport } from "@/components/dossier/panier-excel-export"
import type { ImportedField } from "@/lib/imported-fields"
import type { SerializedTransaction } from "@/types/transaction"
import type { ChampEnrichissableConfig } from "@/types/champ"

// Leaflet touche `window` : la carte d'export est rendue côté client uniquement, comme la carte générale.
const PanierMapExport = dynamic(
  () => import("@/components/dossier/panier-map-export").then((m) => m.PanierMapExport),
  { ssr: false }
)

function usePanierColumns(
  importedFields: ImportedField[],
  champs: ChampEnrichissableConfig[],
  onRemove: (row: SerializedTransaction) => void
): DataTableColumn<SerializedTransaction>[] {
  return useMemo(() => {
    // Mêmes colonnes et visibilité par défaut que la liste des transactions : seuls les champs importés
    // apparaissent ; les champs enrichissables sont masqués par défaut et réactivables via « Colonnes ».
    const fieldCols = buildTransactionFieldColumns({ importedFields, champs })

    const actionCol: DataTableColumn<SerializedTransaction> = {
      key: "retirer",
      label: "",
      defaultVisible: true,
      minWidth: 60,
      locked: true,
      render: (row) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Retirer du panier"
            onClick={() => onRemove(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }

    return [...fieldCols, actionCol]
  }, [importedFields, champs, onRemove])
}

export function PanierView({
  panierId,
  nom,
  transactions,
  importedFields,
  champs,
}: {
  panierId: string
  nom: string
  transactions: SerializedTransaction[]
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
}) {
  const [rows, setRows] = useState(transactions)
  const [sortField, setSortField] = useState("date_vente")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [, startTransition] = useTransition()

  function handleRemove(row: SerializedTransaction) {
    // Optimiste : on retire la ligne tout de suite, le serveur confirme ensuite.
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    startTransition(async () => {
      const res = await removeTransactionFromPanier(panierId, row.id)
      // Échec côté serveur ({ ok: false }) : on réinsère la ligne pour ne pas mentir à l'utilisateur.
      if (!res.ok) {
        setRows((prev) => (prev.some((r) => r.id === row.id) ? prev : [...prev, row]))
      }
    })
  }

  const columns = usePanierColumns(importedFields, champs, handleRemove)
  const sorted = useMemo(
    () => sortTransactionRows(rows, sortField, sortOrder),
    [rows, sortField, sortOrder]
  )

  return (
    <DataTable
      storageKey={`panier-table:${panierId}`}
      columns={columns}
      rows={sorted}
      rowKey={(row) => row.id}
      sortField={sortField}
      sortOrder={sortOrder}
      onSort={(field) => {
        if (field === sortField) setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
        else {
          setSortField(field)
          setSortOrder("asc")
        }
      }}
      reorderable={false}
      title={nom}
      totalCount={rows.length}
      toolbar={
        <>
          <PanierExcelExport
            transactions={rows}
            nom={nom}
            importedFields={importedFields}
            champs={champs}
          />
          <PanierMapExport transactions={rows} nom={nom} />
        </>
      }
      emptyMessage="Aucune transaction dans ce panier"
    />
  )
}
