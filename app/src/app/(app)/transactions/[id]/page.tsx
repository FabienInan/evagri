import { notFound } from "next/navigation"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { getEffectiveFicheLayout } from "@/server/fiche-layout"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { findTransactionFiche, listDocuments } from "@/repositories/fiche.repository"
import { serializeDocument, serializeFiche } from "@/serializers/fiche.serializer"
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
    getEffectiveFicheLayout(organisationId),
    listTypologiesByOrganisation(organisationId),
    listDocuments(id),
  ])

  const fiche = serializeFiche(record, {
    champs,
    sections,
    typologies,
    documents: documents.map(serializeDocument),
  })

  return <FicheTransactionClient key={fiche.statut} fiche={fiche} />
}
