"use client"

import { useEffect, useState } from "react"
import { History, Loader2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { listHistorique, type HistoriqueResult } from "@/server/actions/historique"
import { libelleEntree } from "@/lib/historique"
import type { CibleHistorique } from "@/repositories/journal.repository"

type Entree = Extract<HistoriqueResult, { ok: true }>["entrees"][number]

const dateFormatee = (iso: string) =>
  new Date(iso).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })

/** Bouton « Historique » : ouvre un panneau latéral avec toutes les créations et modifications de l'élément. */
export function HistoriqueBouton({ cible, titre }: { cible: CibleHistorique; titre: string }) {
  const [ouvert, setOuvert] = useState(false)
  const [chargement, setChargement] = useState(false)
  const [entrees, setEntrees] = useState<Entree[]>([])
  const [erreur, setErreur] = useState<string | null>(null)

  // Primitive dependencies: `cible` is an object rebuilt on every render, which would reload the history forever.
  const cibleType = cible.type
  const cibleId = cible.id
  useEffect(() => {
    if (!ouvert) return
    let annule = false
    listHistorique({ type: cibleType, id: cibleId })
      .then((res) => {
        if (annule) return
        if (res.ok) setEntrees(res.entrees)
        else setErreur(res.error)
      })
      .catch(() => {
        if (!annule) setErreur("Impossible de charger l'historique. Réessayez.")
      })
      .finally(() => {
        if (!annule) setChargement(false)
      })
    return () => {
      annule = true
    }
  }, [ouvert, cibleType, cibleId])

  useEffect(() => {
    if (!ouvert) return
    const fermer = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOuvert(false)
    }
    window.addEventListener("keydown", fermer)
    return () => window.removeEventListener("keydown", fermer)
  }, [ouvert])

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-2"
        onClick={() => {
          setChargement(true)
          setErreur(null)
          setOuvert(true)
        }}
      >
        <History className="h-4 w-4" />
        Historique
      </Button>

      {ouvert && (
        <aside
          role="dialog"
          aria-modal="true"
          aria-label={`Historique : ${titre}`}
          className="fixed inset-y-0 right-0 z-[10040] flex w-full max-w-md flex-col border-l border-border bg-card shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-foreground">Historique</h2>
              <p className="truncate text-sm text-muted-foreground">{titre}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Fermer" onClick={() => setOuvert(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {chargement && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Chargement...
              </p>
            )}
            {erreur && <p className="text-sm text-destructive">{erreur}</p>}
            {!chargement && !erreur && entrees.length === 0 && (
              <p className="text-sm text-muted-foreground">Aucune modification enregistrée.</p>
            )}
            {!chargement && entrees.length > 0 && (
              <ol className="space-y-4">
                {entrees.map((e) => (
                  <li key={e.id} className="relative border-l-2 border-border pl-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {dateFormatee(e.createdAt)} · {e.auteur}
                    </p>
                    <p className="mt-0.5 text-sm text-foreground">{libelleEntree(e)}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </aside>
      )}
    </>
  )
}
