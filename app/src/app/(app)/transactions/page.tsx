import { exigerZonePage } from "@/lib/session"
import { searchTransactions } from "@/server/actions/transaction"
import { TransactionsPageClient } from "@/components/transactions-page-client"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"

export const dynamic = "force-dynamic"

export default async function TransactionsPage() {
  const utilisateur = await exigerZonePage("evaluation")
  const orgId = utilisateur.organisationId

  const [filters, champs, initialData] = await Promise.all([
    findFiltersByOrganisation(orgId),
    listChampsEnrichissablesByOrganisation(orgId),
    searchTransactions({ page: 1, pageSize: 25 }),
  ])

  return (
    <TransactionsPageClient
      initialData={initialData}
      filtersConfig={filters}
      importedFields={IMPORTED_FIELDS}
      champs={champs}
    />
  )
}
