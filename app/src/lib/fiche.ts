import type { ChampEnrichissableConfig, FicheSection, TypeDonneesChamp } from "@/types/champ"

export type FicheMode = "edition" | "consultation"
export type FicheValeur = string | number | boolean | null

/** codeMachine of the champ that carries the transaction type (§7.5.3). Rendered in the header, not in a section. */
export const TYPE_TRANSACTION_CODE = "typeTransaction"

export interface FicheChamp {
  config: ChampEnrichissableConfig
  valeur: FicheValeur
}

export interface FicheSectionChamps {
  section: FicheSection
  champs: FicheChamp[]
}

export interface FicheViewModel {
  mainSections: FicheSectionChamps[]
  indicateurs: FicheChamp[]
}

export function deriveFicheMode(statut: string | null | undefined): FicheMode {
  return statut === "Analysée" ? "consultation" : "edition"
}

/** An empty applicableATypes means the champ applies everywhere; an unset transaction type disables filtering
 *  so the user can still fill the form (including the mandatory type). */
export function isChampApplicable(champ: { applicableATypes: string[] }, typeCode: string | null): boolean {
  if (!champ.applicableATypes || champ.applicableATypes.length === 0) return true
  if (!typeCode) return true
  return champ.applicableATypes.includes(typeCode)
}

export function buildFicheViewModel(input: {
  sections: FicheSection[]
  champs: ChampEnrichissableConfig[]
  valeurs: Record<string, FicheValeur>
  typeCode: string | null
}): FicheViewModel {
  const byId = new Map(input.champs.map((c) => [c.id, c]))

  const mainSections: FicheSectionChamps[] = []
  for (const section of [...input.sections].sort((a, b) => a.ordre - b.ordre)) {
    const champs: FicheChamp[] = []
    for (const id of section.champs) {
      const config = byId.get(id)
      if (!config) continue
      if (config.nature !== "SAISISSABLE") continue
      if (config.codeMachine === TYPE_TRANSACTION_CODE) continue
      if (!config.actif || !config.estAffiche) continue
      if (!isChampApplicable(config, input.typeCode)) continue
      champs.push({ config, valeur: input.valeurs[config.codeMachine] ?? null })
    }
    if (champs.length > 0) mainSections.push({ section, champs })
  }

  const indicateurs: FicheChamp[] = input.champs
    .filter((c) => c.nature === "CALCULE" && c.actif && c.estAffiche && isChampApplicable(c, input.typeCode))
    .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
    .map((config) => ({ config, valeur: input.valeurs[config.codeMachine] ?? null }))

  return { mainSections, indicateurs }
}

export function formatFicheValue(typeDonnees: TypeDonneesChamp, valeur: FicheValeur): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—"
  switch (typeDonnees) {
    case "BOOLEAN":
      return valeur ? "Oui" : "Non"
    case "DATE":
      return new Date(String(valeur)).toLocaleDateString("fr-CA")
    case "DECIMAL":
      return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(Number(valeur))
    case "ENTIER":
      return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(Number(valeur))
    default:
      return String(valeur)
  }
}

export function formatSourceFieldValue(
  field: { column: string; typeDonnees: TypeDonneesChamp; array?: boolean },
  transaction: Record<string, unknown>
): string {
  const raw = transaction[field.column]
  if (field.array) {
    const list = Array.isArray(raw) ? raw : []
    return list.length > 0 ? list.join(", ") : "—"
  }
  if (raw === null || raw === undefined || raw === "") return "—"
  return formatFicheValue(field.typeDonnees, raw as FicheValeur)
}
