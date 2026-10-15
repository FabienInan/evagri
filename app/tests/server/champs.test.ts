import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma } from "@/lib/prisma"

// The "use server" action calls revalidatePath; outside a Next request there is no cache store to revalidate.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

let orgId: string
const previousOrganisationId = process.env.DEFAULT_ORGANISATION_ID

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Champs Org" } })
  orgId = org.id
  // getCurrentOrganisationId reads this at module load, so it must be set before the action is imported.
  process.env.DEFAULT_ORGANISATION_ID = orgId
})

afterAll(async () => {
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
  if (previousOrganisationId === undefined) delete process.env.DEFAULT_ORGANISATION_ID
  else process.env.DEFAULT_ORGANISATION_ID = previousOrganisationId
})

const baseInput = {
  nomAffichage: "Champ importé test",
  typeDonnees: "TEXTE" as const,
  nature: "IMPORTE" as const,
  unite: "N/A",
  plageMin: null,
  plageMax: null,
  optionsListe: null,
  regleCalcul: null,
  applicableATypes: ["TERRES_CULTIVEES"],
  ordreAffichage: 0,
  estAffiche: true,
  estObligatoire: false,
}

function findChamp(codeMachine: string) {
  return prisma.champ.findUnique({
    where: { organisationId_codeMachine: { organisationId: orgId, codeMachine } },
  })
}

describe("createChamp estLectureSeule", () => {
  it("persists estLectureSeule:false for an IMPORTE champ (admin re-opens an imported field)", async () => {
    const { createChamp } = await import("@/server/actions/champs")
    const result = await createChamp({ ...baseInput, codeMachine: "champ_importe_libre", estLectureSeule: false })
    expect(result).toEqual({ ok: true })
    expect((await findChamp("champ_importe_libre"))?.estLectureSeule).toBe(false)
  })

  it("derives estLectureSeule true for an IMPORTE champ when the field is omitted", async () => {
    const { createChamp } = await import("@/server/actions/champs")
    const result = await createChamp({ ...baseInput, codeMachine: "champ_importe_derive" })
    expect(result).toEqual({ ok: true })
    expect((await findChamp("champ_importe_derive"))?.estLectureSeule).toBe(true)
  })

  it("forces estLectureSeule true for a CALCULE champ even when the request sends false", async () => {
    const { createChamp } = await import("@/server/actions/champs")
    const result = await createChamp({
      ...baseInput,
      codeMachine: "indicateur_test_calc",
      nature: "CALCULE",
      typeDonnees: "ENTIER",
      unite: "$",
      regleCalcul: "prix_vente",
      estLectureSeule: false,
    })
    expect(result).toEqual({ ok: true })
    expect((await findChamp("indicateur_test_calc"))?.estLectureSeule).toBe(true)
  })
})
