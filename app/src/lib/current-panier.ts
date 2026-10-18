/**
 * Contexte d'ajout mémorisé dans le navigateur : dernier couple dossier/panier utilisé pour un ajout
 * réussi. Il préremplit le dialogue « Ajouter au panier » sans imposer le choix, qui reste modifiable.
 */
export const CURRENT_PANIER_STORAGE_KEY = "evagri:current-panier"

export interface CurrentPanier {
  dossierId: string
  panierId: string
}

/** Lecture défensive : stockage indisponible ou contenu inattendu → aucun contexte mémorisé. */
export function readCurrentPanier(): CurrentPanier | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(CURRENT_PANIER_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).dossierId === "string" &&
      typeof (parsed as Record<string, unknown>).panierId === "string"
    ) {
      const { dossierId, panierId } = parsed as Record<string, string>
      return { dossierId, panierId }
    }
    return null
  } catch {
    return null
  }
}

/** Échec d'écriture (mode privé, quota) : le contexte n'est simplement pas mémorisé. */
export function saveCurrentPanier(context: CurrentPanier): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(CURRENT_PANIER_STORAGE_KEY, JSON.stringify(context))
  } catch {
    // Sans mémorisation, le prochain dialogue repartira de zéro comme avant.
  }
}
