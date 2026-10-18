/**
 * Moves the item `fromId` to insertion slot `toIndex` and renumbers `ordreAffichage` to the resulting
 * positions (0-based). `toIndex` is a slot in the current display order: 0 inserts before the first
 * item, `items.length` appends after the last. Returns the list unchanged when the id is missing.
 */
export function moveItemToIndex<T extends { id: string; ordreAffichage: number }>(
  items: T[],
  fromId: string,
  toIndex: number
): T[] {
  const fromIndex = items.findIndex((i) => i.id === fromId)
  if (fromIndex === -1) return items

  const ordered = [...items]
  const [moved] = ordered.splice(fromIndex, 1)
  // Slot computed against the list including the moved item: past its old position it shifts down by one.
  const insertAt = Math.max(0, Math.min(toIndex > fromIndex ? toIndex - 1 : toIndex, ordered.length))
  ordered.splice(insertAt, 0, moved)
  return ordered.map((item, index) => ({ ...item, ordreAffichage: index }))
}
