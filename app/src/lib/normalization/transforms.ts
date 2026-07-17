import { cleanText, toKey } from "./mappings"

const TOPOGRAPHY_MAP: Record<string, string> = {
  plane: "Plane",
  plat: "Plane",
  "relativement plane": "Plane",
  "legere declivite": "Légère déclivité",
  "faible declivite": "Légère déclivité",
  "legere pente": "Légère déclivité",
  "faible pente": "Légère déclivité",
  declivite: "Déclivité modérée",
  pente: "Déclivité modérée",
  "declivite importante": "Déclivité modérée",
  "pente importante": "Déclivité modérée",
  "declivite moderee": "Déclivité modérée",
  montagne: "Déclivité modérée",
  "forte pente": "Forte déclivité",
  "forte declivite": "Forte déclivité",
  "tres forte pente": "Forte déclivité",
}

export function normalizeTopography(value: unknown) {
  const raw = cleanText(value) ?? ""
  const lower = raw.toLowerCase()
  const matchedKeys = Object.keys(TOPOGRAPHY_MAP).filter((k) => lower.includes(k))
  const hasCombination = /[,;/&]|\set\s|\(/.test(raw) || matchedKeys.length > 1
  const normalized = TOPOGRAPHY_MAP[toKey(value)] ?? raw
  return { normalized, hasCombination, detail: hasCombination ? raw : null }
}

const FR_MAP: Record<string, string> = {
  f: "Feuillus",
  feuillus: "Feuillus",
  feuillu: "Feuillus",
  feuillis: "Feuillus",
  r: "Résineux",
  resineux: "Résineux",
  résineux: "Résineux",
  m: "Mixte",
  mf: "Mixte",
  mr: "Mixte",
  mixte: "Mixte",
}

export function normalizeFeuillusResineux(value: unknown, proportionFeuillus: number | null): string | null {
  if (proportionFeuillus !== null && !isNaN(proportionFeuillus)) {
    if (proportionFeuillus < 0.4) return "Résineux"
    if (proportionFeuillus <= 0.6) return "Mixte"
    return "Feuillus"
  }
  const raw = cleanText(value) ?? ""
  if (!raw) return null
  const withoutQualifier = raw
    .replace(/mixte\s*\(?dominance.*\)?/i, "Mixte")
    .replace(/mixte\s+feuillus/i, "Mixte")
    .replace(/mixte\s+resineux/i, "Mixte")
  return FR_MAP[toKey(withoutQualifier)] ?? withoutQualifier
}

const OUI_VALUES = new Set([
  "oui", "ouii", "oui partie", "majeure partie", "oui principalement",
  "oui majoritairement", "principalement",
])

const PARTIEL_VALUES = new Set([
  "partiel", "partielle", "en partie", "un tiers", "0.5",
])

const NON_VALUES = new Set(["non", "non dispo", "aucune", "0"])

const AUTH_REGEX = /\b\d{5,6}\b/g

export function normalizeZoneAgricoleCptaq(value: unknown) {
  const raw = String(value ?? "").trim()
  if (!raw) return { zone: null as string | null, autorisations: null as string[] | null }

  const autorisations = [...raw.matchAll(AUTH_REGEX)].map((m) => m[0])
  const remaining = raw
    .replace(AUTH_REGEX, " ")
    .replace(/[;:,/\s]+/g, " ")
    .trim()
    .toLowerCase()

  if (remaining === "" || remaining === "-") {
    return { zone: null, autorisations: autorisations.length ? autorisations : null }
  }
  if (NON_VALUES.has(remaining)) return { zone: "Non", autorisations: autorisations.length ? autorisations : null }
  if (OUI_VALUES.has(remaining)) return { zone: "Oui", autorisations: autorisations.length ? autorisations : null }
  if (PARTIEL_VALUES.has(remaining)) return { zone: "Partiel", autorisations: autorisations.length ? autorisations : null }
  return { zone: null, autorisations: autorisations.length ? autorisations : null }
}

const CULTURE_MAP: Record<string, string> = {
  foin: "Prairie",
  prairie: "Prairie",
  mais: "Cultures annuelles",
  "mais-grain": "Cultures annuelles",
  "mais fourrager": "Cultures annuelles",
  soya: "Cultures annuelles",
  soja: "Cultures annuelles",
  avoine: "Cultures annuelles",
  ble: "Cultures annuelles",
  orge: "Cultures annuelles",
  cereales: "Cultures annuelles",
  vigne: "Vigne",
  vignoble: "Vigne",
  arboriculture: "Arboriculture",
  verger: "Arboriculture",
  maraichage: "Maraîchage",
  "petits fruits": "Petits fruits",
  horticulture: "Horticulture",
}

export function normalizeTypeCulture(value: unknown): string | null {
  const raw = cleanText(value) ?? ""
  if (!raw) return null
  const tokens = raw.split(/[,;/&]| et /i).map((s) => s.trim()).filter(Boolean)
  const mapped = tokens.map((t) => CULTURE_MAP[toKey(t)] ?? "Autres").filter(Boolean)
  return [...new Set(mapped)].sort().join(" / ") || null
}

const SOL_MAP: Record<string, string> = {
  argileux: "Argileux",
  argile: "Argileux",
  "argilo-limoneux": "Argilo-limoneux",
  limoneux: "Limoneux",
  loam: "Loam",
  "loam argileux": "Loam argileux",
  "loam limoneux": "Loam limoneux",
  "loam sableux": "Loam sableux",
  sableux: "Sableux",
  graveleux: "Graveleux",
  "terre noire": "Terre noire (organique)",
}

export function normalizeTypeSol(value: unknown): string | null {
  const raw = cleanText(value) ?? ""
  if (!raw) return null
  const tokens = raw.split(/[,;/&]| et /i).map((s) => s.trim()).filter(Boolean)
  const mapped = tokens.map((t) => SOL_MAP[toKey(t)] ?? null).filter((v): v is string => Boolean(v))
  return [...new Set(mapped)].sort().join(" / ") || null
}

export function normalizeDensitePlantation(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const raw = String(value).replace(/\s/g, "").replace(/,/g, ".").replace(/%/g, "")
  const rangeMatch = raw.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/)
  if (rangeMatch) {
    const a = parseFloat(rangeMatch[1])
    const b = parseFloat(rangeMatch[2])
    if (isNaN(a) || isNaN(b)) return null
    const median = (a + b) / 2
    return a > 1 && b <= 100 ? median / 100 : median
  }
  const single = parseFloat(raw)
  return isNaN(single) ? null : single
}

export function discretizeProportion(value: unknown): number | null {
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/\s/g, "").replace(",", "."))
  if (isNaN(n)) return null
  const decimal = n > 1 ? n / 100 : n
  return Math.round(decimal * 20) / 20
}
