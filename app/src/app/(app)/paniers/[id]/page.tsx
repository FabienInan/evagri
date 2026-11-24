import { exigerZonePage } from "@/lib/session"
import { notFound } from "next/navigation"
import { findPanierById, listTransactionsOfPanier } from "@/repositories/dossier.repository"
import { serializePanier } from "@/serializers/dossier.serializer"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import { PanierView } from "@/components/dossier/panier-view"
import { Breadcrumb } from "@/components/breadcrumb"
import { HistoriqueBouton } from "@/components/historique/historique-bouton"

export const dynamic = "force-dynamic"

export default async function PanierPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const utilisateur = await exigerZonePage("evaluation")
  const { id } = await params
  const organisationId = utilisateur.organisationId

  const panier = await findPanierById(organisationId, id)
  if (!panier) notFound()

  const [transactions, champs] = await Promise.all([
    listTransactionsOfPanier(organisationId, id),
    listChampsEnrichissablesByOrganisation(organisationId),
  ])
  const serialized = serializePanier(panier)
  // Localisation du dossier : son pin jaune figure sur la carte exportée du panier.
  const dossierLocalisation =
    panier.dossier.latitude !== null && panier.dossier.longitude !== null
      ? {
          numeroDossier: panier.dossier.numeroDossier,
          latitude: Number(panier.dossier.latitude),
          longitude: Number(panier.dossier.longitude),
        }
      : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Breadcrumb
          items={[
            { label: "Dossiers", href: "/dossiers" },
            { label: panier.dossier.numeroDossier, href: `/dossiers/${panier.dossierId}` },
            { label: panier.nom },
          ]}
        />
        <HistoriqueBouton cible={{ type: "panier", id: id }} titre={panier.nom} />
      </div>
      <PanierView
        panierId={id}
        nom={panier.nom}
        transactions={transactions.map(serializeTransaction)}
        importedFields={IMPORTED_FIELDS}
        champs={champs}
        dateEvaluation={panier.dossier.dateEvaluation ? panier.dossier.dateEvaluation.toISOString().slice(0, 10) : null}
        tauxCroissancePct={serialized.tauxCroissancePct}
        typeTransactionNom={serialized.typeTransactionNom}
        typeTransactionCode={serialized.typeTransactionCode}
        dossierLocalisation={dossierLocalisation}
      />
    </div>
  )
}
