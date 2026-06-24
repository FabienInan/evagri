import { searchTransactions } from "@/server/actions/transaction"
import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get("page") ?? "1", 10)
  const sortField = searchParams.get("sortField") ?? "dateVente"
  const sortOrder = (searchParams.get("sortOrder") ?? "desc") as "asc" | "desc"
  const filters = JSON.parse(searchParams.get("filters") ?? "[]")

  const data = await searchTransactions({ page, sortField, sortOrder, filters })
  return NextResponse.json(data)
}
