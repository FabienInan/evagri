import type { TypeDonneesChamp } from "@/types/champ"
import type { FilterType } from "@/types/filter"

export interface ImportedField {
  /** code_machine (snake_case) : identifiant canonique, clé de `fields` et des règles de calcul. */
  code: string
  /** nom_affichage par défaut du Champ amorcé. */
  label: string
  typeDonnees: TypeDonneesChamp
  typeFiltreRecommande: FilterType
  /** Correspondance d'en-têtes de feuille par système source (§6.5). */
  entetesImport: { JLR: string[]; EXISTANT_EVAGRI: string[] }
  numeric: boolean
  /** Hints d'affichage du tableau de transactions. */
  display: { sortable: boolean; defaultVisible: boolean; minWidth: number; priority: number }
}

export const IMPORTED_FIELDS: ImportedField[] = [
  { code: "numero_inscription", label: "N° d'inscription", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["No d'enregistrement", "No d'enr."] },
    display: { sortable: true, defaultVisible: true, minWidth: 140, priority: 9 } },
  { code: "date_vente", label: "Date de vente", typeDonnees: "DATE", typeFiltreRecommande: "PLAGE_DATE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Date de L'acte", "Date de l'acte ou de l'avant contrat"] },
    display: { sortable: true, defaultVisible: true, minWidth: 130, priority: 8 } },
  { code: "vendeur", label: "Vendeur", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Vendeur"] },
    display: { sortable: true, defaultVisible: false, minWidth: 160, priority: 1 } },
  { code: "acheteur", label: "Acheteur", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Acheteur"] },
    display: { sortable: true, defaultVisible: false, minWidth: 160, priority: 1 } },
  { code: "lots_cadastraux", label: "Lots cadastraux", typeDonnees: "TEXTE_MULTIPLE", typeFiltreRecommande: "NUMERO_LOT", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Lots"] },
    display: { sortable: false, defaultVisible: false, minWidth: 140, priority: 1 } },
  { code: "prix_vente", label: "Prix à l'acte", typeDonnees: "DECIMAL", typeFiltreRecommande: "PLAGE_NUMERIQUE", numeric: true,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Prix de vente", "Prix de vente ($)", "Prixdevente($)"] },
    display: { sortable: true, defaultVisible: true, minWidth: 140, priority: 7 } },
  { code: "mrc", label: "MRC", typeDonnees: "TEXTE", typeFiltreRecommande: "LISTE", numeric: false,
    entetesImport: { JLR: ["MRC"], EXISTANT_EVAGRI: ["MRC"] },
    display: { sortable: true, defaultVisible: true, minWidth: 120, priority: 4 } },
  { code: "municipalite", label: "Municipalité", typeDonnees: "TEXTE", typeFiltreRecommande: "LISTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Ville/Municipalité"] },
    display: { sortable: true, defaultVisible: false, minWidth: 150, priority: 1 } },
  { code: "adresse", label: "Adresse", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Adresse complete", "Adresse complète", "Adresse complette"] },
    display: { sortable: true, defaultVisible: false, minWidth: 200, priority: 1 } },
  { code: "superficie_totale_hectare", label: "Superficie (ha)", typeDonnees: "DECIMAL", typeFiltreRecommande: "PLAGE_NUMERIQUE", numeric: true,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Superficie Totale (ha)", "Superficie totale (ha)"] },
    display: { sortable: true, defaultVisible: true, minWidth: 130, priority: 5 } },
  { code: "latitude", label: "Latitude", typeDonnees: "DECIMAL", typeFiltreRecommande: "ZONE_GEO", numeric: true,
    entetesImport: { JLR: ["Latitude"], EXISTANT_EVAGRI: ["Latitude", "Lat"] },
    display: { sortable: false, defaultVisible: false, minWidth: 110, priority: 1 } },
  { code: "longitude", label: "Longitude", typeDonnees: "DECIMAL", typeFiltreRecommande: "ZONE_GEO", numeric: true,
    entetesImport: { JLR: ["Longitude"], EXISTANT_EVAGRI: ["Longitude", "Long", "Lng"] },
    display: { sortable: false, defaultVisible: false, minWidth: 110, priority: 1 } },
]

export const IMPORTED_FIELD_BY_CODE: Record<string, ImportedField> = Object.fromEntries(
  IMPORTED_FIELDS.map((f) => [f.code, f])
)

export function isImportedFieldCode(code: string | null | undefined): boolean {
  return !!code && Object.hasOwn(IMPORTED_FIELD_BY_CODE, code)
}
