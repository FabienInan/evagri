import { filterByPolygon, findGeoFilter } from "@/lib/filters"
import { gardeApi } from "@/lib/api-guard"
import { getCurrentUser } from "@/lib/session"
import { findTransactionsForMap, type MapTransaction } from "@/repositories/transaction.repository"
import { serializeMapTransaction } from "@/serializers/transaction.serializer"
import { filterMapParamsSchema } from "@/validators/filter.validator"
import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const refus = await gardeApi("evaluation")
  if (refus) return refus
  const { searchParams } = new URL(request.url)
  const parsed = filterMapParamsSchema.safeParse({
    filters: searchParams.get("filters") ?? "[]",
  })
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 })
  }
  const filters = parsed.data.filters
  const geoFilter = findGeoFilter(filters)
  const utilisateur = await getCurrentUser()
  if (!utilisateur) return NextResponse.json({ error: "Authentification requise" }, { status: 401 })
  const orgId = utilisateur.organisationId

  let transactions = await findTransactionsForMap(filters, orgId)

  if (geoFilter) {
    transactions = filterByPolygon(transactions, geoFilter.value) as MapTransaction[]
  }

  return NextResponse.json(transactions.map(serializeMapTransaction))
}
