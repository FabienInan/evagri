"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import {
  addTransactionsToPanier,
  listDossiers,
  listPaniersForDossier,
} from "@/server/actions/dossier"
import { readCurrentPanier, saveCurrentPanier } from "@/lib/current-panier"
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
  // Contexte du dernier ajout, lu une fois au montage : le contenu est remonté à chaque ouverture.
  const [remembered] = useState(readCurrentPanier)
  const [dossiers, setDossiers] = useState<SerializedDossier[]>([])
  const [dossierId, setDossierId] = useState(remembered?.dossierId ?? "")
  const [paniers, setPaniers] = useState<SerializedPanier[]>([])
  const [panierId, setPanierId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  // Choix manuel : il ne doit pas être écrasé par la restauration du panier mémorisé.
  const panierTouched = useRef(false)

  useEffect(() => {
    let cancelled = false
    listDossiers().then((data) => {
      if (cancelled) return
      setDossiers(data)
      // Contexte obsolète : le dossier mémorisé n'existe plus.
      if (remembered && !data.some((d) => d.id === remembered.dossierId)) {
        setDossierId("")
      }
    })
    return () => {
      cancelled = true
    }
  }, [remembered])

  useEffect(() => {
    if (!dossierId) return
    let cancelled = false
    listPaniersForDossier(dossierId).then((data) => {
      if (cancelled) return
      setPaniers(data)
      // Restaure le panier mémorisé seulement s'il appartient toujours à ce dossier.
      if (remembered && remembered.dossierId === dossierId && !panierTouched.current) {
        setPanierId(data.some((p) => p.id === remembered.panierId) ? remembered.panierId : "")
      }
    })
    return () => {
      cancelled = true
    }
  }, [dossierId, remembered])

  function handleDossierChange(id: string) {
    panierTouched.current = false
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
    // Le prochain dialogue s'ouvrira sur ce couple dossier/panier.
    saveCurrentPanier({ dossierId, panierId })
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
          onChange={(e) => {
            panierTouched.current = true
            setPanierId(e.target.value)
          }}
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
