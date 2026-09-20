import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"

describe("findFiltersByOrganisation", () => {
  let orgId: string

  beforeAll(async () => {
    const org = await prisma.organisation.create({ data: { nom: "Test Filters Org" } })
    orgId = org.id

    await prisma.transactionSource.createMany({
      data: [
        { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", mrc: "Drummond" },
        { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", mrc: "Arthabaska" },
        { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", mrc: "Drummond" },
      ],
    })

    await prisma.filtreRecherche.create({
      data: {
        organisationId: orgId,
        nomFiltre: "MRC",
        typeFiltre: "LISTE",
        codeMachine: "mrc",
        champEnrichissableId: null,
        ordreAffichage: 0,
      },
    })
  })

  afterAll(async () => {
    await prisma.filtreRecherche.deleteMany({ where: { organisationId: orgId } })
    await prisma.transactionSource.deleteMany({ where: { organisationId: orgId } })
    await prisma.organisation.delete({ where: { id: orgId } })
  })

  it("exposes distinct source values at the top level for a source filter", async () => {
    const filters = await findFiltersByOrganisation(orgId)
    expect(filters).toHaveLength(1)
    expect(filters[0].optionsListe).toEqual(["Arthabaska", "Drummond"])
  })
})
