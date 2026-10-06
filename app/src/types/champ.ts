export const NATURE_CHAMP = ["SAISISSABLE", "CALCULE"] as const
export type NatureChamp = (typeof NATURE_CHAMP)[number]

export const TYPE_DONNEES_CHAMP = ["DECIMAL", "ENTIER", "LISTE", "MULTI_SELECT", "TEXTE", "BOOLEAN", "DATE"] as const
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
  estModifiable: boolean
  actif: boolean
}

/** Fields an administrator can set; est_modifiable is always derived from nature, never sent by the client. */
export type ChampEnrichissableInput = Omit<ChampEnrichissableConfig, "id" | "estModifiable" | "actif">

export interface FicheSection {
  id: string
  nom: string
  ordre: number
  champs: string[]
}
