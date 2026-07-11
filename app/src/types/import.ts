import type Decimal from "decimal.js"

export interface ParsedRow {
  numeroInscription?: string
  dateVente?: string
  vendeur?: string
  acheteur?: string
  lotsCadastraux?: string[]
  prixVente?: number
  mrc?: string
  municipalite?: string
  adresse?: string
  superficieTotaleHectare?: number
}

export interface EnrichmentChamp {
  id: string
  header: string
  codeMachine: string
  typeDonnees: string
}

export interface EnrichmentValueInput {
  champEnrichissableId: string
  valeurNombre?: Decimal | null
  valeurTexte?: string | null
  valeurBooleen?: boolean | null
}

export interface CreateImportedTransactionInput {
  organisationId: string
  importationId?: string
  systemeSource: string
  numeroInscription?: string | null
  dateVente?: Date | null
  prixVente?: number | null
  vendeur?: string | null
  acheteur?: string | null
  lotsCadastraux: string[]
  adresse?: string | null
  municipalite?: string | null
  mrc?: string | null
  superficieTotaleHectare?: number | null
  statut: string
  enrichmentValues: EnrichmentValueInput[]
  typologieValue?: { champEnrichissableId: string; valeurTexte: string } | null
}

export interface ImportSheetResult {
  inserted: number
  ignored: number
  errors: { row: number; message: string }[]
}
