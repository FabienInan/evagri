import { searchTransactions } from "@/server/actions/transaction"
import { TransactionsPageClient } from "@/components/transactions-page-client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"

export const dynamic = "force-dynamic"

export default async function TransactionsPage() {
  const orgId = getCurrentOrganisationId()

  const [filters, initialData] = await Promise.all([
    findFiltersByOrganisation(orgId, { includeChamp: true }),
    searchTransactions({ page: 1, pageSize: 25 }),
  ])

  return <TransactionsPageClient initialData={initialData} filtersConfig={filters} />
}
