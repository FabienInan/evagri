"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import { createAnalyseDossier, updateAnalyseDossier } from "@/server/actions/analyse-dossier"
import type { SerializedAnalyse } from "@/serializers/analyse-dossier.serializer"

function todayInputValue(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${now.getFullYear()}-${month}-${day}`
}

/** Champ numérique optionnel : vide -> null, saisie invalide -> NaN (refusée par le validateur). */
function parseOptional(value: string): number | null {
  if (value.trim() === "") return null
  return Number(value)
}

/** Champ obligatoire : vide ou invalide -> NaN, pour que le validateur signale l'erreur. */
function parseRequired(value: string): number {
  if (value.trim() === "") return Number.NaN
  return Number(value)
}

const REFERENCE_FIELDS = [
  { key: "tauxBoiseRef", label: "Taux boisé de référence ($/ha)" },
  { key: "tauxCultiveRef", label: "Taux cultivé de référence ($/ha)" },
  { key: "valeurBatimentRef", label: "Valeur bâtiment de référence ($)" },
  { key: "valeurMaisonRef", label: "Valeur maison de référence ($)" },
  { key: "valeurTerrainResidentielRef", label: "Valeur terrain résidentiel de référence ($)" },
] as const

type ReferenceKey = (typeof REFERENCE_FIELDS)[number]["key"]

export function AnalyseDossierFormDialog({
  dossierId,
  analyse,
  onClose,
  onSaved,
}: {
  dossierId: string
  /** Absent pour une création. */
  analyse?: SerializedAnalyse
  onClose: () => void
  onSaved: () => void
}) {
  const [dateEvaluation, setDateEvaluation] = useState(analyse?.dateEvaluation ?? todayInputValue())
  const [tauxCroissance, setTauxCroissance] = useState(analyse ? String(analyse.tauxCroissancePct) : "")
  const [references, setReferences] = useState<Record<ReferenceKey, string>>(() => ({
    tauxBoiseRef: analyse?.tauxBoiseRef?.toString() ?? "",
    tauxCultiveRef: analyse?.tauxCultiveRef?.toString() ?? "",
    valeurBatimentRef: analyse?.valeurBatimentRef?.toString() ?? "",
    valeurMaisonRef: analyse?.valeurMaisonRef?.toString() ?? "",
    valeurTerrainResidentielRef: analyse?.valeurTerrainResidentielRef?.toString() ?? "",
  }))
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    const payload = {
      dateEvaluation,
      tauxCroissancePct: parseRequired(tauxCroissance),
      tauxBoiseRef: parseOptional(references.tauxBoiseRef),
      tauxCultiveRef: parseOptional(references.tauxCultiveRef),
      valeurBatimentRef: parseOptional(references.valeurBatimentRef),
      valeurMaisonRef: parseOptional(references.valeurMaisonRef),
      valeurTerrainResidentielRef: parseOptional(references.valeurTerrainResidentielRef),
    }
    const res = analyse
      ? await updateAnalyseDossier({ id: analyse.id, ...payload })
      : await createAnalyseDossier({ dossierId, ...payload })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onSaved()
  }

  return (
    <Modal title={analyse ? "Modifier l'analyse" : "Nouvelle analyse de dossier"} onClose={onClose} className="max-w-2xl">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="analyse-date-evaluation">Date d&apos;évaluation</Label>
            <Input
              id="analyse-date-evaluation"
              type="date"
              value={dateEvaluation}
              onChange={(e) => setDateEvaluation(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="analyse-taux-croissance">Taux de croissance (%)</Label>
            <Input
              id="analyse-taux-croissance"
              type="number"
              step="0.01"
              value={tauxCroissance}
              onChange={(e) => setTauxCroissance(e.target.value)}
              placeholder="5"
            />
          </div>
        </div>

        <fieldset className="space-y-2 rounded-md border border-border p-3">
          <legend className="px-1 text-xs font-semibold text-muted-foreground">Valeurs de référence</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {REFERENCE_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`analyse-${field.key}`}>{field.label}</Label>
                <Input
                  id={`analyse-${field.key}`}
                  type="number"
                  step="0.01"
                  value={references[field.key]}
                  onChange={(e) => setReferences((prev) => ({ ...prev, [field.key]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </fieldset>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            Enregistrer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
