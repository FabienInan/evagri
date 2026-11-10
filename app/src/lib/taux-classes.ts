/**
 * Classes de couleur des pins selon le taux global : même principe que la légende de Google Maps, c'est-à-dire
 * des classes de même effectif (quantiles), de la plus claire (taux bas) à la plus foncée (taux élevé).
 */

/** Du plus clair au plus foncé, en vert de la charte (même famille que le pin). */
export const TAUX_PALETTE = ["#dbe9cf", "#b3d394", "#84b061", "#558a3a", "#2f5a1f"] as const

export interface TauxClasse {
  min: number
  max: number
  count: number
  color: string
}

/**
 * Découpe les valeurs en `n` classes d'effectifs voisins. Retourne une liste vide sans valeur ; une classe n'est
 * jamais vide (si les valeurs sont moins nombreuses que les classes, il y en a moins).
 */
export function computeTauxClasses(values: readonly number[], n: number = TAUX_PALETTE.length): TauxClasse[] {
  const sorted = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (sorted.length === 0) return []

  const classes: TauxClasse[] = []
  const groups = Math.min(n, sorted.length)
  for (let i = 0; i < groups; i++) {
    const start = Math.floor((i * sorted.length) / groups)
    const end = Math.floor(((i + 1) * sorted.length) / groups)
    if (end <= start) continue
    classes.push({
      min: sorted[start],
      max: sorted[end - 1],
      count: end - start,
      color: TAUX_PALETTE[Math.round((i * (TAUX_PALETTE.length - 1)) / Math.max(groups - 1, 1))],
    })
  }
  return classes
}

/** Classe d'une valeur : la première dont le maximum la couvre. Null sans taux (pas de classe). */
export function tauxClasseFor(value: number | null | undefined, classes: readonly TauxClasse[]): TauxClasse | null {
  if (value === null || value === undefined || !Number.isFinite(value) || classes.length === 0) return null
  for (const classe of classes) {
    if (value <= classe.max) return classe
  }
  return classes[classes.length - 1]
}

/** Libellé d'une classe au format de la légende : « 15 965 – 38 925 (11) ». */
export function formatTauxClasse(classe: TauxClasse): string {
  const fmt = (n: number) => Math.round(n).toLocaleString("fr-CA")
  return `${fmt(classe.min)} – ${fmt(classe.max)} (${classe.count})`
}
