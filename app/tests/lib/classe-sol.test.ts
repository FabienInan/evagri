import { describe, expect, it } from "vitest"
import {
  SOUS_CLASSE_OPTIONS,
  normalizeSousClasse,
  normalizeEnrichmentText,
} from "@/lib/normalization/transforms"
import { ENRICHMENT_CHAMP_CATALOG } from "@/lib/enrichment-champ-catalog"

describe("classe de sol dominante", () => {
  it("accepte une lettre admise, en majuscule ou minuscule, avec espaces", () => {
    expect(normalizeSousClasse("C")).toBe("C")
    expect(normalizeSousClasse("w")).toBe("W")
    expect(normalizeSousClasse(" d ")).toBe("D")
  })

  it("traite les deux lettres dans un ordre indifférent : CD et DC sont le même code", () => {
    expect(normalizeSousClasse("CD")).toBe("CD")
    expect(normalizeSousClasse("DC")).toBe("CD")
    expect(normalizeSousClasse("dc")).toBe("CD")
    expect(normalizeSousClasse("2-W")).toBeNull()
  })

  it("refuse ce qui n'est pas une lettre admise, sans rien inventer", () => {
    expect(normalizeSousClasse("A")).toBeNull()
    expect(normalizeSousClasse("2")).toBeNull()
    expect(normalizeSousClasse("O-")).toBeNull()
    expect(normalizeSousClasse("CDX")).toBeNull()
    expect(normalizeSousClasse("CC")).toBeNull()
    expect(normalizeSousClasse("")).toBeNull()
    expect(normalizeSousClasse(null)).toBeNull()
  })

  it("liste fermée : 13 lettres et 78 combinaisons distinctes", () => {
    expect(SOUS_CLASSE_OPTIONS).toHaveLength(91)
    expect(new Set(SOUS_CLASSE_OPTIONS).size).toBe(91)
    expect(SOUS_CLASSE_OPTIONS).toContain("CD")
    expect(SOUS_CLASSE_OPTIONS).not.toContain("DC")
    expect(SOUS_CLASSE_OPTIONS).not.toContain("CC")
  })

  it("le catalogue du champ enrichissable est une LISTE avec ces options", () => {
    const def = ENRICHMENT_CHAMP_CATALOG.sousclasse_dominante
    expect(def.typeDonnees).toBe("LISTE")
    expect(def.optionsListe).toEqual(SOUS_CLASSE_OPTIONS)
  })

  it("à l'import, une valeur reconnue est canonisée et une valeur inconnue est conservée", () => {
    expect(normalizeEnrichmentText("sousclasse_dominante", "dc")).toBe("CD")
    expect(normalizeEnrichmentText("sousclasse_dominante", "FPW")).toBe("FPW")
    // La classe de sol n'a pas encore de règle : elle n'est jamais modifiée à l'import.
    expect(normalizeEnrichmentText("classe_de_sol_dominante", "dc")).toBe("dc")
    expect(normalizeEnrichmentText("classe_de_sol_dominante", "2")).toBe("2")
  })
})
