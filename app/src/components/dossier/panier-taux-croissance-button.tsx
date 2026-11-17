"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Percent } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/modal"
import { updatePanierTauxCroissance } from "@/server/actions/dossier"

/** Affiche le taux de croissance du panier et permet de le modifier après sa création. */
export function PanierTauxCroissanceButton({
  panierId,
  tauxCroissancePct,
}: {
  panierId: string
  tauxCroissancePct: number | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function openModal() {
    setValue(tauxCroissancePct === null ? "" : String(tauxCroissancePct).replace(".", ","))
    setError(null)
    setOpen(true)
  }

  async function handleSave() {
    const taux = value.trim() === "" ? Number.NaN : Number(value.replace(",", "."))
    setSaving(true)
    setError(null)
    const res = await updatePanierTauxCroissance({ panierId, tauxCroissancePct: taux })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setOpen(false)
    // La page du panier est rendue côté serveur : on la relit pour que l'export prenne le nouveau taux.
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" size="sm" className="h-8 gap-2 text-xs" onClick={openModal}>
        <Percent className="h-4 w-4" />
        {tauxCroissancePct === null ? "Taux de croissance" : `Taux : ${tauxCroissancePct} %`}
      </Button>

      {open && (
        <Modal title="Taux de croissance du panier" onClose={() => setOpen(false)}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="taux-croissance-panier">Taux de croissance annuel (%)</Label>
              <Input
                id="taux-croissance-panier"
                inputMode="decimal"
                placeholder="3,25"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Sert au calcul des indicateurs ajustés à l&apos;export du panier.
              </p>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                Annuler
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                Enregistrer
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
