import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  DEFAULT_IMPORTED_SECTION_ID,
  DEFAULT_IMPORTED_SECTION_NAME,
  DEFAULT_SECTION_ID,
  DEFAULT_SECTION_NAME,
} from "@/lib/fiche-layout"

let orgId = ""
let importedChampId = ""

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Fiche Layout Org" } })
  orgId = org.id

  // La section par défaut place les champs importés à part et, dans « Champs à enrichir », les champs
  // saisissables prioritaires : actifs, affichés et obligatoires. Les autres restent hors disposition.
  await prisma.champ.createMany({
    data: [
      { organisationId: orgId, codeMachine: "prio_a", nomAffichage: "Prio A", typeDonnees: "TEXTE", nature: "SAISISSABLE", ordreAffichage: 0, estAffiche: true, estObligatoire: true, actif: true },
      { organisationId: orgId, codeMachine: "prio_b", nomAffichage: "Prio B", typeDonnees: "ENTIER", nature: "SAISISSABLE", ordreAffichage: 1, estAffiche: true, estObligatoire: true, actif: true },
      { organisationId: orgId, codeMachine: "facultatif", nomAffichage: "Facultatif", typeDonnees: "TEXTE", nature: "SAISISSABLE", ordreAffichage: 2, estAffiche: true, estObligatoire: false, actif: true },
      { organisationId: orgId, codeMachine: "cache", nomAffichage: "Caché", typeDonnees: "TEXTE", nature: "SAISISSABLE", ordreAffichage: 3, estAffiche: false, estObligatoire: true, actif: true },
      { organisationId: orgId, codeMachine: "inactif", nomAffichage: "Inactif", typeDonnees: "TEXTE", nature: "SAISISSABLE", ordreAffichage: 4, estAffiche: true, estObligatoire: true, actif: false },
      { organisationId: orgId, codeMachine: "importe", nomAffichage: "Importé", typeDonnees: "TEXTE", nature: "IMPORTE", ordreAffichage: 5, estAffiche: true, estObligatoire: true, actif: true },
    ],
  })

  const imported = await prisma.champ.findFirst({
    where: { organisationId: orgId, codeMachine: "importe" },
    select: { id: true },
  })
  importedChampId = imported!.id
})

afterAll(async () => {
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.vueFicheEvaluation.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
})

describe("getEffectiveFicheLayout", () => {
  it("propose la section des champs importés et une section avec les saisissables obligatoires", async () => {
    const { getEffectiveFicheLayout } = await import("@/server/fiche-layout")
    const sections = await getEffectiveFicheLayout(orgId)

    expect(sections).toHaveLength(2)
    expect(sections[0]).toMatchObject({
      id: DEFAULT_IMPORTED_SECTION_ID,
      nom: DEFAULT_IMPORTED_SECTION_NAME,
      ordre: 0,
      champs: [importedChampId],
    })
    expect(sections[1]).toMatchObject({ id: DEFAULT_SECTION_ID, nom: DEFAULT_SECTION_NAME, ordre: 1 })

    const codes = await prisma.champ.findMany({
      where: { id: { in: sections[1].champs } },
      orderBy: { ordreAffichage: "asc" },
      select: { codeMachine: true },
    })
    expect(codes.map((c) => c.codeMachine)).toEqual(["prio_a", "prio_b"])
  })

  it("retombe sur tous les saisissables affichés quand aucun n'est obligatoire", async () => {
    const org = await prisma.organisation.create({ data: { nom: "Test Fiche Layout Fallback" } })
    try {
      await prisma.champ.createMany({
        data: [
          { organisationId: org.id, codeMachine: "libre_a", nomAffichage: "Libre A", typeDonnees: "TEXTE", nature: "SAISISSABLE", ordreAffichage: 0, estAffiche: true, estObligatoire: false, actif: true },
          { organisationId: org.id, codeMachine: "libre_b", nomAffichage: "Libre B", typeDonnees: "TEXTE", nature: "SAISISSABLE", ordreAffichage: 1, estAffiche: true, estObligatoire: false, actif: true },
          { organisationId: org.id, codeMachine: "cache", nomAffichage: "Caché", typeDonnees: "TEXTE", nature: "SAISISSABLE", ordreAffichage: 2, estAffiche: false, estObligatoire: false, actif: true },
          { organisationId: org.id, codeMachine: "typeTransaction", nomAffichage: "Type", typeDonnees: "TEXTE", nature: "SAISISSABLE", ordreAffichage: 3, estAffiche: true, estObligatoire: false, actif: true },
        ],
      })

      const { getEffectiveFicheLayout } = await import("@/server/fiche-layout")
      const sections = await getEffectiveFicheLayout(org.id)

      expect(sections).toHaveLength(1)
      expect(sections[0].id).toBe(DEFAULT_SECTION_ID)
      const codes = await prisma.champ.findMany({
        where: { id: { in: sections[0].champs } },
        orderBy: { ordreAffichage: "asc" },
        select: { codeMachine: true },
      })
      // Les champs cachés et le type de transaction (rendu dans l'en-tête) sont écartés.
      expect(codes.map((c) => c.codeMachine)).toEqual(["libre_a", "libre_b"])
    } finally {
      await prisma.champ.deleteMany({ where: { organisationId: org.id } })
      await prisma.vueFicheEvaluation.deleteMany({ where: { organisationId: org.id } })
      await prisma.organisation.delete({ where: { id: org.id } })
    }
  })

  it("respecte la disposition enregistrée, même vide", async () => {
    const { saveFicheLayout } = await import("@/repositories/fiche-layout.repository")
    await saveFicheLayout(orgId, [])

    const { getEffectiveFicheLayout } = await import("@/server/fiche-layout")
    expect(await getEffectiveFicheLayout(orgId)).toEqual([])
  })

  it("renvoie la disposition enregistrée quand elle existe", async () => {
    const { saveFicheLayout } = await import("@/repositories/fiche-layout.repository")
    const saved = [{ id: "s1", nom: "Ma section", ordre: 0, champs: [] as string[] }]
    await saveFicheLayout(orgId, saved)

    const { getEffectiveFicheLayout } = await import("@/server/fiche-layout")
    expect(await getEffectiveFicheLayout(orgId)).toEqual(saved)
  })
})
