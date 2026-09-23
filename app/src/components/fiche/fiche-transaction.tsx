"use client"

import { useState } from "react"
import { FicheHeader } from "@/components/fiche/fiche-header"
import { SectionCard } from "@/components/fiche/section-card"
import { FieldControl } from "@/components/fiche/field-control"
import { FieldValue } from "@/components/fiche/field-value"
import { IndicateursPanel } from "@/components/fiche/indicateurs-panel"
import { SourceDataPanel } from "@/components/fiche/source-data-panel"
import { DocumentsPanel } from "@/components/fiche/documents-panel"
import { saveFiche, setFicheStatut } from "@/server/actions/fiche"
import {
  TYPE_TRANSACTION_CODE,
  buildCalculationContext,
  buildFicheViewModel,
  resolveTypeTransaction,
  recomputeIndicateurs,
  toNumericValues,
  type FicheValeur,
} from "@/lib/fiche"
import type { SerializedFiche } from "@/serializers/fiche.serializer"

export function FicheTransactionClient({ fiche }: { fiche: SerializedFiche }) {
  const mode = fiche.mode
  const isEdition = mode === "edition"

  const [valeurs, setValeurs] = useState<Record<string, FicheValeur>>(() => ({
    ...fiche.transaction.enrichment,
  }))
  const [typeCode, setTypeCode] = useState<string | null>(() => {
    const current = resolveTypeTransaction(fiche.transaction.enrichment[TYPE_TRANSACTION_CODE], fiche.typologies)
    return current?.code ?? null
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const viewModel = buildFicheViewModel({
    sections: fiche.sections,
    champs: fiche.champs,
    valeurs,
    typeCode,
  })

  function recompute(nextValeurs: Record<string, FicheValeur>) {
    const context = buildCalculationContext(
      fiche.transaction as unknown as Record<string, unknown>,
      toNumericValues(nextValeurs)
    )
    return { ...nextValeurs, ...recomputeIndicateurs(fiche.champs, context) }
  }

  function handleFieldChange(codeMachine: string, valeur: FicheValeur) {
    setValeurs((prev) => ({ ...prev, [codeMachine]: valeur }))
  }

  function handleFieldBlur() {
    setValeurs((prev) => recompute(prev))
  }

  async function persist(): Promise<boolean> {
    setSaving(true)
    setError(null)
    const res = await saveFiche({ id: fiche.transaction.id, typeTransactionCode: typeCode, valeurs })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return false
    }
    return true
  }

  async function handleSave() {
    await persist()
  }

  async function handleAnalyse() {
    const saved = await persist()
    if (!saved) return
    setSaving(true)
    const res = await setFicheStatut(fiche.transaction.id, "Analysée")
    setSaving(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="space-y-4">
      <FicheHeader
        transaction={fiche.transaction}
        mode={mode}
        typologies={fiche.typologies}
        typeCode={typeCode}
        statut={fiche.statut}
        saving={saving}
        error={error}
        onTypeChange={setTypeCode}
        onSave={handleSave}
        onAnalyse={handleAnalyse}
      />

      {mode === "consultation" && <SourceDataPanel transaction={fiche.transaction} />}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {viewModel.mainSections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune section configurée. Configurez la disposition dans Admin → Champs enrichissables.
            </p>
          ) : (
            viewModel.mainSections.map(({ section, champs }) => (
              <SectionCard key={section.id} title={section.nom}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {champs.map(({ config, valeur }) =>
                    isEdition ? (
                      <FieldControl
                        key={config.id}
                        champ={config}
                        valeur={valeur}
                        onChange={(v) => handleFieldChange(config.codeMachine, v)}
                        onBlur={handleFieldBlur}
                        disabled={saving}
                      />
                    ) : (
                      <div key={config.id} className="space-y-1.5">
                        <p className="text-sm font-medium">
                          {config.nomAffichage}
                          {config.unite !== "N/A" ? ` (${config.unite})` : ""}
                        </p>
                        <FieldValue typeDonnees={config.typeDonnees} valeur={valeur} />
                      </div>
                    )
                  )}
                </div>
              </SectionCard>
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-4">
          <IndicateursPanel indicateurs={viewModel.indicateurs} />
        </div>
      </div>

      <DocumentsPanel
        transactionSourceId={fiche.transaction.id}
        documents={fiche.documents}
        readOnly={!isEdition}
      />
    </div>
  )
}
