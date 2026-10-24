"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Eye, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { removeTransactionFromPanier } from "@/server/actions/dossier"
import { sortTransactionRows } from "@/lib/transaction-sort"
import { buildPanierDetailQuery } from "@/lib/transaction-filters"
import { buildTransactionFieldColumns } from "@/lib/transaction-columns"
import {
  DEFAULT_PANIER_SORT,
  loadPanierSort,
  panierSortStorageKey,
  savePanierSort,
} from "@/lib/panier-sort-preference"
import { PanierExcelExport } from "@/components/dossier/panier-excel-export"
import type { ImportedField } from "@/lib/imported-fields"
import type { SerializedTransaction } from "@/types/transaction"
import type { ChampEnrichissableConfig } from "@/types/champ"
import type { SerializedAnalyse } from "@/serializers/analyse-dossier.serializer"

// Leaflet touche `window` : la carte d'export est rendue côté client uniquement, comme la carte générale.
const PanierMapExport = dynamic(
  () => import("@/components/dossier/panier-map-export").then((m) => m.PanierMapExport),
  { ssr: false }
)

function usePanierColumns(
  importedFields: ImportedField[],
  champs: ChampEnrichissableConfig[],
  onView: (row: SerializedTransaction) => void,
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
      minWidth: 88,
      locked: true,
      render: (row) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            title="Voir la transaction"
            onClick={() => onView(row)}
          >
            <Eye className="h-4 w-4" />
          </Button>
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
  }, [importedFields, champs, onView, onRemove])
}

export function PanierView({
  panierId,
  nom,
  transactions,
  importedFields,
  champs,
  analyses,
}: {
  panierId: string
  nom: string
  transactions: SerializedTransaction[]
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
  analyses: SerializedAnalyse[]
}) {
  const [rows, setRows] = useState(transactions)
  const sortStorageKey = panierSortStorageKey(panierId)
  const [sortField, setSortField] = useState(DEFAULT_PANIER_SORT.field)
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(DEFAULT_PANIER_SORT.order)
  const [, startTransition] = useTransition()
  const router = useRouter()

  // Lecture après montage : le rendu serveur et l'hydratation restent identiques.
  useEffect(() => {
    const saved = loadPanierSort(sortStorageKey)
    if (saved) {
      setSortField(saved.field)
      setSortOrder(saved.order)
    }
  }, [sortStorageKey])

  function handleSort(field: string) {
    const nextOrder = field === sortField && sortOrder === "asc" ? "desc" : "asc"
    setSortField(field)
    setSortOrder(nextOrder)
    savePanierSort(sortStorageKey, { field, order: nextOrder })
  }

  // Contexte transmis à la fiche : la navigation Précédent/Suivant s'y limite aux transactions
  // déjà dans ce panier, dans le même ordre que la liste affichée ici.
  const detailQuery = useMemo(
    () => buildPanierDetailQuery({ panierId, sortField, sortOrder }),
    [panierId, sortField, sortOrder]
  )

  function handleView(row: SerializedTransaction) {
    router.push(`/transactions/${row.id}${detailQuery}`)
  }

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

  const columns = usePanierColumns(importedFields, champs, handleView, handleRemove)
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
      onSort={handleSort}
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
            analyses={analyses}
          />
          <PanierMapExport transactions={rows} nom={nom} />
        </>
      }
      emptyMessage="Aucune transaction dans ce panier"
    />
  )
}
