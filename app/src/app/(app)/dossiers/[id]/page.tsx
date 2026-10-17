import { notFound } from "next/navigation"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findDossierById, listPaniersByDossier } from "@/repositories/dossier.repository"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { serializeDossier, serializePanier } from "@/serializers/dossier.serializer"
import { DossierDetailClient } from "@/components/dossier/dossier-detail-client"

export const dynamic = "force-dynamic"

export default async function DossierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const organisationId = getCurrentOrganisationId()

  const dossier = await findDossierById(organisationId, id)
  if (!dossier) notFound()

  const [paniers, typologies] = await Promise.all([
    listPaniersByDossier(organisationId, id),
    listTypologiesByOrganisation(organisationId),
  ])

  return (
    <DossierDetailClient
      dossier={serializeDossier(dossier)}
      paniers={paniers.map(serializePanier)}
      typologies={typologies}
    />
  )
}
