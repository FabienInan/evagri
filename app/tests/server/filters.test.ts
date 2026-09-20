import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"

describe("findFiltersByOrganisation", () => {
  let orgId: string
  let createdChampId: string | null = null

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
    if (createdChampId) {
      await prisma.valeurEnrichissement.deleteMany({ where: { champEnrichissableId: createdChampId } })
      await prisma.champEnrichissable.delete({ where: { id: createdChampId } })
    }
    await prisma.transactionEnrichie.deleteMany({ where: { organisationId: orgId } })
    await prisma.transactionSource.deleteMany({ where: { organisationId: orgId } })
    await prisma.organisation.delete({ where: { id: orgId } })
  })

  it("exposes distinct source values at the top level for a source filter", async () => {
    const filters = await findFiltersByOrganisation(orgId)
    expect(filters).toHaveLength(1)
    expect(filters[0].optionsListe).toEqual(["Arthabaska", "Drummond"])
  })

  it("promotes a champ's static optionsListe at the top level, over distinct enrichment values", async () => {
    const champ = await prisma.champEnrichissable.create({
      data: {
        organisationId: orgId,
        codeMachine: "topographie_test",
        nomAffichage: "Topographie (test)",
        typeDonnees: "LISTE",
        nature: "SAISISSABLE",
        optionsListe: ["Plat", "Vallonné"],
      },
    })
    createdChampId = champ.id

    await prisma.filtreRecherche.create({
      data: {
        organisationId: orgId,
        nomFiltre: "Topographie (test)",
        typeFiltre: "LISTE",
        codeMachine: null,
        champEnrichissableId: champ.id,
        ordreAffichage: 1,
      },
    })

    // A distinct enrichment value that must NOT win over the static options.
    const source = await prisma.transactionSource.create({
      data: { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", mrc: "Drummond" },
    })
    const enriched = await prisma.transactionEnrichie.create({
      data: { organisationId: orgId, transactionSourceId: source.id },
    })
    await prisma.valeurEnrichissement.create({
      data: {
        transactionEnrichieId: enriched.id,
        champEnrichissableId: champ.id,
        valeurTexte: "Montagneux",
      },
    })

    const filters = await findFiltersByOrganisation(orgId, { includeChamp: true })
    const filter = filters.find((f) => f.champEnrichissable?.id === champ.id)
    expect(filter?.optionsListe).toEqual(["Plat", "Vallonné"])
  })
})
