/**
 * Contexte courant de travail, mémorisé dans le navigateur : le dossier et le panier choisis dans la barre latérale.
 * « Ajouter au panier » ajoute à ce panier. `panierId` vide = dossier choisi, panier pas encore choisi.
 */
export const CURRENT_PANIER_STORAGE_KEY = "evagri:current-panier"

export interface CurrentPanier {
  dossierId: string
  dossierNumero?: string
  panierId: string
  panierNom?: string
}

/** Lecture défensive d'une valeur brute du stockage : contenu inattendu → aucun contexte. */
export function parseCurrentPanier(raw: string | null): CurrentPanier | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    const o = parsed as Record<string, unknown>
    if (typeof o.dossierId !== "string" || typeof o.panierId !== "string") return null
    return {
      dossierId: o.dossierId,
      panierId: o.panierId,
      dossierNumero: typeof o.dossierNumero === "string" ? o.dossierNumero : undefined,
      panierNom: typeof o.panierNom === "string" ? o.panierNom : undefined,
    }
  } catch {
    return null
  }
}

/** Stockage indisponible (mode privé, quota) : le contexte n'est simplement pas mémorisé. */
export function saveCurrentPanier(context: CurrentPanier | null): void {
  if (typeof window === "undefined") return
  try {
    if (context) window.localStorage.setItem(CURRENT_PANIER_STORAGE_KEY, JSON.stringify(context))
    else window.localStorage.removeItem(CURRENT_PANIER_STORAGE_KEY)
  } catch {
    // Sans mémorisation, le contexte repart de zéro au rechargement.
  }
}

export function readCurrentPanierRaw(): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(CURRENT_PANIER_STORAGE_KEY)
  } catch {
    return null
  }
}
