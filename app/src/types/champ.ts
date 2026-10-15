export const NATURE_CHAMP = ["IMPORTE", "SAISISSABLE", "CALCULE"] as const
export type NatureChamp = (typeof NATURE_CHAMP)[number]

export const TYPE_DONNEES_CHAMP = ["DECIMAL", "ENTIER", "LISTE", "MULTI_SELECT", "TEXTE", "TEXTE_MULTIPLE", "BOOLEAN", "DATE"] as const
export type TypeDonneesChamp = (typeof TYPE_DONNEES_CHAMP)[number]

/** LISTE and MULTI_SELECT both draw their values from `optionsListe`; MULTI_SELECT stores several of them. */
export const OPTION_TYPES: TypeDonneesChamp[] = ["LISTE", "MULTI_SELECT"]

export function hasOptions(typeDonnees: TypeDonneesChamp): boolean {
  return OPTION_TYPES.includes(typeDonnees)
}

/** Mirrors the ChampEnrichissable Prisma model (§6.5 du cahier des charges). */
export interface ChampEnrichissableConfig {
  id: string
  codeMachine: string
  nomAffichage: string
  typeDonnees: TypeDonneesChamp
  nature: NatureChamp
  unite: string
  plageMin: number | null
  plageMax: number | null
  optionsListe: string[] | null
  regleCalcul: string | null
  applicableATypes: string[]
  ordreAffichage: number
  estAffiche: boolean
  estObligatoire: boolean
  typeFiltreRecommande: string | null
  estLectureSeule: boolean
  actif: boolean
}

/** Fields an administrator can set. est_lecture_seule is optional: when omitted it is derived from nature
 *  (IMPORTE/CALCULE => true); when supplied it is honored, so an admin can re-open an IMPORTE champ. */
export type ChampEnrichissableInput = Omit<
  ChampEnrichissableConfig,
  "id" | "estLectureSeule" | "actif" | "typeFiltreRecommande"
> & {
  estLectureSeule?: boolean
}

export interface FicheSection {
  id: string
  nom: string
  ordre: number
  champs: string[]
}
