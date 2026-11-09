import type { TypeDonneesChamp } from "@/types/champ"

/**
 * Colonnes affichées pour chaque type de transaction, dans la liste d'un panier et dans son export Excel.
 *
 * - `kind: "champ"` : valeur lue dans `fields` ; la clé est un codeMachine, résolu par `resolvePanierFieldCode`
 *   si le nom exact n'existe pas en base.
 * - `kind: "ajuste"` : indicateur calculé à partir de la date d'évaluation du dossier et du taux du panier
 *   (`computeAdjustedValues`) ; la clé est celle de cet indicateur.
 */
export interface PanierColumnSpec {
  key: string
  label: string
  kind: "champ" | "ajuste"
  typeDonnees: TypeDonneesChamp
}

const champ = (key: string, label: string, typeDonnees: TypeDonneesChamp = "TEXTE"): PanierColumnSpec => ({
  key,
  label,
  kind: "champ",
  typeDonnees,
})

const ajuste = (key: string, label: string, typeDonnees: TypeDonneesChamp = "ENTIER"): PanierColumnSpec => ({
  key,
  label,
  kind: "ajuste",
  typeDonnees,
})

/** Socle commun à tous les types : identification, vente et superficie totale. */
const COMMUN: PanierColumnSpec[] = [
  champ("numero_inscription", "N° d'inscription"),
  champ("lots_cadastraux", "Numéros de lots (cadastre)", "TEXTE_MULTIPLE"),
  champ("date_vente", "Date de vente", "DATE"),
  champ("prix_vente", "Prix de vente", "DECIMAL"),
  ajuste("prix_actualise", "Prix de vente ajusté", "DECIMAL"),
  champ("adresse", "Adresse complète"),
  champ("superficie_totale_hectare", "Superficie (ha)", "DECIMAL"),
]

/** Codes de type = `Typologie.code` (voir seed). */
export const PANIER_COLUMNS_BY_TYPE: Record<string, PanierColumnSpec[]> = {
  TERRES_CULTIVEES: [
    ...COMMUN,
    champ("superficie_cultive_ha", "Superficie cultivée (ha)", "DECIMAL"),
    champ("terres_drainees", "Superficie drainée (%)", "ENTIER"),
    champ("superficie_boise_ha", "Superficie boisée (ha)", "DECIMAL"),
    champ("topographie", "Topographie"),
    champ("classe_de_sol_dominante", "Classe de sol dominante"),
    champ("type_de_sol", "Type de sol", "MULTI_SELECT"),
    champ("observations", "Observations"),
    ajuste("taux_global_ajuste", "Taux global ajusté ($/ha)"),
    ajuste("taux_residuel_cultive_ajuste", "Taux résiduel ajusté ($/ha)"),
  ],
  TERRES_BOISEES: [
    ...COMMUN,
    champ("superficie_boise_ha", "Superficie boisée (ha)", "DECIMAL"),
    champ("peuplement_feuillu", "Proportion de feuillus (%)", "ENTIER"),
    champ("densite_plantation", "Densité de plantation", "DECIMAL"),
    champ("superficie_acricole_ha", "Superficie acéricole (ha)", "DECIMAL"),
    champ("zones_humides_potentielles", "Superficie zone humide (%)", "ENTIER"),
    champ("zones_humides_types", "Zone humide (type)"),
    champ("observations", "Observations"),
    ajuste("taux_global_ajuste", "Taux global ajusté ($/ha)"),
  ],
  ERABLIERES: [
    ...COMMUN,
    champ("peuplement_feuillu", "Proportion de feuillus (%)", "ENTIER"),
    champ("densite_plantation", "Densité de plantation", "DECIMAL"),
    champ("superficie_acricole_ha", "Superficie acéricole (ha)", "DECIMAL"),
    champ("nombre_dentailles", "Nombre d'entailles", "ENTIER"),
    champ("quotas_livres", "Quotas (livres)", "DECIMAL"),
    champ("batiments_agricoles", "Bâtiments"),
    champ("equipements", "Équipements"),
    ajuste("taux_global_ajuste", "Taux global ajusté ($/ha)"),
    ajuste("taux_par_entaille_ajuste", "Taux par entaille ajusté ($/entaille)"),
  ],
  FERME: [
    ...COMMUN,
    champ("batiments_agricoles", "Bâtiments"),
    champ("maisons", "Maison(s)"),
    champ("superficie_cultive_ha", "Superficie cultivée (ha)", "DECIMAL"),
    champ("superficie_boise_ha", "Superficie boisée (ha)", "DECIMAL"),
    ajuste("taux_residuel_cultive_ajuste", "Taux résiduel ajusté ($/ha)"),
  ],
  BATIMENTS_AGRICOLES: [
    ...COMMUN,
    champ("batiments_agricoles", "Bâtiments"),
    champ("superficie_cultive_ha", "Superficie cultivée (ha)", "DECIMAL"),
    champ("superficie_boise_ha", "Superficie boisée (ha)", "DECIMAL"),
    ajuste("taux_residuel_batiment_ajuste", "Taux résiduel ajusté ($/pi²)"),
  ],
}

/** Colonnes du type, ou null si le panier n'a pas de type connu (affichage par défaut conservé). */
export function panierColumnsForType(typeCode: string | null): PanierColumnSpec[] | null {
  if (!typeCode) return null
  return PANIER_COLUMNS_BY_TYPE[typeCode] ?? null
}

/** Forme comparable : sans accents, minuscules, sans séparateurs ni ponctuation. */
export function normalizeFieldCode(code: string): string {
  return code
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

/** Vrai si les deux chaînes diffèrent d'au plus une insertion, suppression ou substitution. */
export function isWithinOneEdit(a: string, b: string): boolean {
  if (a === b) return true
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > 1) return false
  let i = 0
  let j = 0
  let edits = 0
  while (i < la && j < lb) {
    if (a[i] === b[j]) {
      i++
      j++
      continue
    }
    edits++
    if (edits > 1) return false
    if (la > lb) i++
    else if (lb > la) j++
    else {
      i++
      j++
    }
  }
  edits += (la - i) + (lb - j)
  return edits <= 1
}

/**
 * Trouve le champ réel correspondant à une clé de colonne. Ordre : nom exact, puis forme normalisée
 * (casse, accents, séparateurs), puis une seule lettre d'écart. Un résultat ambigu ou absent renvoie null.
 */
export function resolvePanierFieldCode(key: string, candidates: readonly string[]): string | null {
  if (candidates.includes(key)) return key

  const target = normalizeFieldCode(key)
  const normalized = candidates.filter((code) => normalizeFieldCode(code) === target)
  if (normalized.length >= 1) return normalized[0]

  const near = candidates.filter((code) => isWithinOneEdit(normalizeFieldCode(code), target))
  return near.length === 1 ? near[0] : null
}

/** Codes réels disponibles : champs de la base, catalogue importé et clés présentes dans les transactions. */
export function collectFieldCodes(
  champs: readonly { codeMachine: string }[],
  importedCodes: readonly string[],
  transactions: readonly { fields: Record<string, unknown> }[]
): string[] {
  const codes = new Set<string>([...champs.map((c) => c.codeMachine), ...importedCodes])
  for (const transaction of transactions) {
    for (const code of Object.keys(transaction.fields)) codes.add(code)
  }
  return [...codes]
}
