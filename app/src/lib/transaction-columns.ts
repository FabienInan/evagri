import type { DataTableColumn } from "@/types/table"
import type { SerializedTransaction } from "@/types/transaction"
import type { ChampEnrichissableConfig } from "@/types/champ"
import { isImportedFieldCode, type ImportedField } from "@/lib/imported-fields"
import { formatCellValue } from "@/lib/format"

function isNumericType(typeDonnees: string): boolean {
  return typeDonnees === "DECIMAL" || typeDonnees === "ENTIER"
}

/**
 * Colonnes de champs partagées par la liste des transactions et le panier : d'abord le catalogue
 * `IMPORTED_FIELDS` (clé = codeMachine), puis les champs enrichissables non importés. Les deux lisent la
 * même carte plate `row.fields` et le même formatage canonique.
 */
export function buildTransactionFieldColumns(input: {
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
}): DataTableColumn<SerializedTransaction>[] {
  const { importedFields, champs } = input

  const importedCols: DataTableColumn<SerializedTransaction>[] = importedFields.map((field) => ({
    key: field.code,
    label: field.label,
    numeric: field.numeric,
    sortable: field.display.sortable,
    defaultVisible: field.display.defaultVisible,
    minWidth: field.display.minWidth,
    priority: field.display.priority,
    render: (row) => formatCellValue(row.fields[field.code], field.typeDonnees),
  }))

  const champCols: DataTableColumn<SerializedTransaction>[] = champs
    .filter((champ) => champ.actif && !isImportedFieldCode(champ.codeMachine))
    .map((champ) => ({
      key: champ.codeMachine,
      label: champ.nomAffichage,
      numeric: isNumericType(champ.typeDonnees),
      defaultVisible: false,
      minWidth: 130,
      priority: 1,
      render: (row) => formatCellValue(row.fields[champ.codeMachine], champ.typeDonnees),
    }))

  return [...importedCols, ...champCols]
}
