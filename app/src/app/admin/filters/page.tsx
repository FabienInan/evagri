export const dynamic = "force-dynamic"

import { prisma } from "@/lib/prisma"
import { FiltersAdminForm } from "@/components/filters-admin-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Configuration des filtres de recherche</CardTitle>
        <CardDescription>
          Créez, ordonnez et activez les filtres disponibles dans la liste des transactions.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FiltersAdminForm filters={filters} champs={champs} />
      </CardContent>
    </Card>
  )
}
