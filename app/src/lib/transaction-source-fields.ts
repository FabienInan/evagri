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
