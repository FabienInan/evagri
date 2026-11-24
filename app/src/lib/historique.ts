/** Human-readable French label of one journal entry, for the history panel. Pure: no server import. */
export function libelleEntree(entree: { tableCible: string; action: string; diff: unknown }): string {
  const diff = (entree.diff && typeof entree.diff === "object" ? entree.diff : {}) as Record<string, unknown>
  const texte = (valeur: unknown) => (typeof valeur === "string" || typeof valeur === "number" ? String(valeur) : "")

  switch (`${entree.tableCible}:${entree.action}`) {
    case "transaction:SAVE_FICHE": {
      const champs = texte(diff.champsModifies)
      return champs ? `Fiche enregistrée : ${champs}` : "Fiche enregistrée (aucun champ modifié)"
    }
    case "transaction:STATUT":
      return diff.statut === "ANALYSEE" ? "Passée à « Analysée »" : "Repassée à « Non analysée »"
    case "document_acte:INSERT":
      return `Document ajouté${texte(diff.nomFichier) ? ` : ${texte(diff.nomFichier)}` : ""}`
    case "document_acte:DELETE":
      return `Document supprimé${texte(diff.nomFichier) ? ` : ${texte(diff.nomFichier)}` : ""}`
    case "dossier:INSERT":
      return `Dossier créé${texte(diff.numeroDossier) ? ` (n° ${texte(diff.numeroDossier)})` : ""}`
    case "dossier:UPDATE":
      return "Dossier modifié"
    case "panier:INSERT":
      return `Panier créé${texte(diff.nom) ? ` : ${texte(diff.nom)}` : ""}`
    case "panier:UPDATE":
      return diff.tauxCroissancePct !== undefined
        ? `Taux de croissance : ${texte(diff.tauxCroissancePct)} %`
        : "Panier modifié"
    case "panier:DELETE":
      return "Panier supprimé"
    case "panier_transaction:INSERT":
      return `${texte(diff.ajoutees) || "0"} transaction(s) ajoutée(s) au panier`
    case "panier_transaction:DELETE":
      return "Transaction retirée du panier"
    default:
      return `${entree.action} (${entree.tableCible})`
  }
}
