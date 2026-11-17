"use client"

import { useState } from "react"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PANIER_TEMPLATE_PATH, buildExportFileName, buildPanierWorkbook } from "@/lib/panier-export-workbook"
import type { SerializedTransaction } from "@/types/transaction"

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
 * Export Excel du panier au format du modèle « Modèle export panier » : un onglet, une ligne par transaction.
 * Les indicateurs ajustés se calculent à partir de la date d'évaluation du dossier et du taux du panier.
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
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleExport() {
    setError(null)
    if (dateEvaluation === null || tauxCroissancePct === null) {
      setError("Les indicateurs ajustés demandent la date d'évaluation du dossier et le taux de croissance du panier.")
      return
    }
    setExporting(true)
    try {
      const template = await loadTemplate()
      const bytes = await buildPanierWorkbook(template, transactions, { dateEvaluation, tauxCroissancePct })
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = buildExportFileName(nom)
      link.click()
      URL.revokeObjectURL(url)
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
        onClick={handleExport}
        disabled={transactions.length === 0 || exporting}
        title={transactions.length === 0 ? "Aucune transaction dans ce panier" : undefined}
      >
        {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
        Exporter Excel
      </Button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </>
  )
}
