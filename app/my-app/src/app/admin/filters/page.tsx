export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { FiltersAdminForm } from "@/components/filters-admin-form"

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ""

export default async function FiltersAdminPage() {
  const [filters, champs] = await Promise.all([
    prisma.filtreRecherche.findMany({
      where: { organisationId: DEFAULT_ORG_ID },
      orderBy: { ordreAffichage: "asc" },
      include: { champEnrichissable: true },
    }),
    prisma.champEnrichissable.findMany({ where: { organisationId: DEFAULT_ORG_ID } }),
  ])

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Configuration des filtres de recherche</h1>
      <FiltersAdminForm filters={filters} champs={champs} />
    </main>
  )
}
