import { exigerZonePage } from "@/lib/session"
import { MapPageClient } from "@/components/map-page-client"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"

export const dynamic = "force-dynamic"

export default async function MapPage() {
  const utilisateur = await exigerZonePage("evaluation")
  const orgId = utilisateur.organisationId

  const filtersConfig = await findFiltersByOrganisation(orgId)

  return <MapPageClient filtersConfig={filtersConfig} />
}
