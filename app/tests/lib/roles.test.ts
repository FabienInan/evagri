import { describe, it, expect } from "vitest"
import { isRole, pageAccueil, peutAcceder, ZONES, ZONES_PAR_ROLE } from "@/lib/roles"

// Specification (validated by the product owner): administrateur accède à tout ; évaluateur à la liste des
// transactions, dossiers, paniers et fiches ; développeur à l'import, à la configuration (champs, filtres)
// et à la réinitialisation par courriel.
describe("matrice des rôles", () => {
  it("l'administrateur accède à toutes les zones", () => {
    for (const zone of ZONES) expect(peutAcceder("ADMIN", zone)).toBe(true)
  })

  it("l'évaluateur n'accède qu'à l'évaluation (transactions, dossiers, paniers, fiches)", () => {
    expect(ZONES_PAR_ROLE.EVALUATEUR).toEqual(["evaluation"])
    expect(peutAcceder("EVALUATEUR", "configuration")).toBe(false)
    expect(peutAcceder("EVALUATEUR", "administration")).toBe(false)
  })

  it("le développeur accède à la configuration (import, champs, filtres) mais pas aux transactions", () => {
    expect(ZONES_PAR_ROLE.DEVELOPPEUR).toEqual(["configuration"])
    expect(peutAcceder("DEVELOPPEUR", "evaluation")).toBe(false)
    expect(peutAcceder("DEVELOPPEUR", "administration")).toBe(false)
  })

  it("le développeur n'a jamais la gestion des utilisateurs", () => {
    expect(peutAcceder("DEVELOPPEUR", "administration")).toBe(false)
  })

  it("chaque rôle a une page d'accueil accessible à ce rôle", () => {
    expect(peutAcceder("EVALUATEUR", "evaluation")).toBe(true)
    expect(pageAccueil("EVALUATEUR")).toBe("/transactions")
    expect(pageAccueil("ADMIN")).toBe("/transactions")
    expect(pageAccueil("DEVELOPPEUR")).toBe("/admin/import")
  })

  it("isRole rejette les rôles inconnus", () => {
    expect(isRole("DEVELOPPEUR")).toBe(true)
    expect(isRole("ROOT")).toBe(false)
  })
})
