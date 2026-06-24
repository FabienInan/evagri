import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { searchTransactions } from "@/server/actions/transaction"
import { prisma } from "@/lib/prisma"

describe("searchTransactions", () => {
  let orgId: string

  beforeAll(async () => {
    const org = await prisma.organisation.create({ data: { nom: "Test Org" } })
    orgId = org.id
    process.env.DEFAULT_ORGANISATION_ID = orgId

    await prisma.transactionSource.create({
      data: {
        organisationId: orgId,
        systemeSource: "EXISTANT_EVAGRI",
        numeroInscription: "12345",
        dateVente: new Date("2023-01-15"),
        prixVente: 50000,
        mrc: "Test MRC",
        municipalite: "Testville",
      },
    })
  })

  afterAll(async () => {
    await prisma.transactionSource.deleteMany({ where: { organisationId: orgId } })
    await prisma.organisation.delete({ where: { id: orgId } })
  })

  it("returns paginated transactions", async () => {
    const res = await searchTransactions({ page: 1, pageSize: 10 })
    expect(res.transactions.length).toBeGreaterThan(0)
    expect(res.total).toBeGreaterThan(0)
    expect(res.totalPages).toBeGreaterThan(0)
  })
})
