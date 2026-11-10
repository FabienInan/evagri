import { describe, expect, it } from "vitest"
import { computeTauxClasses, formatTauxClasse, tauxClasseFor, TAUX_PALETTE } from "@/lib/taux-classes"
import { buildMapPoints } from "@/lib/map-export"

describe("computeTauxClasses", () => {
  it("retourne une liste vide sans valeur", () => {
    expect(computeTauxClasses([])).toEqual([])
  })

  it("découpe en classes d'effectifs voisins, de la plus basse à la plus haute", () => {
    const values = Array.from({ length: 50 }, (_, i) => i + 1)
    const classes = computeTauxClasses(values)
    expect(classes.map((c) => c.count)).toEqual([10, 10, 10, 10, 10])
    expect(classes[0].min).toBe(1)
    expect(classes[4].max).toBe(50)
    for (let i = 1; i < classes.length; i++) {
      expect(classes[i].min).toBeGreaterThan(classes[i - 1].max)
    }
  })

  it("attribue les couleurs de la plus claire à la plus foncée", () => {
    const classes = computeTauxClasses(Array.from({ length: 20 }, (_, i) => i))
    expect(classes.map((c) => c.color)).toEqual([...TAUX_PALETTE])
  })

  it("n'ajoute pas de classe vide quand il y a moins de valeurs que de classes", () => {
    const classes = computeTauxClasses([10, 20])
    expect(classes.reduce((sum, c) => sum + c.count, 0)).toBe(2)
    expect(classes.every((c) => c.count > 0)).toBe(true)
  })
})

describe("tauxClasseFor", () => {
  const classes = computeTauxClasses(Array.from({ length: 50 }, (_, i) => i + 1))

  it("range une valeur dans la classe qui la couvre", () => {
    expect(tauxClasseFor(1, classes)?.color).toBe(TAUX_PALETTE[0])
    expect(tauxClasseFor(50, classes)?.color).toBe(TAUX_PALETTE[4])
  })

  it("ne colore pas une transaction sans taux", () => {
    expect(tauxClasseFor(null, classes)).toBeNull()
    expect(tauxClasseFor(undefined, classes)).toBeNull()
    expect(tauxClasseFor(10, [])).toBeNull()
  })
})

describe("formatTauxClasse", () => {
  it("affiche l'intervalle et l'effectif comme la légende de référence", () => {
    const [classe] = computeTauxClasses([15965, 38925])
    expect(formatTauxClasse(classe)).toMatch(/^15\s?965 – 15\s?965 \(1\)$/)
  })
})

describe("buildMapPoints taux", () => {
  it("transporte le taux global, ou null si absent", () => {
    const points = buildMapPoints([
      { id: "a", latitude: 46.1, longitude: -72.1, fields: { taux_global: 1234 } },
      { id: "b", latitude: 46.2, longitude: -72.2, fields: {} },
    ])
    expect(points[0].taux).toBe(1234)
    expect(points[1].taux).toBeNull()
  })
})
