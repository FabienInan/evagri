import { searchTransactions } from "@/server/actions/transaction"
import { TransactionsPageClient } from "@/components/transactions-page-client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"
import { findEnrichmentFieldsByOrganisation } from "@/repositories/enrichment.repository"
import { TRANSACTION_SOURCE_FIELDS } from "@/lib/transaction-source-fields"

export const dynamic = "force-dynamic"

export default async function TransactionsPage() {
  const orgId = getCurrentOrganisationId()

  const [filters, enrichmentFields, initialData] = await Promise.all([
    findFiltersByOrganisation(orgId, { includeChamp: true }),
    findEnrichmentFieldsByOrganisation(orgId),
    searchTransactions({ page: 1, pageSize: 25 }),
  ])

  return (
    <TransactionsPageClient
      initialData={initialData}
      filtersConfig={filters}
      sourceFields={TRANSACTION_SOURCE_FIELDS}
      enrichmentFields={enrichmentFields}
    />
  )
}
