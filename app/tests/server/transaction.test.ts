import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { findDedupKeysByNumeros } from "@/repositories/transaction.repository"

let orgId: string

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Tx Org" } })
  orgId = org.id
})

afterAll(async () => {
  await prisma.valeurChamp.deleteMany({ where: { transaction: { organisationId: orgId } } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
})

describe("createImportedTransaction / serializeTransaction", () => {
  it("writes a Transaction with a ValeurChamp per imported field and hydrates a flat fields map", async () => {
    const numeroChamp = await prisma.champ.create({ data: { organisationId: orgId, codeMachine: "numero_inscription", nomAffichage: "N° d'inscription", typeDonnees: "TEXTE", nature: "IMPORTE", estLectureSeule: true } })
    const prixChamp = await prisma.champ.create({ data: { organisationId: orgId, codeMachine: "prix_vente", nomAffichage: "Prix à l'acte", typeDonnees: "DECIMAL", nature: "IMPORTE", estLectureSeule: true } })

    const tx = await prisma.transaction.create({
      data: {
        organisationId: orgId,
        systemeSource: "EXISTANT_EVAGRI",
        valeurs: { create: [
          { champId: numeroChamp.id, valeurTexte: "22309676" },
          { champId: prixChamp.id, valeurNombre: "36000" },
        ] },
      },
      include: { valeurs: { include: { champ: true } } },
    })

    const dto = serializeTransaction(tx)
    expect(dto.statut).toBe("NON_ANALYSEE")
    expect(dto.fields["numero_inscription"]).toBe("22309676")
    expect(dto.fields["prix_vente"]).toBe(36000)
  })
})

describe("findDedupKeysByNumeros", () => {
  it("returns a null date for a row without date de vente", async () => {
    const numeroChamp = await prisma.champ.findFirstOrThrow({ where: { organisationId: orgId, codeMachine: "numero_inscription" } })
    await prisma.transaction.create({
      data: { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", valeurs: { create: [{ champId: numeroChamp.id, valeurTexte: "DUP-1" }] } },
    })
    expect(await findDedupKeysByNumeros(orgId, ["DUP-1"])).toEqual([{ numero: "DUP-1", date: null }])
  })

  it("returns the date of a dated row, so a query without a date cannot match it by key", async () => {
    const numeroChamp = await prisma.champ.findFirstOrThrow({ where: { organisationId: orgId, codeMachine: "numero_inscription" } })
    const dateChamp = await prisma.champ.create({
      data: { organisationId: orgId, codeMachine: "date_vente", nomAffichage: "Date de vente", typeDonnees: "DATE", nature: "IMPORTE", estLectureSeule: true },
    })
    const dateVente = new Date("2024-05-01T00:00:00.000Z")
    await prisma.transaction.create({
      data: {
        organisationId: orgId,
        systemeSource: "EXISTANT_EVAGRI",
        valeurs: { create: [
          { champId: numeroChamp.id, valeurTexte: "ND-1" },
          { champId: dateChamp.id, valeurDate: dateVente },
        ] },
      },
    })

    const keys = await findDedupKeysByNumeros(orgId, ["ND-1"])
    expect(keys).toHaveLength(1)
    expect(keys[0].date?.getTime()).toBe(dateVente.getTime())
  })
})
