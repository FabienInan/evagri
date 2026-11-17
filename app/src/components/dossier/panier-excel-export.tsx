"use client"

import { useState } from "react"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/modal"
import {
  EXPORT_COLUMN_OPTIONS,
  PANIER_TEMPLATE_PATH,
  buildExportFileName,
  buildPanierWorkbook,
} from "@/lib/panier-export-workbook"
import type { SerializedTransaction } from "@/types/transaction"
import { formatDateIsoFr } from "@/lib/format"

/** Modèle du classeur, lu une seule fois par session. */
let templatePromise: Promise<Uint8Array> | null = null
function loadTemplate(): Promise<Uint8Array> {
  templatePromise ??= fetch(PANIER_TEMPLATE_PATH)
    .then((res) => {
      if (!res.ok) throw new Error(`Modèle introuvable (${res.status}).`)
      return res.arrayBuffer()
    })
    .then((buffer) => new Uint8Array(buffer))
  return templatePromise
}

/**
 * Export Excel du panier au format du modèle : une ligne par transaction. L'utilisateur choisit les colonnes ;
 * toutes sont cochées par défaut. Les indicateurs ajustés se calculent à partir de la date d'évaluation du dossier
 * et du taux du panier.
 */
export function PanierExcelExport({
  transactions,
  nom,
  dateEvaluation,
  tauxCroissancePct,
}: {
  transactions: SerializedTransaction[]
  nom: string
  dateEvaluation: string | null
  tauxCroissancePct: number | null
}) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(() => new Set(EXPORT_COLUMN_OPTIONS.map((c) => c.letter)))
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function toggle(letter: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(letter)) next.delete(letter)
      else next.add(letter)
      return next
    })
  }

  async function handleExport() {
    setError(null)
    if (selected.size === 0) {
      setError("Sélectionnez au moins une colonne.")
      return
    }
    if (dateEvaluation === null || tauxCroissancePct === null) {
      setError("Les indicateurs ajustés demandent la date d'évaluation du dossier et le taux de croissance du panier.")
      return
    }
    setExporting(true)
    try {
      const template = await loadTemplate()
      const order = EXPORT_COLUMN_OPTIONS.map((c) => c.letter).filter((letter) => selected.has(letter))
      const bytes = await buildPanierWorkbook(template, transactions, { dateEvaluation, tauxCroissancePct }, order)
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = buildExportFileName(nom)
      link.click()
      URL.revokeObjectURL(url)
      setOpen(false)
    } catch {
      setError("Impossible de générer le fichier Excel.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-8 gap-2 text-xs"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
        disabled={transactions.length === 0}
        title={transactions.length === 0 ? "Aucune transaction dans ce panier" : undefined}
      >
        <FileSpreadsheet className="h-4 w-4" />
        Exporter Excel
      </Button>

      {open && (
        <Modal title="Exporter en Excel" onClose={() => setOpen(false)} className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <div className="space-y-4">
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              <p className="text-muted-foreground">
                Date d&apos;évaluation :{" "}
                <span className="font-medium text-foreground">
                  {dateEvaluation ? formatDateIsoFr(dateEvaluation) : "non renseignée"}
                </span>
              </p>
              <p className="text-muted-foreground">
                Taux de croissance :{" "}
                <span className="font-medium text-foreground">
                  {tauxCroissancePct !== null ? `${tauxCroissancePct} %` : "non renseigné"}
                </span>
              </p>
            </div>

            <fieldset className="space-y-1">
              <legend className="text-xs font-semibold text-muted-foreground">Colonnes à inclure</legend>
              <div className="grid gap-1 sm:grid-cols-2">
                {EXPORT_COLUMN_OPTIONS.map((column) => (
                  <label key={column.letter} className="flex items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <input type="checkbox" checked={selected.has(column.letter)} onChange={() => toggle(column.letter)} />
                    {column.header}
                  </label>
                ))}
              </div>
            </fieldset>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={exporting}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleExport} disabled={exporting}>
                {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Exporter
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
