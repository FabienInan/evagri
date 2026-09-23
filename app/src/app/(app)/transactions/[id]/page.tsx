import { notFound } from "next/navigation"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { findFicheLayout } from "@/repositories/fiche-layout.repository"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { findTransactionFiche, listDocuments } from "@/repositories/fiche.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { serializeDocument, type SerializedFiche } from "@/serializers/fiche.serializer"
import { deriveFicheMode } from "@/lib/fiche"
import { FicheTransactionClient } from "@/components/fiche/fiche-transaction"

export const dynamic = "force-dynamic"

export default async function FicheTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const organisationId = getCurrentOrganisationId()

  const record = await findTransactionFiche(organisationId, id)
  if (!record) notFound()

  const [champs, sections, typologies, documents] = await Promise.all([
    listChampsEnrichissablesByOrganisation(organisationId),
    findFicheLayout(organisationId),
    listTypologiesByOrganisation(organisationId),
    listDocuments(id),
  ])

  const statut = record.enrichie?.statut ?? "A analyser"
  const fiche: SerializedFiche = {
    transaction: serializeTransaction(record),
    champs,
    sections,
    typologies,
    documents: documents.map(serializeDocument),
    statut,
    mode: deriveFicheMode(statut),
  }

  return <FicheTransactionClient key={statut} fiche={fiche} />
}
