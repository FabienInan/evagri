import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import {
  ensureChampByCodeMachine,
  ensureEnrichmentChamps,
} from "@/repositories/enrichment.repository"

let orgId = ""

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Enrichment Repo Org" } })
  orgId = org.id
})

afterAll(async () => {
  await prisma.valeurChamp.deleteMany({ where: { champ: { organisationId: orgId } } })
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
})

describe("champs créés par l'import Excel", () => {
  it("crée les colonnes saisissables sans lecture seule (§6.5)", async () => {
    const [champ] = await ensureEnrichmentChamps(orgId, [{ "Colonne nouvelle": "abc" }])
    const created = await prisma.champ.findUnique({ where: { id: champ.id } })

    expect(created?.nature).toBe("SAISISSABLE")
    expect(created?.estLectureSeule).toBe(false)
    expect(created?.estObligatoire).toBe(true)
  })

  it("crée les champs de repli sans lecture seule (§6.5)", async () => {
    const created = await ensureChampByCodeMachine(
      orgId,
      "colonne_repli",
      "Colonne repli",
      "TEXTE",
      "N/A"
    )
    const row = await prisma.champ.findUnique({ where: { id: created.id } })

    expect(row?.estLectureSeule).toBe(false)
    expect(row?.estObligatoire).toBe(true)
  })
})
