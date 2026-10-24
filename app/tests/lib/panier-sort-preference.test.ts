import { beforeEach, describe, expect, it } from "vitest"
import {
  loadPanierSort,
  panierSortStorageKey,
  savePanierSort,
} from "@/lib/panier-sort-preference"

class MemoryStorage {
  private data = new Map<string, string>()
  getItem(key: string) {
    return this.data.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.data.set(key, value)
  }
}

describe("panier sort preference", () => {
  beforeEach(() => {
    globalThis.localStorage = new MemoryStorage() as unknown as Storage
  })

  it("isole la clé de tri par panier", () => {
    expect(panierSortStorageKey("p1")).not.toBe(panierSortStorageKey("p2"))
  })

  it("restitue le tri sauvegardé", () => {
    const key = panierSortStorageKey("p1")
    savePanierSort(key, { field: "prix_vente", order: "asc" })
    expect(loadPanierSort(key)).toEqual({ field: "prix_vente", order: "asc" })
  })

  it("retourne null si rien n'est sauvegardé", () => {
    expect(loadPanierSort(panierSortStorageKey("p1"))).toBeNull()
  })

  it("ignore une valeur corrompue", () => {
    const key = panierSortStorageKey("p1")
    globalThis.localStorage.setItem(key, "{not json")
    expect(loadPanierSort(key)).toBeNull()
    globalThis.localStorage.setItem(key, JSON.stringify({ field: "x", order: "sideways" }))
    expect(loadPanierSort(key)).toBeNull()
  })
})
