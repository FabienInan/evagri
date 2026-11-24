import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma } from "@/lib/prisma"

// Convention: the act's file name starts with the transaction's numéro d'inscription (e.g. 30292831.pdf).
// Storage is replaced so the test writes no file; matching and document records are real database rows.
vi.mock("@/lib/file-storage", () => ({
  saveActePDF: async (file: File) => ({ nomFichier: file.name, cheminStockage: `test/${file.name}` }),
}))

let orgId = ""
let transactionId = ""
const NUMERO = "30292831"

vi.mock("@/lib/session", () => ({
  verifierZone: async () => ({
    ok: true,
    utilisateur: { id: "test-user", organisationId: orgId, role: "ADMIN" },
  }),
}))

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test actes numéro d'inscription" } })
  orgId = org.id
  const champ = await prisma.champ.create({
    data: {
      organisationId: orgId,
      codeMachine: "numero_inscription",
      nomAffichage: "Numéro d'inscription",
      typeDonnees: "TEXTE",
      nature: "IMPORTE",
    },
  })
  const tx = await prisma.transaction.create({ data: { organisationId: orgId, systemeSource: "TEST" } })
  transactionId = tx.id
  await prisma.valeurChamp.create({ data: { transactionId, champId: champ.id, valeurTexte: NUMERO } })
})

afterAll(async () => {
  await prisma.documentActe.deleteMany({ where: { transaction: { organisationId: orgId } } })
  await prisma.valeurChamp.deleteMany({ where: { transaction: { organisationId: orgId } } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.journalAudit.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.deleteMany({ where: { id: orgId } })
})

function pdf(name: string) {
  return new File(["%PDF-1.4 test"], name, { type: "application/pdf" })
}

describe("rattachement des actes par numéro d'inscription", () => {
  it("rattache chaque PDF dont le nom commence par le numéro d'inscription, et rejette les autres", async () => {
    const { importActesPDF } = await import("@/server/actions/actes")
    const formData = new FormData()
    formData.append("files", pdf(`${NUMERO}.pdf`))
    formData.append("files", pdf(`${NUMERO}_acte-signe.pdf`))
    formData.append("files", pdf(`2024-${NUMERO}.pdf`))
    formData.append("files", pdf("sans-numero.pdf"))
    formData.append("files", new File(["x"], "note.txt", { type: "text/plain" }))

    const result = await importActesPDF(formData)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.matchedCount).toBe(2)
    expect(result.matched.map((m) => m.transactionId)).toEqual([transactionId, transactionId])
    expect(result.unmatched).toEqual([
      `2024-${NUMERO}.pdf (aucune transaction pour 2024)`,
      "sans-numero.pdf (impossible d'extraire le numéro d'inscription)",
      "note.txt (format non PDF)",
    ])
    const documents = await prisma.documentActe.findMany({ where: { transactionId }, orderBy: { nomFichier: "asc" } })
    expect(documents.map((d) => d.nomFichier)).toEqual([`${NUMERO}.pdf`, `${NUMERO}_acte-signe.pdf`])
  })
})
