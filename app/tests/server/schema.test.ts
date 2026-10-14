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

  it("seeds a default fiche section holding the imported champs", async () => {
    const vue = await prisma.vueFicheEvaluation.findFirst({ where: { organisationId: ORG, typeVue: "FICHE_TRANSACTION" } })
    const contenu = vue?.contenu as { sections?: { nom: string; champs: string[] }[] } | undefined
    expect(contenu?.sections?.[0]?.nom).toBe("Données de l'acte")
    expect(contenu?.sections?.[0]?.champs.length).toBe(12)
  })
})
