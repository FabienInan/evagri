/** A stored value, read back in plain types so the history can show it. */
export type ValeurAffichee = {
  nombre: number | null
  texte: string | null
  multiple: string[]
  booleen: boolean | null
  date: Date | null
}

const LONGUEUR_MAX_VALEUR = 120

function tronquer(texte: string): string {
  return texte.length > LONGUEUR_MAX_VALEUR ? `${texte.slice(0, LONGUEUR_MAX_VALEUR - 1)}…` : texte
}

/**
 * Text of a stored value for the history. `libelles` turns a stored code into its display name (for example the
 * transaction type). An absent value reads « vide ».
 */
export function formaterValeur(valeur: ValeurAffichee | null, libelles?: ReadonlyMap<string, string>): string {
  if (!valeur) return "vide"
  if (valeur.nombre !== null) return String(valeur.nombre)
  if (valeur.texte !== null && valeur.texte !== "") return tronquer(libelles?.get(valeur.texte) ?? valeur.texte)
  if (valeur.multiple.length > 0) return tronquer(valeur.multiple.join(", "))
  if (valeur.booleen !== null) return valeur.booleen ? "Oui" : "Non"
  if (valeur.date !== null) return valeur.date.toISOString().slice(0, 10)
  return "vide"
}

/** One line of the history: « libellé : ancienne → nouvelle ». */
export function formaterModification(libelle: string, ancienne: string, nouvelle: string): string {
  return tronquer(`${libelle} : ${ancienne} → ${nouvelle}`)
}

/** Detail lines of an entry (what exactly changed), when the entry recorded it. */
export function detailsEntree(entree: { tableCible: string; action: string; diff: unknown }): string[] {
  const diff = (entree.diff && typeof entree.diff === "object" ? entree.diff : {}) as Record<string, unknown>
  if (Array.isArray(diff.modifications)) return diff.modifications.filter((m): m is string => typeof m === "string")
  if (entree.tableCible === "panier" && entree.action === "UPDATE" && typeof diff.ancienTauxCroissancePct !== "undefined") {
    return [`Taux de croissance : ${String(diff.ancienTauxCroissancePct)} % → ${String(diff.tauxCroissancePct)} %`]
  }
  return []
}

/** Human-readable French label of one journal entry, for the history panel. Pure: no server import. */
export function libelleEntree(entree: { tableCible: string; action: string; diff: unknown }): string {
  const diff = (entree.diff && typeof entree.diff === "object" ? entree.diff : {}) as Record<string, unknown>
  const texte = (valeur: unknown) => (typeof valeur === "string" || typeof valeur === "number" ? String(valeur) : "")

  switch (`${entree.tableCible}:${entree.action}`) {
    case "transaction:SAVE_FICHE": {
      const modifications = detailsEntree(entree)
      if (modifications.length > 0) return `Fiche enregistrée (${modifications.length} modification${modifications.length > 1 ? "s" : ""})`
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
        ? detailsEntree(entree)[0] ?? `Taux de croissance : ${texte(diff.tauxCroissancePct)} %`
        : "Panier modifié"
    case "panier:DELETE":
      return "Panier supprimé"
    case "panier_transaction:INSERT":
      return `${texte(diff.ajoutees) || "0"} transaction(s) ajoutée(s) au panier`
    case "panier_transaction:DELETE":
      return texte(diff.numeroInscription)
        ? `Transaction ${texte(diff.numeroInscription)} retirée du panier`
        : "Transaction retirée du panier"
    default:
      return `${entree.action} (${entree.tableCible})`
  }
}
