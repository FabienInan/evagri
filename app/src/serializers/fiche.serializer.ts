import type { ChampEnrichissableConfig, FicheSection } from "@/types/champ"
import type { TypologieOption } from "@/repositories/typologie.repository"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"
import type { FicheMode } from "@/lib/fiche"

export interface SerializedFicheDocument {
  id: string
  nomFichier: string
  dateUpload: string
}

export interface SerializedFiche {
  transaction: SerializedTransaction
  champs: ChampEnrichissableConfig[]
  sections: FicheSection[]
  typologies: TypologieOption[]
  documents: SerializedFicheDocument[]
  statut: string
  mode: FicheMode
}

export function serializeDocument(doc: {
  id: string
  nomFichier: string
  dateUpload: Date
}): SerializedFicheDocument {
  return {
    id: doc.id,
    nomFichier: doc.nomFichier,
    dateUpload: doc.dateUpload.toISOString(),
  }
}
