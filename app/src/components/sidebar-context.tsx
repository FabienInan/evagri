"use client"

import { useEffect, useState } from "react"
import { listDossiers, listPaniersForDossier } from "@/server/actions/dossier"
import { useCurrentPanier } from "@/components/current-panier-context"
import type { SerializedDossier, SerializedPanier } from "@/serializers/dossier.serializer"

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-border bg-card px-2 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50"

/**
 * Dossier et panier courants, en haut de la barre latérale : c'est là qu'on choisit le panier où « Ajouter au
 * panier » ajoute les transactions. Deux sélecteurs : le panier ne propose que les paniers du dossier choisi.
 */
export function SidebarContext() {
  const { current, chooseDossier, choosePanier } = useCurrentPanier()
  const [dossiers, setDossiers] = useState<SerializedDossier[]>([])
  const [paniers, setPaniers] = useState<SerializedPanier[]>([])
  const dossierId = current?.dossierId ?? ""
  const panierId = current?.panierId ?? ""

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

  // Les paniers affichés appartiennent au dossier courant (évite de montrer ceux de l'ancien dossier).
  const paniersDuDossier = paniers.filter((p) => p.dossierId === dossierId)

  return (
    <div className="space-y-3 border-b border-border px-3 py-4">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">En cours</p>

      <label className="block space-y-1">
        <span className="px-1 text-xs text-muted-foreground">Dossier</span>
        <select
          aria-label="Dossier courant"
          className={SELECT_CLASS}
          value={dossierId}
          onChange={(e) => {
            const dossier = dossiers.find((d) => d.id === e.target.value)
            if (dossier) chooseDossier({ id: dossier.id, numeroDossier: dossier.numeroDossier })
          }}
        >
          <option value="">— Choisir un dossier —</option>
          {dossiers.map((d) => (
            <option key={d.id} value={d.id}>
              {d.numeroDossier}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="px-1 text-xs text-muted-foreground">Panier</span>
        <select
          aria-label="Panier courant"
          className={SELECT_CLASS}
          value={panierId}
          disabled={!dossierId}
          onChange={(e) => {
            const panier = paniersDuDossier.find((p) => p.id === e.target.value)
            if (panier) choosePanier({ id: panier.id, nom: panier.nom })
          }}
        >
          <option value="">— Choisir un panier —</option>
          {paniersDuDossier.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nom}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
