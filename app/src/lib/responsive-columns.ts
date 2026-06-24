export type ResponsiveColumn = {
  key: string
  minWidth: number
  priority: number
}

export function computeVisibleColumns(
  columns: ResponsiveColumn[],
  containerWidth: number,
  requiredKeys: string[] = []
): Set<string> {
  const sorted = [...columns].sort((a, b) => b.priority - a.priority)
  let used = 0
  const visible = new Set<string>()

  for (const key of requiredKeys) {
    const col = columns.find((c) => c.key === key)
    if (col) {
      visible.add(key)
      used += col.minWidth
    }
  }

  for (const col of sorted) {
    if (visible.has(col.key)) continue
    if (used + col.minWidth <= containerWidth) {
      visible.add(col.key)
      used += col.minWidth
    } else {
      break
    }
  }

  return visible
}

const STORAGE_KEY = "evagri:transaction-table:visible-columns"

export function loadColumnPreference(): string[] | null {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return null
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((k) => typeof k === "string")) {
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function saveColumnPreference(keys: string[]) {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
}

export function clearColumnPreference() {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return
  globalThis.localStorage.removeItem(STORAGE_KEY)
}
