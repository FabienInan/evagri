import { notFound } from "next/navigation"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findPanierById, listTransactionsOfPanier } from "@/repositories/dossier.repository"
import { listAnalysesByDossier } from "@/repositories/analyse-dossier.repository"
import { serializeAnalyse } from "@/serializers/analyse-dossier.serializer"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import { PanierView } from "@/components/dossier/panier-view"
import { Breadcrumb } from "@/components/breadcrumb"

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

  const [transactions, champs, analyses] = await Promise.all([
    listTransactionsOfPanier(organisationId, id),
    listChampsEnrichissablesByOrganisation(organisationId),
    listAnalysesByDossier(organisationId, panier.dossierId),
  ])

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Dossiers", href: "/dossiers" },
          { label: panier.dossier.numeroDossier, href: `/dossiers/${panier.dossierId}` },
          { label: panier.nom },
        ]}
      />
      <PanierView
        panierId={id}
        nom={panier.nom}
        transactions={transactions.map(serializeTransaction)}
        importedFields={IMPORTED_FIELDS}
        champs={champs}
        analyses={analyses.map(serializeAnalyse)}
      />
    </>
  )
}
