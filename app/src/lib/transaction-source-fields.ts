import type { TypeDonneesChamp } from "@/types/champ"
import type { FilterType } from "@/types/filter"

export interface TransactionSourceField {
  key: string
  label: string
  numeric: boolean
  sortable: boolean
  defaultVisible: boolean
  minWidth: number
  priority: number
}

export const TRANSACTION_SOURCE_FIELDS: TransactionSourceField[] = [
  { key: "numeroInscription", label: "N° d'inscription", numeric: false, sortable: true, defaultVisible: true, minWidth: 140, priority: 9 },
  { key: "dateVente", label: "Date de vente", numeric: false, sortable: true, defaultVisible: true, minWidth: 130, priority: 8 },
  { key: "vendeur", label: "Vendeur", numeric: false, sortable: true, defaultVisible: false, minWidth: 160, priority: 1 },
  { key: "acheteur", label: "Acheteur", numeric: false, sortable: true, defaultVisible: false, minWidth: 160, priority: 1 },
  { key: "lotsCadastraux", label: "Lots cadastraux", numeric: false, sortable: false, defaultVisible: false, minWidth: 140, priority: 1 },
  { key: "mrc", label: "MRC", numeric: false, sortable: true, defaultVisible: true, minWidth: 120, priority: 4 },
  { key: "municipalite", label: "Municipalité", numeric: false, sortable: true, defaultVisible: false, minWidth: 150, priority: 1 },
  { key: "adresse", label: "Adresse", numeric: false, sortable: true, defaultVisible: false, minWidth: 200, priority: 1 },
  { key: "superficieTotaleHectare", label: "Superficie (ha)", numeric: true, sortable: true, defaultVisible: true, minWidth: 130, priority: 5 },
  { key: "prixVente", label: "Prix à l'acte", numeric: true, sortable: true, defaultVisible: true, minWidth: 140, priority: 7 },
  { key: "latitude", label: "Latitude", numeric: true, sortable: false, defaultVisible: false, minWidth: 110, priority: 1 },
  { key: "longitude", label: "Longitude", numeric: true, sortable: false, defaultVisible: false, minWidth: 110, priority: 1 },
]

/** Descriptor of a raw TransactionSource column. One entry per column of the table (§6.4). */
export interface SourceField {
  /** Canonical snake_case identifier (§7.3.2): used in regle_calcul and as the filter's code_machine. */
  code: string
  /** Matching property on the Prisma TransactionSource model. */
  column: string
  label: string
  typeDonnees: TypeDonneesChamp
  typeFiltreRecommande: FilterType
  /** true for a multi-valued column (String[]): excluded from rule-calculation codes. */
  array?: boolean
}

export const SOURCE_FIELDS: SourceField[] = [
  { code: "numero_inscription", column: "numeroInscription", label: "N° d'inscription", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE" },
  { code: "date_vente", column: "dateVente", label: "Date de vente", typeDonnees: "DATE", typeFiltreRecommande: "PLAGE_DATE" },
  { code: "prix_vente", column: "prixVente", label: "Prix à l'acte", typeDonnees: "DECIMAL", typeFiltreRecommande: "PLAGE_NUMERIQUE" },
  { code: "vendeur", column: "vendeur", label: "Vendeur", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE" },
  { code: "acheteur", column: "acheteur", label: "Acheteur", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE" },
  { code: "lots_cadastraux", column: "lotsCadastraux", label: "Lots cadastraux", typeDonnees: "TEXTE", typeFiltreRecommande: "NUMERO_LOT", array: true },
  { code: "adresse", column: "adresse", label: "Adresse", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE" },
  { code: "municipalite", column: "municipalite", label: "Municipalité", typeDonnees: "TEXTE", typeFiltreRecommande: "LISTE" },
  { code: "mrc", column: "mrc", label: "MRC", typeDonnees: "TEXTE", typeFiltreRecommande: "LISTE" },
  { code: "superficie_totale_hectare", column: "superficieTotaleHectare", label: "Superficie (ha)", typeDonnees: "DECIMAL", typeFiltreRecommande: "PLAGE_NUMERIQUE" },
]

/** Snake_case identifiers usable inside a regle_calcul: every scalar source column, minus the array ones. */
export const SOURCE_FIELD_CODES = SOURCE_FIELDS.filter((f) => !f.array).map((f) => f.code)

export const SOURCE_FIELD_BY_CODE: Record<string, SourceField> = Object.fromEntries(
  SOURCE_FIELDS.map((f) => [f.code, f])
)

export function isSourceFieldCode(code: string | null | undefined): boolean {
  return !!code && code in SOURCE_FIELD_BY_CODE
}

export function sourceColumnOf(code: string): string | undefined {
  return SOURCE_FIELD_BY_CODE[code]?.column
}
