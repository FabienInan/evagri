"use client"

import { useState } from "react"
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
  onAdded?: () => void
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
    onAdded?.()
  }

  const count = transactionIds.length

  return (
    <div className="space-y-3">
      {panierId ? (
        <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
          <p className="text-muted-foreground">Panier courant</p>
          <p className="font-medium text-foreground">{current?.panierNom ?? "Panier sélectionné"}</p>
          {current?.dossierNumero && (
            <p className="text-xs text-muted-foreground">Dossier {current.dossierNumero}</p>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Aucun panier courant. Choisissez un dossier et un panier dans le menu, en haut de la barre latérale.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        {count} transaction{count > 1 ? "s" : ""} sélectionnée{count > 1 ? "s" : ""}.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
          Fermer
        </Button>
        <Button size="sm" onClick={handleConfirm} disabled={saving || !panierId}>
          Ajouter
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
  onAdded?: () => void
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
