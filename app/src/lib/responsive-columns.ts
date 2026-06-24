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
