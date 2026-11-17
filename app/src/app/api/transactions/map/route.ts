import { filterByPolygon, findGeoFilter } from "@/lib/filters"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findTransactionsForMap, type MapTransaction } from "@/repositories/transaction.repository"
import { serializeMapTransaction } from "@/serializers/transaction.serializer"
import { filterMapParamsSchema } from "@/validators/filter.validator"
import { NextResponse } from "next/server"

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
