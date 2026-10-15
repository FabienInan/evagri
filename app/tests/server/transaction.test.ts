import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { findExistingTransaction } from "@/repositories/transaction.repository"

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

describe("findExistingTransaction", () => {
  it("dedups symmetric null dates", async () => {
    const numeroChamp = await prisma.champ.findFirstOrThrow({ where: { organisationId: orgId, codeMachine: "numero_inscription" } })
    const tx = await prisma.transaction.create({
      data: { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", valeurs: { create: [{ champId: numeroChamp.id, valeurTexte: "DUP-1" }] } },
    })
    const found = await findExistingTransaction(orgId, "DUP-1", null)
    expect(found?.id).toBe(tx.id)
  })

  it("does not treat a null-date query as matching a dated row", async () => {
    const numeroChamp = await prisma.champ.findFirstOrThrow({ where: { organisationId: orgId, codeMachine: "numero_inscription" } })
    const dateChamp = await prisma.champ.create({
      data: { organisationId: orgId, codeMachine: "date_vente", nomAffichage: "Date de vente", typeDonnees: "DATE", nature: "IMPORTE", estLectureSeule: true },
    })
    const dateVente = new Date("2024-05-01T00:00:00.000Z")
    const tx = await prisma.transaction.create({
      data: {
        organisationId: orgId,
        systemeSource: "EXISTANT_EVAGRI",
        valeurs: { create: [
          { champId: numeroChamp.id, valeurTexte: "ND-1" },
          { champId: dateChamp.id, valeurDate: dateVente },
        ] },
      },
    })

    // A query without a date must not match a row that carries one...
    expect(await findExistingTransaction(orgId, "ND-1", null)).toBeNull()
    // ...while the same date does match it (the negative branch is what changed).
    expect((await findExistingTransaction(orgId, "ND-1", dateVente))?.id).toBe(tx.id)
  })
})
