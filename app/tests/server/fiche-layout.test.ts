import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { DEFAULT_SECTION_ID, DEFAULT_SECTION_NAME } from "@/lib/fiche-layout"

let orgId = ""

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Fiche Layout Org" } })
  orgId = org.id

  // Seuls ces champs doivent alimenter la section par défaut : saisissables, actifs, affichés et
  // obligatoires. Les autres restent hors disposition tant que l'admin n'en décide pas autrement.
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
})

afterAll(async () => {
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.vueFicheEvaluation.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
})

describe("getEffectiveFicheLayout", () => {
  it("propose une section par défaut avec les champs saisissables obligatoires affichés et actifs", async () => {
    const { getEffectiveFicheLayout } = await import("@/server/fiche-layout")
    const sections = await getEffectiveFicheLayout(orgId)

    expect(sections).toHaveLength(1)
    expect(sections[0]).toMatchObject({ id: DEFAULT_SECTION_ID, nom: DEFAULT_SECTION_NAME, ordre: 0 })
    expect(sections[0].champs).toHaveLength(2)

    const codes = await prisma.champ.findMany({
      where: { id: { in: sections[0].champs } },
      orderBy: { ordreAffichage: "asc" },
      select: { codeMachine: true },
    })
    expect(codes.map((c) => c.codeMachine)).toEqual(["prio_a", "prio_b"])
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
