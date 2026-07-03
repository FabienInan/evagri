import { searchTransactions } from "@/server/actions/transaction"
import { filterSearchParamsSchema } from "@/validators/filter.validator"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const params = filterSearchParamsSchema.parse({
    page: searchParams.get("page") ?? "1",
    pageSize: searchParams.get("pageSize") ?? "25",
    sortField: searchParams.get("sortField") ?? "dateVente",
    sortOrder: searchParams.get("sortOrder") ?? "desc",
    filters: searchParams.get("filters") ?? "[]",
  })

  const data = await searchTransactions(params)
  return NextResponse.json(data)
}
