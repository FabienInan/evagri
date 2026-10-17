"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import { createDossier } from "@/server/actions/dossier"

export function DossierFormDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [numeroDossier, setNumeroDossier] = useState("")
  const [nom, setNom] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    const res = await createDossier({ numeroDossier, nom: nom.trim() || undefined })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onCreated(res.id)
  }

  return (
    <Modal title="Nouveau dossier" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="numero-dossier">Numéro de dossier</Label>
          <Input
            id="numero-dossier"
            value={numeroDossier}
            placeholder="25-AB-001"
            onChange={(e) => setNumeroDossier(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nom-dossier">Nom (optionnel)</Label>
          <Input id="nom-dossier" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
