import { describe, it, expect } from "vitest"
import { libelleEntree } from "@/lib/historique"

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
})
