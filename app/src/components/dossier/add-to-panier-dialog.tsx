"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import {
  addTransactionsToPanier,
  listDossiers,
  listPaniersForDossier,
} from "@/server/actions/dossier"
import type { SerializedDossier, SerializedPanier } from "@/serializers/dossier.serializer"

/** Contenu monté à chaque ouverture : l'état (dossier/panier/messages) repart de zéro sans effet de reset. */
function AddToPanierDialogContent({
  transactionIds,
  onOpenChange,
  onAdded,
}: {
  transactionIds: string[]
  onOpenChange: (open: boolean) => void
  onAdded?: () => void
}) {
  const [dossiers, setDossiers] = useState<SerializedDossier[]>([])
  const [dossierId, setDossierId] = useState("")
  const [paniers, setPaniers] = useState<SerializedPanier[]>([])
  const [panierId, setPanierId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    listDossiers().then((data) => {
      if (!cancelled) setDossiers(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!dossierId) return
    let cancelled = false
    listPaniersForDossier(dossierId).then((data) => {
      if (!cancelled) setPaniers(data)
    })
    return () => {
      cancelled = true
    }
  }, [dossierId])

  function handleDossierChange(id: string) {
    setDossierId(id)
    setPanierId("")
    setPaniers([])
  }

  async function handleConfirm() {
    if (!panierId) {
      setError("Sélectionnez un panier.")
      return
    }
    setSaving(true)
    setError(null)
    const res = await addTransactionsToPanier({ panierId, transactionIds })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    // Succès : on referme la modale, la liste cible reflète l'ajout (revalidatePath côté action).
    onOpenChange(false)
    // La fiche s'en sert pour passer à la transaction suivante de la liste filtrée.
    onAdded?.()
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="add-dossier">Dossier</Label>
        <select
          id="add-dossier"
          aria-label="Dossier"
          className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          value={dossierId}
          onChange={(e) => handleDossierChange(e.target.value)}
        >
          <option value="">— Choisir un dossier —</option>
          {dossiers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.numeroDossier}
              {d.nom ? ` — ${d.nom}` : ""}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="add-panier">Panier</Label>
        <select
          id="add-panier"
          aria-label="Panier"
          className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
          value={panierId}
          disabled={!dossierId}
          onChange={(e) => setPanierId(e.target.value)}
        >
          <option value="">— Choisir un panier —</option>
          {paniers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        {transactionIds.length} transaction{transactionIds.length > 1 ? "s" : ""} sélectionnée
        {transactionIds.length > 1 ? "s" : ""}.
      </p>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
          Fermer
        </Button>
        <Button size="sm" onClick={handleConfirm} disabled={saving}>
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
