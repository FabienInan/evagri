/**
 * Champs semés uniquement pour la suite e2e. Les codes `e2e_*` et les noms « E2E … » servent de marqueurs
 * que `cleanup()` reconnaît pour supprimer ces lignes sans toucher aux champs réels de l'organisation.
 *
 * Les cinq codes `superficie_*` ne portent volontairement pas le préfixe : `lib/fiche.ts` rattache les règles
 * V-001/V-002/V-005 à leurs codes par normalisation (voir SUPERFICIE_ROOTS), donc un préfixe casserait le
 * rattachement. Ils sont malgré tout listés explicitement dans ENRICH_TEST_CODES pour le nettoyage.
 */

export type TestChamp = {
  codeMachine: string
  nomAffichage: string
  typeDonnees: string
  nature: "SAISISSABLE" | "CALCULE"
  unite: string
  optionsListe?: string[]
  regleCalcul?: string
  plageMin?: number
  plageMax?: number
  estObligatoire?: boolean
  estLectureSeule?: boolean
  ordreAffichage: number
}

export const ENRICH_TEST_CHAMPS: TestChamp[] = [
  { codeMachine: "superficie_cultivee", nomAffichage: "Superficie cultivée test", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "ha", ordreAffichage: 100 },
  { codeMachine: "superficie_boisee", nomAffichage: "Superficie boisée test", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "ha", ordreAffichage: 101 },
  { codeMachine: "superficie_constructible", nomAffichage: "Superficie constructible test", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "ha", ordreAffichage: 102 },
  { codeMachine: "superficie_drainee", nomAffichage: "Superficie drainée test", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "ha", ordreAffichage: 103 },
  { codeMachine: "superficie_acericole", nomAffichage: "Superficie acéricole test", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "ha", ordreAffichage: 104 },
  { codeMachine: "e2e_taux_zone_humide", nomAffichage: "Taux zone humide test", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "%", ordreAffichage: 105 },
  { codeMachine: "e2e_champ_obligatoire", nomAffichage: "Champ obligatoire test", typeDonnees: "TEXTE", nature: "SAISISSABLE", unite: "N/A", estObligatoire: true, ordreAffichage: 106 },
  { codeMachine: "e2e_champ_plage", nomAffichage: "Champ plage test", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "kg", plageMin: 0, plageMax: 10, ordreAffichage: 107 },
  { codeMachine: "e2e_champ_negatif", nomAffichage: "Champ négatif test", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "ha", ordreAffichage: 108 },
  { codeMachine: "e2e_indicateur", nomAffichage: "Indicateur test", typeDonnees: "ENTIER", nature: "CALCULE", unite: "$/ha", regleCalcul: "prix_vente / superficie_totale_hectare", estLectureSeule: true, ordreAffichage: 109 },
  { codeMachine: "e2e_champ_texte", nomAffichage: "Texte test", typeDonnees: "TEXTE", nature: "SAISISSABLE", unite: "N/A", ordreAffichage: 110 },
  { codeMachine: "e2e_champ_liste", nomAffichage: "Liste test", typeDonnees: "LISTE", nature: "SAISISSABLE", unite: "N/A", optionsListe: ["Alpha", "Beta"], ordreAffichage: 111 },
  { codeMachine: "e2e_champ_multi", nomAffichage: "Multi test", typeDonnees: "MULTI_SELECT", nature: "SAISISSABLE", unite: "N/A", optionsListe: ["X", "Y"], ordreAffichage: 112 },
  { codeMachine: "e2e_champ_booleen", nomAffichage: "Booléen test", typeDonnees: "BOOLEAN", nature: "SAISISSABLE", unite: "N/A", ordreAffichage: 113 },
  { codeMachine: "e2e_champ_date", nomAffichage: "Date test", typeDonnees: "DATE", nature: "SAISISSABLE", unite: "N/A", ordreAffichage: 114 },
  { codeMachine: "e2e_champ_decimal", nomAffichage: "Décimal test", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "ha", ordreAffichage: 115 },
]

/** Champs cibles des scénarios d'ajout de filtres ; aucun filtre semé ne les référence. */
export const FILTER_TEST_CHAMPS: TestChamp[] = [
  { codeMachine: "e2e_filtre_texte", nomAffichage: "E2E Filtre texte", typeDonnees: "TEXTE", nature: "SAISISSABLE", unite: "N/A", ordreAffichage: 120 },
  { codeMachine: "e2e_filtre_nombre", nomAffichage: "E2E Filtre nombre", typeDonnees: "DECIMAL", nature: "SAISISSABLE", unite: "$", ordreAffichage: 121 },
]

export const ENRICH_TEST_CODES: string[] = ENRICH_TEST_CHAMPS.map((c) => c.codeMachine)
export const FILTER_TEST_CODES: string[] = FILTER_TEST_CHAMPS.map((c) => c.codeMachine)
export const ALL_TEST_CODES: string[] = [...ENRICH_TEST_CODES, ...FILTER_TEST_CODES]
