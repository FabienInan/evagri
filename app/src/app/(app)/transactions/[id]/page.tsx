import { notFound } from "next/navigation"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { getEffectiveFicheLayout } from "@/server/fiche-layout"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { findTransactionFiche, listDocuments } from "@/repositories/fiche.repository"
import { serializeDocument, serializeFiche } from "@/serializers/fiche.serializer"
import { FicheTransactionClient } from "@/components/fiche/fiche-transaction"
import {
  LISTE_PARAM,
  buildPanierDetailQuery,
  buildTransactionDetailQuery,
  parseFiltersParam,
} from "@/lib/transaction-filters"
import { getPanierNavigation, getTransactionNavigation } from "@/server/transaction-order"
import { findPanierById } from "@/repositories/dossier.repository"
import { Breadcrumb, type BreadcrumbItem } from "@/components/breadcrumb"
import type { TransactionNavigation } from "@/types/transaction"

export const dynamic = "force-dynamic"

export default async function FicheTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const { id } = await params
  const sp = await searchParams
  const organisationId = getCurrentOrganisationId()

  const record = await findTransactionFiche(organisationId, id)
  if (!record) notFound()

  const [champs, sections, typologies, documents] = await Promise.all([
    listChampsEnrichissablesByOrganisation(organisationId),
    getEffectiveFicheLayout(organisationId),
    listTypologiesByOrganisation(organisationId),
    listDocuments(id),
  ])

  const fiche = serializeFiche(record, {
    champs,
    sections,
    typologies,
    documents: documents.map(serializeDocument),
  })

  const sortField = typeof sp.sort === "string" && sp.sort ? sp.sort : "date_vente"
  const sortOrder: "asc" | "desc" = sp.order === "asc" ? "asc" : "desc"

  // Deux contextes de navigation possibles, transmis par les liens d'origine :
  // - panier : uniquement les transactions déjà dans le panier (ordre de sa liste) ;
  // - liste des transactions : liste affichée, filtrée ou complète.
  const panierId = typeof sp.panier === "string" && sp.panier ? sp.panier : null
  let navigation: TransactionNavigation | null = null
  let detailQuery: string

  if (panierId) {
    navigation = await getPanierNavigation({
      organisationId,
      panierId,
      currentId: id,
      sortField,
      sortOrder,
    })
    detailQuery = buildPanierDetailQuery({ panierId, sortField, sortOrder })
  } else {
    const filters = parseFiltersParam(typeof sp.filters === "string" ? sp.filters : null)
    // `liste=1` : fiche ouverte depuis la liste ; la navigation parcourt alors la liste complète
    // quand aucun filtre n'est actif. Une URL directe reste sans navigation.
    const fromListe = sp[LISTE_PARAM] === "1" || filters.length > 0
    navigation = fromListe
      ? await getTransactionNavigation({ organisationId, currentId: id, filters, sortField, sortOrder })
      : null
    detailQuery = fromListe ? buildTransactionDetailQuery({ filters, sortField, sortOrder }) : ""
  }

  // Fil d'ariane : Dossiers › dossier › panier › transaction, quand la fiche vient d'un panier ; sinon Transactions › transaction.
  const numeroInscription = typeof fiche.fields.numero_inscription === "string" ? fiche.fields.numero_inscription : "—"
  const breadcrumb: BreadcrumbItem[] = [{ label: "Transactions", href: "/transactions" }, { label: numeroInscription }]
  if (panierId) {
    const panier = await findPanierById(organisationId, panierId)
    if (panier) {
      breadcrumb.splice(0, 1,
        { label: "Dossiers", href: "/dossiers" },
        { label: panier.dossier.numeroDossier, href: `/dossiers/${panier.dossierId}` },
        { label: panier.nom, href: `/paniers/${panier.id}` }
      )
    }
  }

  return (
    <>
      <Breadcrumb items={breadcrumb} />
      <FicheTransactionClient
        key={fiche.statut}
        fiche={fiche}
        navigation={navigation}
        detailQuery={detailQuery}
      />
    </>
  )
}
