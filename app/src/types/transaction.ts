import type { EnrichmentValues, SerializedTransaction } from "@/serializers/transaction.serializer"

export interface TransactionSearchInput {
  page?: number
  pageSize?: number
  filters?: import("@/types/filter").FilterInput[]
  sortField?: string
  sortOrder?: "asc" | "desc"
}

export interface TransactionSearchResult {
  transactions: SerializedTransaction[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface MapTransactionDTO {
  id: string
  numeroInscription: string | null
  dateVente: string | null
  prixVente: number | null
  superficieTotaleHectare: number | null
  latitude: number | null
  longitude: number | null
  municipalite: string | null
}

export { type EnrichmentValues }
