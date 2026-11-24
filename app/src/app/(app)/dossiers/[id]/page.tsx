import { exigerZonePage } from "@/lib/session"
import { notFound } from "next/navigation"
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
  const utilisateur = await exigerZonePage("evaluation")
  const { id } = await params
  const organisationId = utilisateur.organisationId

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
