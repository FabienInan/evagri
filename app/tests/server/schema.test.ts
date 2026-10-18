import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"

const ORG = "90a5866e-06e5-46ce-9941-56582b8ca15c"

describe("unified schema", () => {
  it("enumerates StatutTransaction and NatureChamp", async () => {
    const rows = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'StatutTransaction' ORDER BY e.enumsortorder`
    expect(rows.map((r) => r.enumlabel)).toEqual(["NON_ANALYSEE", "ANALYSEE"])
    const nature = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'NatureChamp' ORDER BY e.enumsortorder`
    expect(nature.map((r) => r.enumlabel)).toEqual(["IMPORTE", "SAISISSABLE", "CALCULE"])
  })

  it("seeds the 12 imported champs as read-only IMPORTE", async () => {
    const champs = await prisma.champ.findMany({ where: { organisationId: ORG, nature: "IMPORTE" } })
    expect(champs).toHaveLength(12)
    expect(champs.every((c) => c.estLectureSeule)).toBe(true)
    const mrc = champs.find((c) => c.codeMachine === "mrc")
    expect(mrc?.entetesImport).not.toBeNull()
  })

  it("propose la disposition par défaut quand aucune n'est enregistrée", async () => {
    const vue = await prisma.vueFicheEvaluation.findFirst({ where: { organisationId: ORG, typeVue: "FICHE_TRANSACTION" } })
    expect(vue).toBeNull()

    const { getEffectiveFicheLayout } = await import("@/server/fiche-layout")
    const sections = await getEffectiveFicheLayout(ORG)
    expect(sections[0]).toMatchObject({ nom: "Données de l'acte" })
    expect(sections[0].champs).toHaveLength(12)
    expect(sections.map((s) => s.nom)).toContain("Champs à enrichir")
  })
})
