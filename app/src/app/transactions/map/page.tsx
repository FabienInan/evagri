import { MapPageClient } from "@/components/map-page-client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function MapPage() {
  const orgId = getCurrentOrganisationId()

  const filtersConfig = await prisma.filtreRecherche.findMany({
    where: { organisationId: orgId },
    orderBy: { ordreAffichage: "asc" },
    include: { champEnrichissable: true },
  })

  return <MapPageClient filtersConfig={filtersConfig} />
}
