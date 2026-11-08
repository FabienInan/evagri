"use client"

import { useMemo, useState } from "react"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/dossier/modal"
import {
  buildExportColumns,
  buildExportFileName,
  buildExportTable,
  EXPORT_NATURE_LABELS,
  type ExportColumnNature,
} from "@/lib/excel-export"
import type { ImportedField } from "@/lib/imported-fields"
import { computeIndicateursAjustesByTransaction } from "@/lib/analyse-dossier"
import type { ChampEnrichissableConfig } from "@/types/champ"
import type { SerializedTransaction } from "@/types/transaction"

const NATURE_ORDER: ExportColumnNature[] = ["importe", "saisissable", "calcule", "ajuste"]

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

/**
 * Export Excel d'un panier (§7.9). Les indicateurs ajustés se calculent à l'export, à partir de la date d'évaluation
 * du dossier et du taux de croissance du panier, fixés à leur création. Le classeur est généré côté client.
 */
export function PanierExcelExport({
  transactions,
  nom,
  importedFields,
  champs,
  dateEvaluation,
  tauxCroissancePct,
}: {
  transactions: SerializedTransaction[]
  nom: string
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
  dateEvaluation: string | null
  tauxCroissancePct: number | null
}) {
  const columns = useMemo(() => buildExportColumns(importedFields, champs), [importedFields, champs])
  const indicateursDisponibles = dateEvaluation !== null && tauxCroissancePct !== null
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        columns
          .filter((column) => column.defaultVisible && (column.nature !== "ajuste" || indicateursDisponibles))
          .map((column) => column.key)
      )
  )
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    setError(null)
    setOpen(true)
  }

  function toggleColumn(key: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function handleExport() {
    if (selected.size === 0) {
      setError("Sélectionnez au moins une colonne.")
      return
    }
    const hasAdjustedColumn = columns.some((column) => column.nature === "ajuste" && selected.has(column.key))
    if (hasAdjustedColumn && !indicateursDisponibles) {
      setError("Les indicateurs ajustés demandent la date d'évaluation du dossier et le taux de croissance du panier.")
      return
    }

    setExporting(true)
    setError(null)
    try {
      const adjustedByTransaction =
        hasAdjustedColumn && dateEvaluation !== null && tauxCroissancePct !== null
          ? computeIndicateursAjustesByTransaction({ dateEvaluation, tauxCroissancePct }, transactions)
          : {}

      const table = buildExportTable({
        transactions,
        importedFields,
        champs,
        adjustedByTransaction,
        selectedKeys: selected,
      })
      // Chargé à la demande : la génération du classeur ne pèse pas sur le chargement initial du panier.
      const XLSX = await import("xlsx")
      const worksheet = XLSX.utils.aoa_to_sheet([table.header, ...table.rows])
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, "Export")
      XLSX.writeFile(workbook, buildExportFileName(nom))
      setOpen(false)
    } catch {
      setError("Impossible de générer le fichier Excel.")
    } finally {
      setExporting(false)
    }
  }

  const groups = NATURE_ORDER.map((nature) => ({
    nature,
    columns: columns.filter((column) => column.nature === nature),
  })).filter((group) => group.columns.length > 0)

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-xs"
        onClick={openModal}
        disabled={transactions.length === 0}
        title={transactions.length === 0 ? "Aucune transaction dans ce panier" : undefined}
      >
        <FileSpreadsheet className="h-4 w-4" />
        Exporter Excel
      </Button>

      {open && (
        <Modal
          title="Exporter en Excel"
          onClose={() => setOpen(false)}
          className="max-h-[90vh] max-w-2xl overflow-y-auto"
        >
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="text-muted-foreground">
                Date d&apos;évaluation :{" "}
                <span className="font-medium text-foreground">
                  {dateEvaluation ? formatDate(dateEvaluation) : "non renseignée"}
                </span>
              </p>
              <p className="text-muted-foreground">
                Taux de croissance :{" "}
                <span className="font-medium text-foreground">
                  {tauxCroissancePct !== null ? `${tauxCroissancePct} %` : "non renseigné"}
                </span>
              </p>
              {!indicateursDisponibles && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Ces deux valeurs sont fixées à la création du dossier et du panier : sans elles, les indicateurs ajustés
                  ne sont pas calculés.
                </p>
              )}
            </div>

            <fieldset className="space-y-3">
              <legend className="text-xs font-semibold text-muted-foreground">Colonnes à inclure</legend>
              {groups.map((group) => (
                <div key={group.nature} className="space-y-1">
                  <p className="text-xs font-medium text-foreground">{EXPORT_NATURE_LABELS[group.nature]}</p>
                  <div className="grid gap-1 sm:grid-cols-2">
                    {group.columns.map((column) => (
                      <label
                        key={column.key}
                        className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted"
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(column.key)}
                          onChange={() => toggleColumn(column.key)}
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </fieldset>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={exporting}>
                Annuler
              </Button>
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Exporter
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
