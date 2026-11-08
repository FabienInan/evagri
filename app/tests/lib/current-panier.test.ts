import { afterEach, describe, expect, it, vi } from "vitest"
import {
  CURRENT_PANIER_STORAGE_KEY,
  parseCurrentPanier,
  readCurrentPanierRaw,
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
  it("relit le contexte enregistré, noms compris", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() })

    saveCurrentPanier({ dossierId: "dossier-1", dossierNumero: "25-12-001", panierId: "panier-1", panierNom: "Comparables" })

    expect(parseCurrentPanier(readCurrentPanierRaw())).toEqual({
      dossierId: "dossier-1",
      dossierNumero: "25-12-001",
      panierId: "panier-1",
      panierNom: "Comparables",
    })
  })

  it("accepte un dossier choisi sans panier", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() })

    saveCurrentPanier({ dossierId: "dossier-1", panierId: "" })

    expect(parseCurrentPanier(readCurrentPanierRaw())).toEqual({
      dossierId: "dossier-1",
      dossierNumero: undefined,
      panierId: "",
      panierNom: undefined,
    })
  })

  it("efface le contexte quand on le remet à null", () => {
    vi.stubGlobal("window", { localStorage: fakeStorage() })

    saveCurrentPanier({ dossierId: "d", panierId: "p" })
    saveCurrentPanier(null)

    expect(readCurrentPanierRaw()).toBeNull()
  })

  it("retourne null quand aucun contexte n'est mémorisé", () => {
    expect(parseCurrentPanier(null)).toBeNull()
  })

  it("ignore un contenu JSON malformé", () => {
    expect(parseCurrentPanier("{not json")).toBeNull()
  })

  it("ignore un contexte incomplet", () => {
    expect(parseCurrentPanier(JSON.stringify({ dossierId: "d" }))).toBeNull()
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

    expect(readCurrentPanierRaw()).toBeNull()
    expect(() => saveCurrentPanier({ dossierId: "d", panierId: "p" })).not.toThrow()
  })

  it("lit la clé de stockage attendue", () => {
    vi.stubGlobal("window", {
      localStorage: fakeStorage({ [CURRENT_PANIER_STORAGE_KEY]: JSON.stringify({ dossierId: "d", panierId: "" }) }),
    })

    expect(parseCurrentPanier(readCurrentPanierRaw())?.dossierId).toBe("d")
  })
})
