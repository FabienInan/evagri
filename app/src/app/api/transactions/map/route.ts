import { filterByPolygon, findGeoFilter } from "@/lib/filters"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findTransactionsForMap, type MapTransaction } from "@/repositories/transaction.repository"
import { filterMapParamsSchema } from "@/validators/filter.validator"
import { NextResponse } from "next/server"

function serializeMapTransaction(t: MapTransaction) {
  const num = (value: { toString(): string } | null) => (value == null ? null : Number(value))
  return {
    id: t.id,
    numeroInscription: t.numeroInscription ?? null,
    dateVente: t.dateVente ? t.dateVente.toISOString() : null,
    // Explicit null checks (not truthiness): 0 is a legitimate price, area, and coordinate (equator,
    // prime meridian), and truthiness would turn each of those into a null.
    prixVente: num(t.prixVente),
    superficieTotaleHectare: num(t.superficieTotaleHectare),
    latitude: t.latitude ?? null,
    longitude: t.longitude ?? null,
    municipalite: t.municipalite ?? null,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const parsed = filterMapParamsSchema.safeParse({
    filters: searchParams.get("filters") ?? "[]",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 })
  }
  const filters = parsed.data.filters
  const geoFilter = findGeoFilter(filters)
  const orgId = getCurrentOrganisationId()

  let transactions = await findTransactionsForMap(filters, orgId)

  if (geoFilter) {
    transactions = filterByPolygon(transactions, geoFilter.value) as MapTransaction[]
  }

  return NextResponse.json(transactions.map(serializeMapTransaction))
}
