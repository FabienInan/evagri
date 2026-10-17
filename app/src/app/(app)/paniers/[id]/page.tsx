import { notFound } from "next/navigation"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findPanierById, listTransactionsOfPanier } from "@/repositories/dossier.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import { PanierView } from "@/components/dossier/panier-view"

export const dynamic = "force-dynamic"

export default async function PanierPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const organisationId = getCurrentOrganisationId()

  const panier = await findPanierById(organisationId, id)
  if (!panier) notFound()

  const [transactions, champs] = await Promise.all([
    listTransactionsOfPanier(id),
    listChampsEnrichissablesByOrganisation(organisationId),
  ])

  return (
    <PanierView
      panierId={id}
      nom={panier.nom}
      transactions={transactions.map(serializeTransaction)}
      importedFields={IMPORTED_FIELDS}
      champs={champs}
    />
  )
}
