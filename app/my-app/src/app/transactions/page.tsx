import { prisma } from "@/lib/prisma"
import { searchTransactions } from "@/server/actions/transaction"
import { TransactionsPageClient } from "@/components/transactions-page-client"

export const dynamic = "force-dynamic"

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ""

export default async function TransactionsPage() {
  const [filters, initialData] = await Promise.all([
    prisma.filtreRecherche.findMany({
      where: { organisationId: DEFAULT_ORG_ID },
      orderBy: { ordreAffichage: "asc" },
      include: { champEnrichissable: true },
    }),
    searchTransactions({ page: 1 }),
  ])

  return <TransactionsPageClient initialData={initialData} filtersConfig={filters} />
}
