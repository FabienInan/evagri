import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { createImportedTransactions, findDedupKeysByNumeros } from "@/repositories/transaction.repository"

describe("batched import writes", () => {
  let orgId: string
  let numeroId: string
  let dateId: string

  beforeAll(async () => {
    const org = await prisma.organisation.create({ data: { nom: "Test Import Batch Org" } })
    orgId = org.id
    numeroId = (
      await prisma.champ.create({
        data: { organisationId: orgId, codeMachine: "numero_inscription", nomAffichage: "No", typeDonnees: "TEXTE", nature: "IMPORTE", estLectureSeule: true },
      })
    ).id
    dateId = (
      await prisma.champ.create({
        data: { organisationId: orgId, codeMachine: "date_vente", nomAffichage: "Date", typeDonnees: "DATE", nature: "IMPORTE", estLectureSeule: true },
      })
    ).id
  })

  afterAll(async () => {
    await prisma.valeurChamp.deleteMany({ where: { transaction: { organisationId: orgId } } })
    await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
    await prisma.champ.deleteMany({ where: { organisationId: orgId } })
    await prisma.organisation.delete({ where: { id: orgId } })
  })

  it("writes several transactions with their values and returns their dedup keys", async () => {
    const date = new Date("2024-05-01")
    await createImportedTransactions([
      {
        organisationId: orgId,
        systemeSource: "JLR",
        statut: "ANALYSEE",
        enrichmentValues: [
          { champId: numeroId, valeurTexte: "BATCH1" },
          { champId: dateId, valeurDate: date },
        ],
        typologieValue: null,
      },
      {
        organisationId: orgId,
        systemeSource: "JLR",
        statut: "NON_ANALYSEE",
        enrichmentValues: [{ champId: numeroId, valeurTexte: "BATCH2" }],
        typologieValue: null,
      },
    ])

    const keys = await findDedupKeysByNumeros(orgId, ["BATCH1", "BATCH2", "ABSENT"])
    expect(keys).toHaveLength(2)
    expect(keys.find((k) => k.numero === "BATCH1")?.date?.getTime()).toBe(date.getTime())
    expect(keys.find((k) => k.numero === "BATCH2")?.date).toBeNull()

    const transactions = await prisma.transaction.count({ where: { organisationId: orgId } })
    expect(transactions).toBe(2)
  })

  it("reads the keys in chunks for a large list of numeros", async () => {
    const numeros = Array.from({ length: 1500 }, (_, i) => `NOPE${i}`)
    expect(await findDedupKeysByNumeros(orgId, numeros)).toEqual([])
  })
})
