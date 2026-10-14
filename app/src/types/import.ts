import type Decimal from "decimal.js"

export interface ParsedRow {
  numero_inscription?: string
  date_vente?: string
  vendeur?: string
  acheteur?: string
  lots_cadastraux?: string[]
  prix_vente?: number
  mrc?: string
  municipalite?: string
  adresse?: string
  superficie_totale_hectare?: number
  latitude?: number
  longitude?: number
}

export interface EnrichmentChamp {
  id: string
  header: string
  codeMachine: string
  typeDonnees: string
}

export interface EnrichmentValueInput {
  champId: string
  valeurNombre?: Decimal | null
  valeurTexte?: string | null
  valeurTexteMultiple?: string[]
  valeurBooleen?: boolean | null
  valeurDate?: Date | null
}

export interface CreateImportedTransactionInput {
  organisationId: string
  importationId?: string
  systemeSource: string
  statut: string
  enrichmentValues: EnrichmentValueInput[]
  typologieValue?: { champId: string; valeurTexte: string } | null
}

export interface ImportSheetResult {
  inserted: number
  ignored: number
  errors: { row: number; message: string }[]
}
