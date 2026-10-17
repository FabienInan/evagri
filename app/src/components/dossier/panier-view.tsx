"use client"

import { useMemo, useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { removeTransactionFromPanier } from "@/server/actions/dossier"
import { renderFieldValue } from "@/components/transaction-table"
import { sortTransactionRows } from "@/lib/panier"
import { isImportedFieldCode, type ImportedField } from "@/lib/imported-fields"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"
import type { ChampEnrichissableConfig } from "@/types/champ"

function usePanierColumns(
  importedFields: ImportedField[],
  champs: ChampEnrichissableConfig[],
  onRemove: (row: SerializedTransaction) => void
): DataTableColumn<SerializedTransaction>[] {
  return useMemo(() => {
    const importedCols: DataTableColumn<SerializedTransaction>[] = importedFields.map((field) => ({
      key: field.code,
      label: field.label,
      numeric: field.numeric,
      sortable: field.display.sortable,
      defaultVisible: field.display.defaultVisible,
      minWidth: field.display.minWidth,
      render: (row) => renderFieldValue(row.fields[field.code], field.typeDonnees),
    }))

    // Indicateurs (CALCULE) visibles par défaut ; champs SAISISSABLE non importés masqués par défaut (décision 7).
    const champCols: DataTableColumn<SerializedTransaction>[] = champs
      .filter((champ) => champ.actif && !isImportedFieldCode(champ.codeMachine))
      .map((champ) => ({
        key: champ.codeMachine,
        label: champ.nomAffichage,
        numeric: champ.typeDonnees === "DECIMAL" || champ.typeDonnees === "ENTIER",
        defaultVisible: champ.nature === "CALCULE",
        minWidth: 130,
        priority: champ.nature === "CALCULE" ? 3 : 1,
        render: (row) => renderFieldValue(row.fields[champ.codeMachine], champ.typeDonnees),
      }))

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

    return [...importedCols, ...champCols, actionCol]
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
      emptyMessage="Aucune transaction dans ce panier"
    />
  )
}
