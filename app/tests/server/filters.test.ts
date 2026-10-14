import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"
import { withRenteLots } from "@/repositories/transaction.repository"

describe("findFiltersByOrganisation", () => {
  let orgId: string
  beforeAll(async () => {
    const org = await prisma.organisation.create({ data: { nom: "Test Filters Org" } })
    orgId = org.id
    const mrcChamp = await prisma.champ.create({ data: { organisationId: orgId, codeMachine: "mrc", nomAffichage: "MRC", typeDonnees: "TEXTE", nature: "IMPORTE", estLectureSeule: true } })
    await prisma.filtreRecherche.create({ data: { organisationId: orgId, nomFiltre: "MRC", typeFiltre: "LISTE", champId: mrcChamp.id, ordreAffichage: 0 } })
    const t1 = await prisma.transaction.create({ data: { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", valeurs: { create: [{ champId: mrcChamp.id, valeurTexte: "Drummond" }] } } })
    await prisma.transaction.create({ data: { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", valeurs: { create: [{ champId: mrcChamp.id, valeurTexte: "Arthabaska" }] } } })
    void t1
  })
  afterAll(async () => {
    await prisma.filtreRecherche.deleteMany({ where: { organisationId: orgId } })
    await prisma.valeurChamp.deleteMany({ where: { transaction: { organisationId: orgId } } })
    await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
    await prisma.champ.deleteMany({ where: { organisationId: orgId } })
    await prisma.organisation.delete({ where: { id: orgId } })
  })

  it("hydrates the filter's champ and its distinct values", async () => {
    const filters = await findFiltersByOrganisation(orgId)
    expect(filters).toHaveLength(1)
    expect(filters[0].champ?.codeMachine).toBe("mrc")
    expect(filters[0].optionsListe).toEqual(["Arthabaska", "Drummond"])
  })
})

describe("withRenteLots", () => {
  it("adds the duplicated-lot constraint on the multiple-value column, preserving existing AND", () => {
    const where = { organisationId: "org", AND: [{ statut: "ANALYSEE" }] }
    expect(withRenteLots(where as never, ["L1", "L2"])).toEqual({
      organisationId: "org",
      AND: [
        { statut: "ANALYSEE" },
        { valeurs: { some: { champ: { codeMachine: "lots_cadastraux" }, valeurTexteMultiple: { hasSome: ["L1", "L2"] } } } },
      ],
    })
  })
})
