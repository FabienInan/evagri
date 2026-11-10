"use client"

import { useState } from "react"
import { FolderOpen, ListChecks, Plus, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/dossier/modal"
import { addTransactionsToPanier } from "@/server/actions/dossier"
import { useCurrentPanier } from "@/components/current-panier-context"

/** Ajoute les transactions au panier courant (choisi dans la barre latérale). Aucun sélecteur ici. */
function AddToPanierDialogContent({
  transactionIds,
  onOpenChange,
  onAdded,
}: {
  transactionIds: string[]
  onOpenChange: (open: boolean) => void
  onAdded?: (transactionIds: string[]) => void
}) {
  const { current } = useCurrentPanier()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const panierId = current?.panierId ?? ""

  async function handleConfirm() {
    if (!panierId) return
    setSaving(true)
    setError(null)
    const res = await addTransactionsToPanier({ panierId, transactionIds })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onOpenChange(false)
    // La fiche s'en sert pour passer à la transaction suivante de la liste filtrée.
    onAdded?.(transactionIds)
  }

  const count = transactionIds.length

  return (
    <div className="space-y-4">
      {panierId ? (
        <dl className="divide-y divide-border rounded-lg border border-border bg-muted/30 text-sm">
          <div className="flex items-center gap-3 px-3 py-2.5">
            <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">Dossier</dt>
            <dd className="min-w-0 truncate font-medium text-foreground">{current?.dossierNumero ?? "—"}</dd>
          </div>
          <div className="flex items-center gap-3 px-3 py-2.5">
            <ListChecks className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <dt className="w-16 shrink-0 text-xs font-medium uppercase tracking-wide text-muted-foreground">Panier</dt>
            <dd className="min-w-0 truncate font-medium text-foreground">{current?.panierNom ?? "Panier sélectionné"}</dd>
          </div>
        </dl>
      ) : (
        <div className="flex gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            Aucun panier courant. Choisissez un dossier et un panier dans la barre en haut de l&apos;écran.
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold tabular-nums text-foreground">{count}</span>{" "}
          transaction{count > 1 ? "s" : ""} sélectionnée{count > 1 ? "s" : ""}
        </p>
        {error && <p className="text-right text-sm text-destructive">{error}</p>}
      </div>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
          Fermer
        </Button>
        <Button onClick={handleConfirm} disabled={saving || !panierId || count === 0}>
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ajouter au panier
        </Button>
      </div>
    </div>
  )
}

export function AddToPanierDialog({
  transactionIds,
  open,
  onOpenChange,
  onAdded,
}: {
  transactionIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdded?: (transactionIds: string[]) => void
}) {
  if (!open) return null

  return (
    <Modal title="Ajouter au panier" onClose={() => onOpenChange(false)}>
      <AddToPanierDialogContent
        transactionIds={transactionIds}
        onOpenChange={onOpenChange}
        onAdded={onAdded}
      />
    </Modal>
  )
}
