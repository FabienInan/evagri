"use client"

import { useState } from "react"
import { FicheHeader } from "@/components/fiche/fiche-header"
import { SectionCard } from "@/components/fiche/section-card"
import { FieldControl } from "@/components/fiche/field-control"
import { FieldValue } from "@/components/fiche/field-value"
import { IndicateursPanel } from "@/components/fiche/indicateurs-panel"
import { SourceDataPanel } from "@/components/fiche/source-data-panel"
import { DocumentsPanel } from "@/components/fiche/documents-panel"
import { saveFiche, setFicheStatut, type FicheFieldError } from "@/server/actions/fiche"
import {
  TYPE_TRANSACTION_CODE,
  buildFicheViewModel,
  resolveTypeTransaction,
  withRecomputedIndicateurs,
  type FicheValeur,
} from "@/lib/fiche"
import type { SerializedFiche } from "@/serializers/fiche.serializer"

export function FicheTransactionClient({ fiche }: { fiche: SerializedFiche }) {
  const mode = fiche.mode
  const isEdition = mode === "edition"

  const [valeurs, setValeurs] = useState<Record<string, FicheValeur>>(() =>
    withRecomputedIndicateurs(
      fiche.champs,
      fiche.transaction as unknown as Record<string, unknown>,
      fiche.transaction.enrichment
    )
  )
  const [typeCode, setTypeCode] = useState<string | null>(() => {
    const current = resolveTypeTransaction(fiche.transaction.enrichment[TYPE_TRANSACTION_CODE], fiche.typologies)
    return current?.code ?? null
  })
  const [saving, setSaving] = useState(false)
  // actionError: échec sans détail par champ (panne, données invalides) ; fieldErrors: violations des
  // règles bloquantes, chacune rattachée à un champ (ou à la fiche quand champ est null).
  const [actionError, setActionError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FicheFieldError[]>([])

  const viewModel = buildFicheViewModel({
    sections: fiche.sections,
    champs: fiche.champs,
    valeurs,
    typeCode,
  })

  function recompute(nextValeurs: Record<string, FicheValeur>) {
    return withRecomputedIndicateurs(
      fiche.champs,
      fiche.transaction as unknown as Record<string, unknown>,
      nextValeurs
    )
  }

  function handleFieldChange(codeMachine: string, valeur: FicheValeur) {
    setValeurs((prev) => ({ ...prev, [codeMachine]: valeur }))
    // The field is being corrected: drop its error instead of leaving a stale message under it.
    setFieldErrors((prev) => prev.filter((e) => e.champ !== codeMachine))
  }

  function handleTypeChange(code: string | null) {
    setTypeCode(code)
    setFieldErrors((prev) => prev.filter((e) => e.champ !== TYPE_TRANSACTION_CODE))
  }

  function handleFieldBlur() {
    setValeurs((prev) => recompute(prev))
  }

  function applyActionError(res: { error: string; errors?: FicheFieldError[] }) {
    if (res.errors && res.errors.length > 0) setFieldErrors(res.errors)
    else setActionError(res.error)
  }

  async function persist(): Promise<boolean> {
    setSaving(true)
    setActionError(null)
    setFieldErrors([])
    try {
      const res = await saveFiche({ id: fiche.transaction.id, typeTransactionCode: typeCode, valeurs })
      if (!res.ok) {
        applyActionError(res)
        return false
      }
      return true
    } catch {
      setActionError("Échec de l'enregistrement. Réessayez.")
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSave() {
    await persist()
  }

  async function handleAnalyse() {
    const saved = await persist()
    if (!saved) return
    setSaving(true)
    try {
      const res = await setFicheStatut(fiche.transaction.id, "Analysée")
      if (!res.ok) applyActionError(res)
    } catch {
      setActionError("Échec du changement de statut. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  // First error per champ (the action can return several for one field); the rest go to the banner.
  const errorsByChamp = new Map<string, string>()
  const bannerErrors: string[] = []
  for (const e of fieldErrors) {
    if (e.champ) {
      if (!errorsByChamp.has(e.champ)) errorsByChamp.set(e.champ, e.message)
    } else {
      bannerErrors.push(e.message)
    }
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
        errors={actionError ? [actionError, ...bannerErrors] : bannerErrors}
        typeError={errorsByChamp.get(TYPE_TRANSACTION_CODE) ?? null}
        onTypeChange={handleTypeChange}
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
                        error={errorsByChamp.get(config.codeMachine) ?? null}
                      />
                    ) : (
                      <div key={config.id} className="grid grid-rows-subgrid row-span-3 gap-1.5">
                        <p className="text-xs font-medium text-muted-foreground">
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
