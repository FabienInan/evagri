import type { ChampInput } from "@/server/actions/champs"
import type { ChampEnrichissableConfig, NatureChamp, TypeDonneesChamp } from "@/types/champ"

export const NATURE_LABELS: Record<NatureChamp, string> = {
  IMPORTE: "Importé",
  SAISISSABLE: "Saisissable",
  CALCULE: "Calculé",
}

export const TYPE_DONNEES_LABELS: Record<TypeDonneesChamp, string> = {
  DECIMAL: "Décimal",
  ENTIER: "Entier",
  LISTE: "Liste",
  MULTI_SELECT: "Liste (choix multiple)",
  TEXTE: "Texte",
  TEXTE_MULTIPLE: "Texte (choix multiple)",
  BOOLEAN: "Booléen",
  DATE: "Date",
}

export const NUMERIC_TYPES: TypeDonneesChamp[] = ["DECIMAL", "ENTIER"]

export function isNumericType(type: TypeDonneesChamp): boolean {
  return NUMERIC_TYPES.includes(type)
}

export function emptyDraft(): ChampInput {
  return {
    codeMachine: "",
    nomAffichage: "",
    typeDonnees: "DECIMAL",
    nature: "SAISISSABLE",
    unite: "",
    plageMin: null,
    plageMax: null,
    optionsListe: null,
    regleCalcul: null,
    applicableATypes: [],
    ordreAffichage: 0,
    estAffiche: true,
    estObligatoire: false,
    estLectureSeule: false,
  }
}

export function toDraft(champ: ChampEnrichissableConfig): ChampInput {
  return {
    codeMachine: champ.codeMachine,
    nomAffichage: champ.nomAffichage,
    typeDonnees: champ.typeDonnees,
    nature: champ.nature,
    unite: champ.unite,
    plageMin: champ.plageMin,
    plageMax: champ.plageMax,
    optionsListe: champ.optionsListe,
    regleCalcul: champ.regleCalcul,
    applicableATypes: champ.applicableATypes,
    ordreAffichage: champ.ordreAffichage,
    estAffiche: champ.estAffiche,
    estObligatoire: champ.estObligatoire,
    estLectureSeule: champ.estLectureSeule,
  }
}
