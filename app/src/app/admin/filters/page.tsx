export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { FiltersAdminForm } from "@/components/filters-admin-form"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"

export default async function FiltersAdminPage() {
  const orgId = getCurrentOrganisationId()

  const [filters, champs] = await Promise.all([
    prisma.filtreRecherche.findMany({
      where: { organisationId: orgId },
      orderBy: { ordreAffichage: "asc" },
      include: { champEnrichissable: true },
    }),
    prisma.champEnrichissable.findMany({ where: { organisationId: orgId } }),
  ])

  return <FiltersAdminForm filters={filters as import("@/types/filter").FilterConfig[]} champs={champs} />
}
