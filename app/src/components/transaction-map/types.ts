import type { MapTransaction as RepoMapTransaction } from "@/repositories/transaction.repository"

export type MapTransaction = {
  id: RepoMapTransaction["id"]
  numeroInscription: RepoMapTransaction["numeroInscription"]
  dateVente: string | null
  prixVente: number | null
  superficieTotaleHectare: number | null
  latitude: number
  longitude: number
  municipalite: RepoMapTransaction["municipalite"]
}
