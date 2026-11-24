"use client"

import { useState, useTransition } from "react"
import { Button } from "@/components/ui/button"
import { accepterPolitiqueConfidentialite } from "@/server/actions/consent"

export function ConsentBanner() {
  const [erreur, setErreur] = useState<string | null>(null)
  const [visible, setVisible] = useState(true)
  const [enCours, startTransition] = useTransition()

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Politique de confidentialité"
      className="fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t border-border bg-background p-4 shadow-lg sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-sm">
        En utilisant EVAGRI, vous acceptez la politique de confidentialité de l&apos;organisation, conformément à la
        Loi 25.
      </p>
      <div className="flex items-center gap-3">
        {erreur && <span className="text-sm text-destructive">{erreur}</span>}
        <Button
          disabled={enCours}
          onClick={() =>
            startTransition(async () => {
              const resultat = await accepterPolitiqueConfidentialite()
              if (resultat.ok) setVisible(false)
              else setErreur(resultat.error)
            })
          }
        >
          J&apos;accepte
        </Button>
      </div>
    </div>
  )
}
