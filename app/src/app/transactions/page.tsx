import { searchTransactions } from "@/server/actions/transaction"
import { TransactionsPageClient } from "@/components/transactions-page-client"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { prisma } from "@/lib/prisma"

export const dynamic = "force-dynamic"

export default async function TransactionsPage() {
  const orgId = getCurrentOrganisationId()

  const [filters, initialData] = await Promise.all([
    prisma.filtreRecherche.findMany({
      where: { organisationId: orgId },
      orderBy: { ordreAffichage: "asc" },
      include: { champEnrichissable: true },
    }),
    searchTransactions({ page: 1, pageSize: 25 }),
  ])

  return <TransactionsPageClient initialData={initialData} filtersConfig={filters} />
}
