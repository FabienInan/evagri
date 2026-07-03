export const dynamic = "force-dynamic"

import { FiltersAdminForm } from "@/components/filters-admin-form"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findChampsByOrganisation, findFiltersByOrganisation } from "@/repositories/filters.repository"

export default async function FiltersAdminPage() {
  const orgId = getCurrentOrganisationId()

  const [filters, champs] = await Promise.all([
    findFiltersByOrganisation(orgId, { includeChamp: true }),
    findChampsByOrganisation(orgId),
  ])

  return <FiltersAdminForm filters={filters as import("@/types/filter").FilterConfig[]} champs={champs} />
}
