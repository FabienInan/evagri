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

export function loadColumnPreference(storageKey: string = STORAGE_KEY): string[] | null {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return null
  try {
    const raw = globalThis.localStorage.getItem(storageKey)
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

export function saveColumnPreference(keys: string[], storageKey: string = STORAGE_KEY) {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return
  globalThis.localStorage.setItem(storageKey, JSON.stringify(keys))
}

export function clearColumnPreference(storageKey: string = STORAGE_KEY) {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return
  globalThis.localStorage.removeItem(storageKey)
}

const ORDER_STORAGE_KEY = "evagri:transaction-table:column-order"

export function loadColumnOrder(storageKey: string = ORDER_STORAGE_KEY): string[] | null {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return null
  try {
    const raw = globalThis.localStorage.getItem(storageKey)
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

export function saveColumnOrder(order: string[], storageKey: string = ORDER_STORAGE_KEY) {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return
  globalThis.localStorage.setItem(storageKey, JSON.stringify(order))
}

export function clearColumnOrder(storageKey: string = ORDER_STORAGE_KEY) {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return
  globalThis.localStorage.removeItem(storageKey)
}

export const MIN_COLUMN_WIDTH = 60
export const MAX_COLUMN_WIDTH = 2000

/** Bounds a dragged column width so a column can neither be collapsed to nothing nor grown without limit. */
export function clampColumnWidth(
  width: number,
  min: number = MIN_COLUMN_WIDTH,
  max: number = MAX_COLUMN_WIDTH
): number {
  if (!Number.isFinite(width)) return min
  return Math.min(Math.max(Math.round(width), min), max)
}

const WIDTHS_STORAGE_KEY = "evagri:transaction-table:column-widths"

function isWidthMap(value: unknown): value is Record<string, number> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((v) => typeof v === "number" && Number.isFinite(v))
  )
}

export function loadColumnWidths(
  storageKey: string = WIDTHS_STORAGE_KEY
): Record<string, number> | null {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return null
  try {
    const raw = globalThis.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return isWidthMap(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function saveColumnWidths(
  widths: Record<string, number>,
  storageKey: string = WIDTHS_STORAGE_KEY
) {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return
  globalThis.localStorage.setItem(storageKey, JSON.stringify(widths))
}

export function clearColumnWidths(storageKey: string = WIDTHS_STORAGE_KEY) {
  if (typeof globalThis.localStorage === "undefined" || !globalThis.localStorage) return
  globalThis.localStorage.removeItem(storageKey)
}
