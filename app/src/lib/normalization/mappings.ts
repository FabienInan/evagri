export function cleanText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && value === 0) return null
  const cleaned = String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[,;:\/\\-]+$/, "")
    .trim()
  return cleaned || null
}

export function toKey(value: unknown): string {
  const cleaned = cleanText(value)
  return cleaned ? cleaned.toLowerCase() : ""
}

// Particules françaises qui restent en minuscule sauf en tête de valeur (ex: "Saint-Jean-sur-Richelieu")
const LOWERCASE_PARTICLES = new Set(["de", "du", "des", "la", "le", "les", "et", "sur", "en", "aux", "au"])

function capitalizeWord(word: string): string {
  if (!word) return word
  // Préserve les acronymes déjà tout en majuscule (ex: "MRC", "CPTAQ")
  if (word.length <= 5 && word === word.toUpperCase() && /[A-ZÀ-Ý]/.test(word)) return word
  const apostropheIdx = word.indexOf("'")
  if (apostropheIdx !== -1 && apostropheIdx < word.length - 1) {
    const prefix = word.slice(0, apostropheIdx + 1)
    const rest = word.slice(apostropheIdx + 1)
    return (
      prefix.charAt(0).toUpperCase() +
      prefix.slice(1).toLowerCase() +
      rest.charAt(0).toUpperCase() +
      rest.slice(1).toLowerCase()
    )
  }
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

// Normalise la casse (ex: "weeton"/"WEETON"/"Weeton" -> "Weeton") pour dédupliquer les variantes de casse
export function normalizeCase(value: string): string {
  const parts = value.split(/(\s+|-)/)
  let wordIndex = 0
  return parts
    .map((part) => {
      if (part === "" || /^(\s+|-)$/.test(part)) return part
      const isFirstWord = wordIndex === 0
      wordIndex++
      const lower = part.toLowerCase()
      if (!isFirstWord && LOWERCASE_PARTICLES.has(lower)) return lower
      return capitalizeWord(part)
    })
    .join("")
}
