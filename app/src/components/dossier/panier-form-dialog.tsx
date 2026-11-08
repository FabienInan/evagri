"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import { createPanier } from "@/server/actions/dossier"
import type { TypologieOption } from "@/types/typologie"
import { selectStyle } from "@/lib/select-style"

export function PanierFormDialog({
  dossierId,
  typologies,
  onClose,
  onCreated,
}: {
  dossierId: string
  typologies: TypologieOption[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [nom, setNom] = useState("")
  const [typeTransactionId, setTypeTransactionId] = useState("")
  const [tauxCroissance, setTauxCroissance] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    const taux = tauxCroissance.trim() === "" ? Number.NaN : Number(tauxCroissance.replace(",", "."))
    const res = await createPanier({
      dossierId,
      nom,
      typeTransactionId: typeTransactionId || null,
      tauxCroissancePct: taux,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onCreated(res.id)
  }

  return (
    <Modal title="Nouveau panier" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="nom-panier">Nom du panier</Label>
          <Input id="nom-panier" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="taux-croissance">Taux de croissance annuel (%)</Label>
          <Input
            id="taux-croissance"
            inputMode="decimal"
            placeholder="3,25"
            value={tauxCroissance}
            onChange={(e) => setTauxCroissance(e.target.value.replace(/[^0-9.,]/g, ""))}
          />
          <p className="text-xs text-muted-foreground">
            Utilisé pour les indicateurs ajustés à l&apos;export Excel. Il ne se modifie pas ensuite.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type-panier">Type de transaction (optionnel)</Label>
          <select style={selectStyle("0.75rem", "2.25rem")} 
            id="type-panier"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            value={typeTransactionId}
            onChange={(e) => setTypeTransactionId(e.target.value)}
          >
            <option value="">— Aucun —</option>
            {typologies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
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
