"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Modal } from "@/components/dossier/modal"
import { deletePanier } from "@/server/actions/dossier"

/** Supprime le panier après confirmation, puis renvoie vers le dossier. Les transactions sont conservées. */
export function PanierDeleteButton({ panierId, nom }: { panierId: string; nom: string }) {
  const router = useRouter()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    const res = await deletePanier(panierId)
    if (!res.ok) {
      setDeleting(false)
      setError(res.error)
      return
    }
    router.push(`/dossiers/${res.dossierId}`)
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-destructive hover:text-destructive"
        onClick={() => {
          setError(null)
          setConfirmOpen(true)
        }}
      >
        <Trash2 className="h-4 w-4" />
        Supprimer le panier
      </Button>

      {confirmOpen && (
        <Modal title="Supprimer le panier ?" onClose={() => !deleting && setConfirmOpen(false)}>
          <p className="text-sm text-muted-foreground">
            Le panier « {nom} » sera supprimé. Ses transactions ne sont pas supprimées : elles restent
            disponibles dans la liste des transactions.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)} disabled={deleting}>
              Annuler
            </Button>
            <Button variant="destructive" size="sm" onClick={() => void handleDelete()} disabled={deleting}>
              {deleting ? "Suppression…" : "Supprimer"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  )
}
