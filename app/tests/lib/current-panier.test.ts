import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CURRENT_PANIER_STORAGE_KEY,
  readCurrentPanier,
  saveCurrentPanier,
} from "@/lib/current-panier"

function fakeStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, value)
    },
    removeItem: (key: string) => {
      data.delete(key)
    },
    clear: () => data.clear(),
    key: (index: number) => [...data.keys()][index] ?? null,
    get length() {
      return data.size
    },
  } as Storage
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("current panier", () => {
  it("relit le contexte enregistré", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() })

    saveCurrentPanier({ dossierId: "dossier-1", panierId: "panier-1" })

    expect(readCurrentPanier()).toEqual({ dossierId: "dossier-1", panierId: "panier-1" })
  })

  it("retourne null quand aucun contexte n'est mémorisé", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() })

    expect(readCurrentPanier()).toBeNull()
  })

  it("ignore un contenu JSON malformé", () => {
    vi.stubGlobal("window", {
      localStorage: fakeStorage({ [CURRENT_PANIER_STORAGE_KEY]: "{not json" }),
    })

    expect(readCurrentPanier()).toBeNull()
  })

  it("ignore un contexte incomplet", () => {
    vi.stubGlobal("window", {
      localStorage: fakeStorage({ [CURRENT_PANIER_STORAGE_KEY]: JSON.stringify({ dossierId: "d" }) }),
    })

    expect(readCurrentPanier()).toBeNull()
  })

  it("ne lève pas quand le stockage est indisponible", () => {
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => {
          throw new Error("quota")
        },
        setItem: () => {
          throw new Error("quota")
        },
      },
    })

    expect(readCurrentPanier()).toBeNull()
    expect(() => saveCurrentPanier({ dossierId: "d", panierId: "p" })).not.toThrow()
  })
})
