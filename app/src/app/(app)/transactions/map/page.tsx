import { MapPageClient } from "@/components/map-page-client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"

export const dynamic = "force-dynamic"

export default async function MapPage() {
  const orgId = getCurrentOrganisationId()

  const filtersConfig = await findFiltersByOrganisation(orgId, { includeChamp: true })

  return <MapPageClient filtersConfig={filtersConfig} />
}
