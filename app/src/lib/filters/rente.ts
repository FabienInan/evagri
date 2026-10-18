import type { FilterInput } from "@/types/filter"

export function findRenteFilter(filters: FilterInput[]): FilterInput | undefined {
  return filters.find((f) => f.typeFiltre === "REVENTE")
}

/**
 * Reorders already-sorted transactions so that those linked by a shared duplicated lot are contiguous —
 * a vente and its revente(s) end up one after the other. Linked means sharing any lot from `duplicatedLots`
 * (the lots sold ≥ 2 times), transitively: a transaction carrying two resold lots bridges both groups, so
 * chains stay together instead of splitting. Input order is preserved within a group, and groups are emitted
 * by the position of their best-ranked member, so the caller's sort still drives the overall order. Rows are
 * never duplicated: a transaction stays on a single line.
 */
export function orderRenteTransactions<T extends { id: string; lotsCadastraux: string[] }>(
  transactions: T[],
  duplicatedLots: Set<string>
): T[] {
  const n = transactions.length
  if (n === 0) return transactions

  const parent = Array.from({ length: n }, (_, i) => i)
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]]
      i = parent[i]
    }
    return i
  }
  const union = (a: number, b: number) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent[rb] = ra
  }

  const lotOwner = new Map<string, number>()
  for (let i = 0; i < n; i++) {
    for (const lot of transactions[i].lotsCadastraux) {
      if (!duplicatedLots.has(lot)) continue
      const owner = lotOwner.get(lot)
      if (owner === undefined) lotOwner.set(lot, i)
      else union(i, owner)
    }
  }

  const groups = new Map<number, T[]>()
  const rootsInOrder: number[] = []
  for (let i = 0; i < n; i++) {
    const root = find(i)
    let group = groups.get(root)
    if (!group) {
      group = []
      groups.set(root, group)
      rootsInOrder.push(root)
    }
    group.push(transactions[i])
  }

  return rootsInOrder.flatMap((root) => groups.get(root)!)
}
