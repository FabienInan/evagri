import { useSyncExternalStore } from "react"

/**
 * Accès réactif à localStorage, sans effet : la valeur est lue pendant le rendu via useSyncExternalStore.
 * Le rendu serveur et l'hydratation voient `null` (aucune préférence), puis la valeur réelle après montage.
 * Les écritures de cet onglet sont notifiées aux abonnés (le navigateur ne notifie que les autres onglets).
 */
const CHANGE_EVENT = "evagri:local-storage-change"

/** Valeurs gardées en mémoire quand le stockage est indisponible (mode privé, quota) : la préférence reste vivante. */
const memoryFallback = new Map<string, string>()

function readRaw(key: string): string | null {
  try {
    return globalThis.localStorage.getItem(key)
  } catch {
    return memoryFallback.get(key) ?? null
  }
}

/** Écrit (ou supprime, avec `null`) une clé et notifie les hooks abonnés. */
export function writeLocalStorage(key: string, value: string | null): void {
  try {
    if (value === null) globalThis.localStorage.removeItem(key)
    else globalThis.localStorage.setItem(key, value)
    memoryFallback.delete(key)
  } catch {
    if (value === null) memoryFallback.delete(key)
    else memoryFallback.set(key, value)
  }
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: key }))
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange)
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(CHANGE_EVENT, onChange)
  }
}

/** Valeur brute d'une clé, mise à jour automatiquement. `null` au rendu serveur et si la clé est absente. */
export function useLocalStorageValue(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null
  )
}
