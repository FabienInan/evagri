import { filterByPolygon, findGeoFilter } from "@/lib/filters"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findTransactionsForMap, type MapTransaction } from "@/repositories/transaction.repository"
import { filterMapParamsSchema } from "@/validators/filter.validator"
import { NextResponse } from "next/server"

function serializeMapTransaction(t: MapTransaction) {
  return {
    id: t.id,
    numeroInscription: t.numeroInscription ?? null,
    dateVente: t.dateVente ? t.dateVente.toISOString() : null,
    prixVente: t.prixVente ? Number(t.prixVente) : null,
    superficieTotaleHectare: t.superficieTotaleHectare ? Number(t.superficieTotaleHectare) : null,
    latitude: t.latitude ? Number(t.latitude) : null,
    longitude: t.longitude ? Number(t.longitude) : null,
    municipalite: t.municipalite ?? null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const params = filterMapParamsSchema.parse({
    filters: searchParams.get("filters") ?? "[]",
  })
  const filters = params.filters
  const geoFilter = findGeoFilter(filters)
  const orgId = getCurrentOrganisationId()

  let transactions = await findTransactionsForMap(filters, orgId)

  if (geoFilter) {
    transactions = filterByPolygon(transactions, geoFilter.value) as MapTransaction[]
  }

  return NextResponse.json(transactions.map(serializeMapTransaction))
}
