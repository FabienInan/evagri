import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"

const createAuditLog = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  journalAudit: { findMany: vi.fn() },
  utilisateur: { findMany: vi.fn() },
}))

vi.mock("@/repositories/audit.repository", () => ({ createAuditLog }))
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }))

import { journaliser } from "@/server/journal"
import { listJournalByOrganisation } from "@/repositories/journal.repository"

const src = (rel: string) => readFileSync(new URL(`../../src/${rel}`, import.meta.url), "utf8")

describe("journaliser", () => {
  beforeEach(() => vi.clearAllMocks())

  it("enregistre la modification pour l'organisation et l'auteur de l'utilisateur", async () => {
    await journaliser({ id: "user-1", organisationId: "org-1" }, { tableCible: "champ", enregistrementId: "c-1", action: "UPDATE", diff: { actif: false } })
    expect(createAuditLog).toHaveBeenCalledWith({
      organisationId: "org-1",
      utilisateurId: "user-1",
      tableCible: "champ",
      enregistrementId: "c-1",
      action: "UPDATE",
      diff: { actif: false },
    })
  })
})

// Every action that writes business data must journal its change. A new write without a journal entry fails here.
const ACTIONS_QUI_ECRIVENT: [string, string[]][] = [
  ["server/actions/fiche.ts", ["saveFiche", "setFicheStatut", "uploadDocument", "deleteDocument"]],
  ["server/actions/dossier.ts", ["createDossier", "createPanier", "updatePanierTauxCroissance", "deletePanier", "addTransactionsToPanier", "removeTransactionFromPanier"]],
  ["server/actions/champs.ts", ["createChamp", "updateChamp", "toggleChampActif"]],
  ["server/actions/filters.ts", ["createFilter", "publishFilters", "deleteFilter"]],
  ["server/actions/sections.ts", ["saveFicheLayout"]],
  ["server/actions/import.ts", ["importExcel", "retryImport"]],
  ["server/actions/actes.ts", ["importActesPDF"]],
  ["server/actions/users.ts", ["inviteUtilisateur", "changerRoleUtilisateur", "reinitialiserMotDePasseUtilisateur", "definirActiviteUtilisateur"]],
  ["server/actions/compte.ts", ["changerMotDePasse"]],
  ["server/actions/consent.ts", ["accepterPolitiqueConfidentialite"]],
]

function corpsDe(source: string, name: string): string {
  const debut = source.indexOf(`export async function ${name}(`)
  expect(debut, name).toBeGreaterThan(-1)
  const suivant = source.indexOf("\nexport ", debut + 1)
  return source.slice(debut, suivant === -1 ? undefined : suivant)
}

describe("chaque écriture est journalisée", () => {
  for (const [fichier, actions] of ACTIONS_QUI_ECRIVENT) {
    for (const action of actions) {
      it(`${fichier} : ${action} journalise sa modification`, () => {
        // Either the journal helper, or an entry handed to a repository write that records it in the same transaction.
        expect(corpsDe(src(fichier), action)).toMatch(/await journaliser\(|createAuditLog\(|AvecJournal\(|tableCible:/)
      })
    }
  }
})

describe("lecture du journal", () => {
  beforeEach(() => vi.clearAllMocks())

  it("ne lit que les entrées de l'organisation demandée, les plus récentes d'abord", async () => {
    prismaMock.journalAudit.findMany.mockResolvedValue([])
    await listJournalByOrganisation("org-1", 50)
    expect(prismaMock.journalAudit.findMany).toHaveBeenCalledWith({
      where: { organisationId: "org-1" },
      orderBy: { createdAt: "desc" },
      take: 50,
    })
  })

  it("résout le courriel de l'auteur, et laisse vide pour une entrée système", async () => {
    prismaMock.journalAudit.findMany.mockResolvedValue([
      { id: "e1", createdAt: new Date(), utilisateurId: "user-1", tableCible: "champ", enregistrementId: "c", action: "UPDATE", diff: null },
      { id: "e2", createdAt: new Date(), utilisateurId: null, tableCible: "importation", enregistrementId: null, action: "INSERT", diff: null },
    ])
    prismaMock.utilisateur.findMany.mockResolvedValue([{ id: "user-1", email: "admin@org1.test" }])

    const entrees = await listJournalByOrganisation("org-1")
    expect(entrees[0].utilisateurEmail).toBe("admin@org1.test")
    expect(entrees[1].utilisateurEmail).toBeNull()
  })

  it("régression : la résolution des courriels reste dans l'organisation (pas de fuite d'un autre compte)", async () => {
    prismaMock.journalAudit.findMany.mockResolvedValue([
      { id: "e1", createdAt: new Date(), utilisateurId: "user-x", tableCible: "champ", enregistrementId: null, action: "UPDATE", diff: null },
    ])
    prismaMock.utilisateur.findMany.mockResolvedValue([])
    const entrees = await listJournalByOrganisation("org-1")
    expect(prismaMock.utilisateur.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organisationId: "org-1" }) }))
    expect(entrees[0].utilisateurEmail).toBeNull()
  })
})

describe("écran du journal", () => {
  it("réservé à la zone administration", () => {
    expect(src("app/(app)/admin/journal/page.tsx")).toContain('exigerZonePage("administration")')
  })
})
