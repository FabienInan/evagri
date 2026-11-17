/**
 * Format des numéros de lots cadastraux, identique à l'import : chiffres, espaces facultatifs
 * (ex. "4 128 182" ou "4128182"). Stocké et envoyé au cadastre sous la forme groupée par trois.
 */
export const NUMERO_LOT_REGEX = /^\d(?:[\d ]*\d)?$/

export function formatNumeroLot(lot: string): string {
  const digits = lot.replace(/\D/g, "")
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
}

/**
 * Boîte englobante approximative du territoire du Québec (degrés décimaux).
 * Sert à refuser les coordonnées saisies à la main qui tombent hors de la province.
 */
export const TERRITOIRE_QUEBEC = {
  latitudeMin: 44.9,
  latitudeMax: 62.7,
  longitudeMin: -79.9,
  longitudeMax: -57.0,
} as const

export function estDansQuebec(latitude: number, longitude: number): boolean {
  const dansBoite =
    latitude >= TERRITOIRE_QUEBEC.latitudeMin &&
    latitude <= TERRITOIRE_QUEBEC.latitudeMax &&
    longitude >= TERRITOIRE_QUEBEC.longitudeMin &&
    longitude <= TERRITOIRE_QUEBEC.longitudeMax
  // La boîte englobe la côte est du Labrador : au nord de 52° N, l'est de -64° O est du Labrador.
  const labrador = latitude >= 52 && longitude > -64
  return dansBoite && !labrador
}
