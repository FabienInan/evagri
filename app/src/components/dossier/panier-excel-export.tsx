"use client"

import { useMemo, useState } from "react"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import {
  buildExportColumns,
  buildExportFileName,
  buildExportTable,
  EXPORT_NATURE_LABELS,
  type ExportColumnNature,
} from "@/lib/excel-export"
import type { ImportedField } from "@/lib/imported-fields"
import { getIndicateursAjustesForExport } from "@/server/actions/analyse-dossier"
import type { SerializedAnalyse } from "@/serializers/analyse-dossier.serializer"
import type { ChampEnrichissableConfig } from "@/types/champ"
import type { SerializedTransaction } from "@/types/transaction"

const NATURE_ORDER: ExportColumnNature[] = ["importe", "saisissable", "calcule", "ajuste"]

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-")
  return `${day}/${month}/${year}`
}

/**
 * Export Excel d'un panier (§7.9) : l'évaluateur choisit une Analyse de Dossier stockée, qui fournit les
 * indicateurs ajustés, puis les colonnes à inclure. Le classeur est généré côté client.
 */
export function PanierExcelExport({
  transactions,
  nom,
  importedFields,
  champs,
  analyses,
}: {
  transactions: SerializedTransaction[]
  nom: string
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
  analyses: SerializedAnalyse[]
}) {
  const columns = useMemo(() => buildExportColumns(importedFields, champs), [importedFields, champs])
  const [open, setOpen] = useState(false)
  const [analyseId, setAnalyseId] = useState("")
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        columns
          .filter((column) => column.defaultVisible && (column.nature !== "ajuste" || analyses.length > 0))
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
    if (hasAdjustedColumn && !analyseId) {
      setError("Choisissez une analyse de dossier pour inclure les indicateurs ajustés.")
      return
    }

    setExporting(true)
    setError(null)
    try {
      let adjustedByTransaction: Record<string, Record<string, number | null>> = {}
      if (analyseId) {
        const res = await getIndicateursAjustesForExport(
          analyseId,
          transactions.map((transaction) => transaction.id)
        )
        if (!res.ok) {
          setError(res.error)
          return
        }
        adjustedByTransaction = res.values
      }

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
            <div className="space-y-1.5">
              <Label htmlFor="export-analyse">Analyse de dossier</Label>
              <select
                id="export-analyse"
                className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
                value={analyseId}
                onChange={(e) => setAnalyseId(e.target.value)}
                disabled={analyses.length === 0}
              >
                <option value="">— Aucune —</option>
                {analyses.map((analyse) => (
                  <option key={analyse.id} value={analyse.id}>
                    Évaluation du {formatDate(analyse.dateEvaluation)} (croissance {analyse.tauxCroissancePct} %)
                  </option>
                ))}
              </select>
              {analyses.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Aucune analyse pour ce dossier. Créez-en une depuis la page du dossier pour exporter les indicateurs
                  ajustés.
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
              <Button variant="ghost" onClick={() => setOpen(false)} disabled={exporting}>
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
