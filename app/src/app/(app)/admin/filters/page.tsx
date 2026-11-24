export const dynamic = "force-dynamic"

import { exigerZonePage } from "@/lib/session"
import { FiltersAdminForm } from "@/components/filters-admin-form"
import { findChampsByOrganisation, findFiltersByOrganisation } from "@/repositories/filters.repository"

export default async function FiltersAdminPage() {
  const utilisateur = await exigerZonePage("configuration")
  const orgId = utilisateur.organisationId

  const [filters, champs] = await Promise.all([
    findFiltersByOrganisation(orgId),
    findChampsByOrganisation(orgId),
  ])

  return <FiltersAdminForm filters={filters as import("@/types/filter").FilterConfig[]} champs={champs} />
}
