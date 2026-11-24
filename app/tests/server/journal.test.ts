import { describe, it, expect, vi, beforeEach } from "vitest"
import { existsSync, readFileSync } from "node:fs"

const createAuditLog = vi.hoisted(() => vi.fn())

vi.mock("@/repositories/audit.repository", () => ({ createAuditLog }))

import { journaliser } from "@/server/journal"

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

describe("le journal d'audit n'a plus de vue dédiée", () => {
  it("la page Journal d'audit et son entrée de menu ont été retirées ; l'historique par entité reste", () => {
    expect(existsSync(new URL("../../src/app/(app)/admin/journal/page.tsx", import.meta.url))).toBe(false)
    expect(src("components/sidebar.tsx")).not.toContain("/admin/journal")
    expect(src("repositories/journal.repository.ts")).toContain("listHistoriqueEntite")
  })
})
