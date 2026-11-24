import { describe, it, expect } from "vitest"
import { detailsEntree, formaterModification, formaterValeur, libelleEntree } from "@/lib/historique"

describe("libellé des entrées d'historique", () => {
  it("décrit une fiche enregistrée avec les champs modifiés, sans leurs valeurs", () => {
    expect(libelleEntree({ tableCible: "transaction", action: "SAVE_FICHE", diff: { champsModifies: "PRIX_VENTE, COMMENTAIRE" } }))
      .toBe("Fiche enregistrée : PRIX_VENTE, COMMENTAIRE")
    expect(libelleEntree({ tableCible: "transaction", action: "SAVE_FICHE", diff: { champsModifies: "" } }))
      .toBe("Fiche enregistrée (aucun champ modifié)")
  })

  it("distingue l'analyse et la réouverture", () => {
    expect(libelleEntree({ tableCible: "transaction", action: "STATUT", diff: { statut: "ANALYSEE" } })).toBe("Passée à « Analysée »")
    expect(libelleEntree({ tableCible: "transaction", action: "STATUT", diff: { statut: "NON_ANALYSEE" } })).toBe("Repassée à « Non analysée »")
  })

  it("nomme les documents ajoutés et supprimés", () => {
    expect(libelleEntree({ tableCible: "document_acte", action: "INSERT", diff: { nomFichier: "acte.pdf" } })).toBe("Document ajouté : acte.pdf")
    expect(libelleEntree({ tableCible: "document_acte", action: "DELETE", diff: { nomFichier: "acte.pdf" } })).toBe("Document supprimé : acte.pdf")
  })

  it("décrit les paniers et les dossiers", () => {
    expect(libelleEntree({ tableCible: "panier", action: "UPDATE", diff: { tauxCroissancePct: 3.25 } })).toBe("Taux de croissance : 3.25 %")
    expect(libelleEntree({ tableCible: "panier_transaction", action: "INSERT", diff: { ajoutees: 2 } })).toBe("2 transaction(s) ajoutée(s) au panier")
    expect(libelleEntree({ tableCible: "dossier", action: "INSERT", diff: { numeroDossier: "25-12-001" } })).toBe("Dossier créé (n° 25-12-001)")
  })

  it("ne lève jamais : une entrée inconnue reste lisible", () => {
    expect(libelleEntree({ tableCible: "importation", action: "RETRY", diff: null })).toBe("RETRY (importation)")
  })

  it("formate les valeurs : nombre, texte avec libellé, liste, oui/non, date, vide", () => {
    const vide = { nombre: null, texte: null, multiple: [], booleen: null, date: null }
    expect(formaterValeur({ ...vide, nombre: 250000 })).toBe("250000")
    expect(formaterValeur({ ...vide, texte: "TERRES_BOISEES" }, new Map([["TERRES_BOISEES", "Terres boisées"]]))).toBe("Terres boisées")
    expect(formaterValeur({ ...vide, multiple: ["a", "b"] })).toBe("a, b")
    expect(formaterValeur({ ...vide, booleen: false })).toBe("Non")
    expect(formaterValeur({ ...vide, date: new Date("2026-01-15T00:00:00Z") })).toBe("2026-01-15")
    expect(formaterValeur(null)).toBe("vide")
    expect(formaterValeur({ ...vide, texte: "x".repeat(300) }).length).toBeLessThanOrEqual(120)
  })

  it("présente chaque modification sur une ligne « libellé : ancienne → nouvelle »", () => {
    expect(formaterModification("Prix de vente", "100000", "250000")).toBe("Prix de vente : 100000 → 250000")
    const entree = { tableCible: "transaction", action: "SAVE_FICHE", diff: { modifications: ["Prix de vente : 1 → 2", "Vendeur : vide → Alice"] } }
    expect(detailsEntree(entree)).toEqual(["Prix de vente : 1 → 2", "Vendeur : vide → Alice"])
    expect(libelleEntree(entree)).toBe("Fiche enregistrée (2 modifications)")
  })

  it("décrit l'ancien et le nouveau taux de croissance d'un panier", () => {
    const entree = { tableCible: "panier", action: "UPDATE", diff: { tauxCroissancePct: 4, ancienTauxCroissancePct: 3.25 } }
    expect(detailsEntree(entree)).toEqual(["Taux de croissance : 3.25 % → 4 %"])
    expect(libelleEntree(entree)).toBe("Taux de croissance : 3.25 % → 4 %")
  })
})
