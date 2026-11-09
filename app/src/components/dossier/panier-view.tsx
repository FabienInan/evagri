"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Eye, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { removeTransactionFromPanier } from "@/server/actions/dossier"
import { sortTransactionRows } from "@/lib/transaction-sort"
import { buildPanierDetailQuery } from "@/lib/transaction-filters"
import { buildTransactionFieldColumns } from "@/lib/transaction-columns"
import { formatCellValue } from "@/lib/format"
import { computeIndicateursAjustesByTransaction } from "@/lib/analyse-dossier"
import {
  collectFieldCodes,
  panierColumnsForType,
  resolvePanierFieldCode,
} from "@/lib/panier-columns"
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

// Leaflet touche `window` : la carte d'export est rendue côté client uniquement, comme la carte générale.
const PanierMapExport = dynamic(
  () => import("@/components/dossier/panier-map-export").then((m) => m.PanierMapExport),
  { ssr: false }
)

function usePanierColumns(
  importedFields: ImportedField[],
  champs: ChampEnrichissableConfig[],
  typeCode: string | null,
  candidates: readonly string[],
  adjustedById: Record<string, Record<string, number | null>>,
  onView: (row: SerializedTransaction) => void,
  onRemove: (row: SerializedTransaction) => void
): DataTableColumn<SerializedTransaction>[] {
  return useMemo(() => {
    // Un panier typé affiche exactement les colonnes prévues pour son type ; sans type, on garde les colonnes
    // de la liste des transactions (champs importés visibles, enrichissables masquées par défaut).
    const spec = panierColumnsForType(typeCode)
    const fieldCols: DataTableColumn<SerializedTransaction>[] = spec
      ? spec.map((column) => {
          if (column.kind === "ajuste") {
            return {
              key: column.key,
              label: column.label,
              numeric: true,
              sortable: false,
              defaultVisible: true,
              minWidth: 130,
              priority: 1,
              render: (row) => formatCellValue(adjustedById[row.id]?.[column.key] ?? null, column.typeDonnees),
            }
          }
          const code = resolvePanierFieldCode(column.key, candidates) ?? column.key
          return {
            key: code,
            label: column.label,
            numeric: column.typeDonnees === "DECIMAL" || column.typeDonnees === "ENTIER",
            sortable: true,
            defaultVisible: true,
            minWidth: 130,
            priority: 1,
            render: (row) => formatCellValue(row.fields[code], column.typeDonnees),
          }
        })
      : buildTransactionFieldColumns({ importedFields, champs })

    const actionCol: DataTableColumn<SerializedTransaction> = {
      key: "retirer",
      label: "",
      defaultVisible: true,
      minWidth: 88,
      locked: true,
      immovable: true,
      fixedWidth: 88,
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
  }, [importedFields, champs, typeCode, candidates, adjustedById, onView, onRemove])
}

export function PanierView({
  panierId,
  nom,
  transactions,
  importedFields,
  champs,
  dateEvaluation,
  tauxCroissancePct,
  typeTransactionNom,
  typeTransactionCode,
}: {
  panierId: string
  nom: string
  transactions: SerializedTransaction[]
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
  /** Date d'évaluation du dossier (AAAA-MM-JJ), pour les indicateurs ajustés à l'export. */
  dateEvaluation: string | null
  /** Taux de croissance du panier en pourcentage, pour les indicateurs ajustés à l'export. */
  tauxCroissancePct: number | null
  /** Type de transaction du panier, affiché à côté de son nom. */
  typeTransactionNom: string | null
  /** Code du type (`Typologie.code`), qui choisit les colonnes affichées. */
  typeTransactionCode: string | null
}) {
  const [rows, setRows] = useState(transactions)
  // Préférences de colonnes propres au type : un changement de configuration par type ne reprend pas l'ancien
  // réglage enregistré dans le navigateur pour ce panier.
  const tableStorageKey = `panier-table:${panierId}:${typeTransactionCode ?? "defaut"}`
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

  // Indicateurs ajustés affichés dans la liste : mêmes calculs que l'export, à partir du dossier et du panier.
  const adjustedById = useMemo(
    () =>
      dateEvaluation !== null && tauxCroissancePct !== null
        ? computeIndicateursAjustesByTransaction({ dateEvaluation, tauxCroissancePct }, rows)
        : {},
    [rows, dateEvaluation, tauxCroissancePct]
  )
  const candidates = useMemo(
    () => collectFieldCodes(champs, importedFields.map((field) => field.code), rows),
    [champs, importedFields, rows]
  )

  const columns = usePanierColumns(
    importedFields,
    champs,
    typeTransactionCode,
    candidates,
    adjustedById,
    handleView,
    handleRemove
  )
  const sorted = useMemo(
    () => sortTransactionRows(rows, sortField, sortOrder),
    [rows, sortField, sortOrder]
  )

  return (
    <DataTable
      storageKey={tableStorageKey}
      columns={columns}
      rows={sorted}
      rowKey={(row) => row.id}
      sortField={sortField}
      sortOrder={sortOrder}
      onSort={handleSort}
      columnMenuAlphabetical
      columnMenuSearchable
      title={
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate">{nom}</span>
          {typeTransactionNom && (
            <Badge variant="secondary" className="shrink-0">
              {typeTransactionNom}
            </Badge>
          )}
        </span>
      }
      totalCount={rows.length}
      toolbar={
        <>
          <PanierExcelExport
            transactions={rows}
            nom={nom}
            importedFields={importedFields}
            champs={champs}
            dateEvaluation={dateEvaluation}
            tauxCroissancePct={tauxCroissancePct}
            typeTransactionCode={typeTransactionCode}
          />
          <PanierMapExport transactions={rows} nom={nom} />
        </>
      }
      emptyMessage="Aucune transaction dans ce panier"
    />
  )
}
