/**
 * Style des <select> natifs : flèche dessinée à 10 px du bord droit (Chrome place la flèche native au bord du champ,
 * le padding ne la déplace pas), et espace réservé pour le texte.
 */
const CHEVRON =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23a1a1aa' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")"

export function selectStyle(paddingLeft: string, paddingRight: string): React.CSSProperties {
  return {
    appearance: "none",
    backgroundImage: CHEVRON,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.625rem center",
    backgroundSize: "1rem",
    paddingLeft,
    paddingRight,
  }
}
