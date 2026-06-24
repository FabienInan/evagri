import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  const transactions = await prisma.transactionSource.findMany({
    where: {
      organisationId: process.env.DEFAULT_ORGANISATION_ID || "",
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      numeroInscription: true,
      dateVente: true,
      prixVente: true,
      superficieTotaleHectare: true,
      latitude: true,
      longitude: true,
      municipalite: true,
    },
  })

  return NextResponse.json(
    transactions.map((t) => ({
      ...t,
      dateVente: t.dateVente.toISOString(),
      prixVente: t.prixVente ? Number(t.prixVente) : null,
      superficieTotaleHectare: t.superficieTotaleHectare ? Number(t.superficieTotaleHectare) : null,
      latitude: t.latitude ? Number(t.latitude) : null,
      longitude: t.longitude ? Number(t.longitude) : null,
    }))
  )
}
