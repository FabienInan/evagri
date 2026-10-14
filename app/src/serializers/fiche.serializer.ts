import type { ChampEnrichissableConfig, FicheSection } from "@/types/champ"
import type { TypologieOption } from "@/repositories/typologie.repository"
import { serializeTransaction, type SerializedTransaction } from "@/serializers/transaction.serializer"
import type { FicheTransactionRecord } from "@/repositories/fiche.repository"
import { deriveFicheMode, type FicheMode } from "@/lib/fiche"

export interface SerializedFicheDocument {
  id: string
  nomFichier: string
  dateUpload: string
}

/** La fiche expose une unique carte plate `fields` (source + enrichi fusionnés, clés `codeMachine`) plus
 *  `statut`/`mode`, au lieu de l'ancienne scission entre champs source plats et carte `enrichment`. */
export type SerializedFiche = SerializedTransaction & {
  mode: FicheMode
  champs: ChampEnrichissableConfig[]
  sections: FicheSection[]
  typologies: TypologieOption[]
  documents: SerializedFicheDocument[]
}

export function serializeFiche(
  record: FicheTransactionRecord,
  related: {
    champs: ChampEnrichissableConfig[]
    sections: FicheSection[]
    typologies: TypologieOption[]
    documents: SerializedFicheDocument[]
  }
): SerializedFiche {
  const transaction = serializeTransaction(record)
  return {
    ...transaction,
    mode: deriveFicheMode(record.statut),
    champs: related.champs,
    sections: related.sections,
    typologies: related.typologies,
    documents: related.documents,
  }
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
