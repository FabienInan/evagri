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
