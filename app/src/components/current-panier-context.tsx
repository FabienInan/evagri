"use client"

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react"
import {
  CURRENT_PANIER_STORAGE_KEY,
  parseCurrentPanier,
  readCurrentPanierRaw,
  saveCurrentPanier,
  type CurrentPanier,
} from "@/lib/current-panier"

/** Événement local : les changements faits dans cet onglet sont notifiés aux abonnés (le stockage ne le fait pas). */
const CHANGE_EVENT = "evagri:current-panier-change"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

type CurrentPanierContextValue = {
  current: CurrentPanier | null
  chooseDossier: (dossier: { id: string; numeroDossier: string }) => void
  choosePanier: (panier: { id: string; nom: string }) => void
}

const CurrentPanierContext = createContext<CurrentPanierContextValue | undefined>(undefined)

/**
 * Dossier et panier courants, partagés par la barre latérale (sélecteurs) et la boîte « Ajouter au panier ».
 * Lus depuis le stockage du navigateur via useSyncExternalStore : rendu serveur sans contexte, puis mise à jour
 * après hydratation, sans désynchronisation.
 */
export function CurrentPanierProvider({ children }: { children: ReactNode }) {
  const raw = useSyncExternalStore(subscribe, readCurrentPanierRaw, () => null)
  const current = useMemo(() => parseCurrentPanier(raw), [raw])

  const write = useCallback((next: CurrentPanier | null) => {
    saveCurrentPanier(next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  const chooseDossier = useCallback(
    (dossier: { id: string; numeroDossier: string }) => {
      // Changer de dossier vide le panier : il appartenait à l'ancien dossier.
      write({ dossierId: dossier.id, dossierNumero: dossier.numeroDossier, panierId: "" })
    },
    [write]
  )

  const choosePanier = useCallback(
    (panier: { id: string; nom: string }) => {
      if (!current) return
      write({ ...current, panierId: panier.id, panierNom: panier.nom })
    },
    [current, write]
  )

  const value = useMemo(
    () => ({ current, chooseDossier, choosePanier }),
    [current, chooseDossier, choosePanier]
  )

  return <CurrentPanierContext.Provider value={value}>{children}</CurrentPanierContext.Provider>
}

export function useCurrentPanier(): CurrentPanierContextValue {
  const value = useContext(CurrentPanierContext)
  if (!value) throw new Error("useCurrentPanier doit être utilisé dans CurrentPanierProvider")
  return value
}

export { CURRENT_PANIER_STORAGE_KEY }
