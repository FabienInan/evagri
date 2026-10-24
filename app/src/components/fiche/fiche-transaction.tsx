"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { FicheHeader } from "@/components/fiche/fiche-header"
import { SectionCard } from "@/components/fiche/section-card"
import { FieldControl } from "@/components/fiche/field-control"
import { FieldValue } from "@/components/fiche/field-value"
import { IndicateursPanel } from "@/components/fiche/indicateurs-panel"
import { DocumentsPanel } from "@/components/fiche/documents-panel"
import { AddToPanierDialog } from "@/components/dossier/add-to-panier-dialog"
import { Modal } from "@/components/dossier/modal"
import { Button } from "@/components/ui/button"
import { saveFiche, setFicheStatut, type FicheFieldError } from "@/server/actions/fiche"
import {
  TYPE_TRANSACTION_CODE,
  buildFicheViewModel,
  resolveTypeTransaction,
  withInitialValues,
  withRecomputedIndicateurs,
  type FicheValeur,
} from "@/lib/fiche"
import type { SerializedFiche } from "@/serializers/fiche.serializer"
import type { TransactionNavigation } from "@/types/transaction"

export function FicheTransactionClient({
  fiche,
  navigation,
  detailQuery,
}: {
  fiche: SerializedFiche
  /** Voisins dans la liste affichée ; null quand la fiche est ouverte hors de cette liste. */
  navigation: TransactionNavigation | null
  /** Query string à conserver pour rester dans la même liste et le même tri. */
  detailQuery: string
}) {
  const router = useRouter()
  const mode = fiche.mode
  const isEdition = mode === "edition"

  // Pre-filling only in edition: a consultation shows exactly what is stored.
  const [valeurs, setValeurs] = useState<Record<string, FicheValeur>>(() =>
    isEdition ? withInitialValues(fiche.champs, fiche.fields) : withRecomputedIndicateurs(fiche.champs, fiche.fields)
  )
  const [typeCode, setTypeCode] = useState<string | null>(() => {
    const current = resolveTypeTransaction(fiche.fields[TYPE_TRANSACTION_CODE] ?? null, fiche.typologies)
    return current?.code ?? null
  })
  const [saving, setSaving] = useState(false)
  // actionError: échec sans détail par champ (panne, données invalides) ; fieldErrors: violations des
  // règles bloquantes, chacune rattachée à un champ (ou à la fiche quand champ est null).
  const [actionError, setActionError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FicheFieldError[]>([])
  const [addToPanierOpen, setAddToPanierOpen] = useState(false)
  const [analyseConfirmOpen, setAnalyseConfirmOpen] = useState(false)
  const [reopenConfirmOpen, setReopenConfirmOpen] = useState(false)
  // Avertissements non bloquants (W-001) : l'évaluateur confirme ou corrige avant l'action en attente.
  const [warning, setWarning] = useState<{ items: FicheFieldError[]; then: "save" | "analyse" } | null>(null)

  function confirmWarning(next: "save" | "analyse") {
    setWarning(null)
    void (next === "save" ? handleSave(true) : handleAnalyse(true))
  }

  function goToTransaction(id: string | null) {
    if (id) router.push(`/transactions/${id}${detailQuery}`)
  }

  const viewModel = buildFicheViewModel({
    sections: fiche.sections,
    champs: fiche.champs,
    valeurs,
    typeCode,
  })

  function recompute(nextValeurs: Record<string, FicheValeur>) {
    return withRecomputedIndicateurs(fiche.champs, nextValeurs)
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

  /** Enregistre la fiche. Renvoie les avertissements non bloquants si l'évaluateur doit confirmer. */
  async function persist(forcer = false): Promise<"saved" | "failed" | FicheFieldError[]> {
    setSaving(true)
    setActionError(null)
    setFieldErrors([])
    try {
      const res = await saveFiche({ id: fiche.id, typeTransactionCode: typeCode, valeurs, forcerSauvegarde: forcer })
      if (!res.ok) {
        if (res.avertissements) return res.avertissements
        applyActionError(res)
        return "failed"
      }
      return "saved"
    } catch {
      setActionError("Échec de l'enregistrement. Réessayez.")
      return "failed"
    } finally {
      setSaving(false)
    }
  }

  async function handleSave(forcer = false) {
    const outcome = await persist(forcer)
    if (Array.isArray(outcome)) setWarning({ items: outcome, then: "save" })
  }

  async function handleAnalyse(forcer = false) {
    const outcome = await persist(forcer)
    if (Array.isArray(outcome)) {
      setWarning({ items: outcome, then: "analyse" })
      return
    }
    if (outcome === "failed") return
    setSaving(true)
    try {
      const res = await setFicheStatut(fiche.id, "ANALYSEE")
      if (!res.ok) applyActionError(res)
    } catch {
      setActionError("Échec du changement de statut. Réessayez.")
    } finally {
      setSaving(false)
    }
  }

  async function handleReopen() {
    setSaving(true)
    setActionError(null)
    setFieldErrors([])
    try {
      const res = await setFicheStatut(fiche.id, "NON_ANALYSEE")
      if (!res.ok) applyActionError(res)
    } catch {
      setActionError("Échec de la réouverture. Réessayez.")
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
      {navigation && (
        // Navigation contextuelle au-dessus de la première carte, aux couleurs de la charte.
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="default"
            size="sm"
            className="gap-1"
            aria-label="Transaction précédente"
            title="Transaction précédente"
            disabled={!navigation.prevId}
            onClick={() => goToTransaction(navigation.prevId)}
          >
            <ChevronLeft className="h-4 w-4" />
            Précédent
          </Button>
          <Button
            variant="default"
            size="sm"
            className="gap-1"
            aria-label="Transaction suivante"
            title="Transaction suivante"
            disabled={!navigation.nextId}
            onClick={() => goToTransaction(navigation.nextId)}
          >
            Suivant
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <FicheHeader
        fields={fiche.fields}
        mode={mode}
        typologies={fiche.typologies}
        typeCode={typeCode}
        statut={fiche.statut}
        saving={saving}
        errors={actionError ? [actionError, ...bannerErrors] : bannerErrors}
        typeError={errorsByChamp.get(TYPE_TRANSACTION_CODE) ?? null}
        onTypeChange={handleTypeChange}
        onSave={() => void handleSave()}
        onAnalyse={() => setAnalyseConfirmOpen(true)}
        onReopen={() => setReopenConfirmOpen(true)}
        onAddToPanier={() => setAddToPanierOpen(true)}
      />

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
        transactionId={fiche.id}
        documents={fiche.documents}
        readOnly={!isEdition}
      />

      <AddToPanierDialog
        transactionIds={[fiche.id]}
        open={addToPanierOpen}
        onOpenChange={setAddToPanierOpen}
        onAdded={() => goToTransaction(navigation?.nextId ?? null)}
      />

      {analyseConfirmOpen && (
        <Modal
          title="Passer la transaction à « Analysée » ?"
          onClose={() => setAnalyseConfirmOpen(false)}
        >
          <p className="text-sm text-muted-foreground">
            L&apos;enregistrement et les contrôles bloquants seront exécutés. La transaction passera à
            « Analysée » uniquement si toutes les règles sont respectées.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setAnalyseConfirmOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setAnalyseConfirmOpen(false)
                void handleAnalyse()
              }}
            >
              Confirmer l&apos;analyse
            </Button>
          </div>
        </Modal>
      )}

      {reopenConfirmOpen && (
        <Modal
          title="Rouvrir la transaction ?"
          onClose={() => setReopenConfirmOpen(false)}
        >
          <p className="text-sm text-muted-foreground">
            La transaction repassera à « Non analysée » pour permettre sa correction. Le contributeur
            historique et la date d&apos;analyse sont conservés.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setReopenConfirmOpen(false)}>
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setReopenConfirmOpen(false)
                void handleReopen()
              }}
            >
              Confirmer la réouverture
            </Button>
          </div>
        </Modal>
      )}

      {warning && (
        <Modal title="Avertissement avant enregistrement" onClose={() => setWarning(null)}>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground">
            {warning.items.map((w) => (
              <li key={w.code}>{w.message}</li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">
            Vous pouvez corriger les valeurs, ou forcer la sauvegarde telle quelle.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setWarning(null)}>
              Corriger
            </Button>
            <Button size="sm" onClick={() => confirmWarning(warning.then)}>
              {warning.then === "save" ? "Forcer la sauvegarde" : "Forcer et analyser"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
