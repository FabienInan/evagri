import type { FilterInput } from "@/types/filter"

export type SerializedValue = string | number | boolean | string[] | null

export type SerializedTransaction = {
  id: string
  statut: string
  fields: Record<string, SerializedValue>
  latitude: number | null
  longitude: number | null
  importationId: string | null
  createdAt: string
}

export interface TransactionSearchInput {
  page?: number
  pageSize?: number
  filters?: FilterInput[]
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

/** Position de la fiche courante dans la liste filtrée, pour la navigation contextuelle. */
export interface TransactionNavigation {
  prevId: string | null
  nextId: string | null
  index: number
  total: number
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
