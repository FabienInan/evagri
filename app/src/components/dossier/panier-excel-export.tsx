"use client"

import { useMemo, useState } from "react"
import { FileSpreadsheet, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import {
  buildExportColumns,
  buildExportFileName,
  buildExportTable,
  EXPORT_NATURE_LABELS,
  type ExportAnalysisParams,
  type ExportColumnNature,
} from "@/lib/excel-export"
import type { ImportedField } from "@/lib/imported-fields"
import type { ChampEnrichissableConfig } from "@/types/champ"
import type { SerializedTransaction } from "@/types/transaction"

const NATURE_ORDER: ExportColumnNature[] = ["importe", "saisissable", "calcule", "ajuste"]

function todayInputValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

function optionalNumber(value: string): number | undefined {
  const trimmed = value.trim()
  if (trimmed === "") return undefined
  const n = Number(trimmed)
  return Number.isFinite(n) ? n : Number.NaN
}

/**
 * Export Excel d'un panier (§7.9) : l'évaluateur saisit le taux de croissance et la date d'évaluation,
 * choisit les colonnes, renseigne au besoin les valeurs de référence des indicateurs ajustés, puis
 * télécharge un classeur généré côté client.
 */
export function PanierExcelExport({
  transactions,
  nom,
  importedFields,
  champs,
}: {
  transactions: SerializedTransaction[]
  nom: string
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
}) {
  const columns = useMemo(() => buildExportColumns(importedFields, champs), [importedFields, champs])
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(columns.filter((column) => column.defaultVisible).map((column) => column.key))
  )
  const [tauxCroissance, setTauxCroissance] = useState("")
  const [dateEvaluation, setDateEvaluation] = useState("")
  const [tauxBoiseRef, setTauxBoiseRef] = useState("")
  const [tauxCultiveRef, setTauxCultiveRef] = useState("")
  const [valeurBatiment, setValeurBatiment] = useState("")
  const [valeurMaison, setValeurMaison] = useState("")
  const [valeurTerrain, setValeurTerrain] = useState("")
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    setError(null)
    // Date du jour proposée à la première ouverture, sans dépendre de l'heure du rendu serveur.
    setDateEvaluation((current) => current || todayInputValue())
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

  /** Valide la saisie et renvoie les paramètres, ou le message d'erreur à afficher. */
  function readParams(): { ok: true; params: ExportAnalysisParams } | { ok: false; error: string } {
    const taux = Number(tauxCroissance)
    if (tauxCroissance.trim() === "" || !Number.isFinite(taux)) {
      return { ok: false, error: "Le taux de croissance doit être un nombre." }
    }
    if (taux <= -100) {
      return { ok: false, error: "Le taux de croissance doit être supérieur à -100 %." }
    }
    if (!dateEvaluation) {
      return { ok: false, error: "La date d'évaluation est obligatoire." }
    }
    if (Number.isNaN(new Date(dateEvaluation).getTime())) {
      return { ok: false, error: "La date d'évaluation est invalide." }
    }
    if (selected.size === 0) {
      return { ok: false, error: "Sélectionnez au moins une colonne." }
    }

    const refs = [tauxBoiseRef, tauxCultiveRef, valeurBatiment, valeurMaison, valeurTerrain].map(optionalNumber)
    if (refs.some((value) => value !== undefined && Number.isNaN(value))) {
      return { ok: false, error: "Les paramètres d'analyse doivent être numériques." }
    }
    const [boise, cultive, batiment, maison, terrain] = refs

    return {
      ok: true,
      params: {
        tauxCroissancePct: taux,
        dateEvaluation,
        tauxBoiseRef: boise,
        tauxCultiveRef: cultive,
        valeurBatiment: batiment,
        valeurMaison: maison,
        valeurTerrainResidentiel: terrain,
      },
    }
  }

  async function handleExport() {
    const parsed = readParams()
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }

    setExporting(true)
    setError(null)
    try {
      const table = buildExportTable({
        transactions,
        importedFields,
        champs,
        params: parsed.params,
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
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="export-taux-croissance">Taux de croissance (%)</Label>
                <Input
                  id="export-taux-croissance"
                  type="number"
                  step="0.01"
                  value={tauxCroissance}
                  onChange={(e) => setTauxCroissance(e.target.value)}
                  placeholder="5"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="export-date-evaluation">Date d&apos;évaluation</Label>
                <Input
                  id="export-date-evaluation"
                  type="date"
                  value={dateEvaluation}
                  onChange={(e) => setDateEvaluation(e.target.value)}
                />
              </div>
            </div>

            <fieldset className="space-y-2 rounded-md border border-border p-3">
              <legend className="px-1 text-xs font-semibold text-muted-foreground">Paramètres d&apos;analyse</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="export-taux-boise">Taux boisé de référence ($/ha)</Label>
                  <Input
                    id="export-taux-boise"
                    type="number"
                    step="0.01"
                    value={tauxBoiseRef}
                    onChange={(e) => setTauxBoiseRef(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="export-taux-cultive">Taux cultivé de référence ($/ha)</Label>
                  <Input
                    id="export-taux-cultive"
                    type="number"
                    step="0.01"
                    value={tauxCultiveRef}
                    onChange={(e) => setTauxCultiveRef(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="export-valeur-batiment">Valeur bâtiment de référence ($)</Label>
                  <Input
                    id="export-valeur-batiment"
                    type="number"
                    step="0.01"
                    value={valeurBatiment}
                    onChange={(e) => setValeurBatiment(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="export-valeur-maison">Valeur maison de référence ($)</Label>
                  <Input
                    id="export-valeur-maison"
                    type="number"
                    step="0.01"
                    value={valeurMaison}
                    onChange={(e) => setValeurMaison(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="export-valeur-terrain">Valeur terrain résidentiel de référence ($)</Label>
                  <Input
                    id="export-valeur-terrain"
                    type="number"
                    step="0.01"
                    value={valeurTerrain}
                    onChange={(e) => setValeurTerrain(e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>
            </fieldset>

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
