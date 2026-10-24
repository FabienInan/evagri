import { describe, it, expect } from "vitest"
import { warnSuperficieCoherence } from "@/lib/validation"

const base = {
  superficieTotaleHectare: 100,
  superficieCultivee: 40,
  superficieBoisee: 50,
  superficieConstructible: 5,
}

describe("W-001 : cohérence superficie totale / composantes", () => {
  it("ne signale rien quand l'écart est inférieur ou égal à 10 %", () => {
    expect(warnSuperficieCoherence({ ...base, superficieCultivee: 40, superficieBoisee: 50, superficieConstructible: 0 })).toEqual([])
    expect(warnSuperficieCoherence({ ...base, superficieCultivee: 40, superficieBoisee: 55, superficieConstructible: 0 })).toEqual([])
  })

  it("signale un écart supérieur à 10 %", () => {
    const [w] = warnSuperficieCoherence({ ...base, superficieCultivee: 40, superficieBoisee: 40, superficieConstructible: 0 })
    expect(w.code).toBe("W-001")
    expect(w.champ).toBeNull()
  })

  it("signale aussi quand la somme dépasse la totale", () => {
    expect(warnSuperficieCoherence({ ...base, superficieCultivee: 80, superficieBoisee: 40, superficieConstructible: 0 })).toHaveLength(1)
  })

  it("ne signale rien sans superficie totale ou sans composante", () => {
    expect(warnSuperficieCoherence({ ...base, superficieTotaleHectare: null })).toEqual([])
    expect(warnSuperficieCoherence({ ...base, superficieTotaleHectare: 0 })).toEqual([])
    expect(
      warnSuperficieCoherence({
        superficieTotaleHectare: 100,
        superficieCultivee: null,
        superficieBoisee: null,
        superficieConstructible: null,
      })
    ).toEqual([])
  })
})
