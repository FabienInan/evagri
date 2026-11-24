import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import bcrypt from "bcryptjs"

// In-memory stand-in for the utilisateur table, so the rules are tested against real state transitions.
type Row = {
  id: string
  organisationId: string
  email: string
  nom: string | null
  role: string
  actif: boolean
  passwordHash?: string
  motDePasseTemporaire?: boolean
  consentementPolitiqueAt: Date | null
  createdAt: Date
}

const store = vi.hoisted(() => ({ rows: [] as Row[], session: null as null | { user: { id: string; empreinte: string } } }))

const { repo, DernierAdministrateurError } = vi.hoisted(() => {
  class DernierAdministrateurError extends Error {
    constructor() {
      super("Au moins un administrateur actif doit rester dans l'organisation")
    }
  }
  return {
    DernierAdministrateurError,
    repo: {
      findUtilisateurById: vi.fn(),
      findUtilisateurByEmail: vi.fn(),
      creerUtilisateurAvecJournal: vi.fn(),
      modifierUtilisateurAvecJournal: vi.fn(),
    },
  }
})
const createAuditLog = vi.hoisted(() => vi.fn())
const authMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/repositories/utilisateur.repository", () => ({ ...repo, DernierAdministrateurError }))
vi.mock("@/repositories/audit.repository", () => ({ createAuditLog }))

import { changerRoleUtilisateur, definirActiviteUtilisateur, inviteUtilisateur } from "@/server/actions/users"
import { empreinteMotDePasse } from "@/lib/password-fingerprint"

const ORG = "org-1"
const AUTRE_ORG = "org-2"

function seed() {
  const base = { nom: null, passwordHash: "x", consentementPolitiqueAt: null, createdAt: new Date(0) }
  store.rows = [
    { ...base, id: "admin-1", organisationId: ORG, email: "admin1@org1.test", nom: "Admin Un", role: "ADMIN", actif: true },
    { ...base, id: "admin-2", organisationId: ORG, email: "admin2@org1.test", role: "ADMIN", actif: true },
    { ...base, id: "eval-1", organisationId: ORG, email: "eval@org1.test", role: "EVALUATEUR", actif: true },
    { ...base, id: "x-1", organisationId: AUTRE_ORG, email: "x@org2.test", role: "ADMIN", actif: true },
  ]
}

function connecteEn(id: string | null) {
  const row = store.rows.find((r) => r.id === id)
  store.session = id ? { user: { id, empreinte: empreinteMotDePasse(row?.passwordHash ?? "") } } : null
}

function installRepo() {
  // Like Prisma, return a snapshot: the action must not see its own update when it reads the previous state.
  repo.findUtilisateurById.mockImplementation(async (id: string) => {
    const row = store.rows.find((r) => r.id === id)
    return row ? { ...row } : null
  })
  repo.findUtilisateurByEmail.mockImplementation(
    async (org: string, email: string) => store.rows.find((r) => r.organisationId === org && r.email === email) ?? null
  )
  // The repository writes the change and its audit entry together: the mock mirrors that by recording the entry
  // when the change is applied. The last-administrator rule is verified against the real repository in
  // tests/repositories/utilisateur-garde-admin.test.ts.
  repo.creerUtilisateurAvecJournal.mockImplementation(async (data: Partial<Row> & { organisationId: string }, journal: Record<string, unknown>) => {
    const row = { id: `new-${store.rows.length + 1}`, actif: true, consentementPolitiqueAt: null, createdAt: new Date(), ...data } as Row
    store.rows.push(row)
    createAuditLog({ ...journal, organisationId: data.organisationId, tableCible: "utilisateur", enregistrementId: row.id })
    return { ...row }
  })
  repo.modifierUtilisateurAvecJournal.mockImplementation(
    async (org: string, id: string, changes: Partial<Row>, journal: Record<string, unknown>) => {
      const row = store.rows.find((r) => r.id === id && r.organisationId === org)
      if (!row) throw new Error("Utilisateur introuvable")
      const retire =
        row.role === "ADMIN" &&
        row.actif &&
        ((changes.role !== undefined && changes.role !== "ADMIN") || changes.actif === false)
      if (retire && !store.rows.some((r) => r.id !== id && r.organisationId === org && r.role === "ADMIN" && r.actif)) {
        throw new DernierAdministrateurError()
      }
      Object.assign(row, changes)
      createAuditLog({ ...journal, organisationId: org, tableCible: "utilisateur", enregistrementId: id })
      return { ...row }
    }
  )
}

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

const row = (id: string) => store.rows.find((r) => r.id === id)!

describe("gestion des utilisateurs (administrateur)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seed()
    installRepo()
    authMock.mockImplementation(async () => store.session)
    connecteEn("admin-1")
  })

  describe("invitation", () => {
    it("crée le compte dans l'organisation de l'administrateur avec un mot de passe temporaire haché", async () => {
      const result = await inviteUtilisateur(form({ email: "Nouveau@Org1.test", nom: "Nouvelle", role: "EVALUATEUR" }))

      expect(result.ok).toBe(true)
      if (!result.ok) return
      const created = store.rows.find((r) => r.email === "nouveau@org1.test")!
      expect(created.organisationId).toBe(ORG)
      expect(created.role).toBe("EVALUATEUR")
      // Regression: an invited user must change the temporary password at first access.
      expect(created.motDePasseTemporaire).toBe(true)
      expect(created.passwordHash).not.toBe(result.motDePasseTemporaire)
      expect(await bcrypt.compare(result.motDePasseTemporaire, created.passwordHash!)).toBe(true)
    })

    it("génère un mot de passe temporaire différent à chaque invitation", async () => {
      const a = await inviteUtilisateur(form({ email: "a@org1.test", role: "EVALUATEUR" }))
      const b = await inviteUtilisateur(form({ email: "b@org1.test", role: "EVALUATEUR" }))
      expect(a.ok && b.ok && a.motDePasseTemporaire !== b.motDePasseTemporaire).toBe(true)
      expect(a.ok && a.motDePasseTemporaire.length).toBeGreaterThanOrEqual(16)
    })

    it("journalise l'invitation dans l'audit", async () => {
      await inviteUtilisateur(form({ email: "a@org1.test", role: "DEVELOPPEUR" }))
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: ORG,
          tableCible: "utilisateur",
          utilisateurId: "admin-1",
          action: "INSERT",
          diff: { email: "a@org1.test", role: "DEVELOPPEUR" },
        })
      )
    })

    it("régression : un non-administrateur ne peut pas inviter", async () => {
      connecteEn("eval-1")
      const result = await inviteUtilisateur(form({ email: "a@org1.test", role: "ADMIN" }))
      expect(result).toEqual({ ok: false, error: "Accès réservé aux administrateurs" })
      expect(repo.creerUtilisateurAvecJournal).not.toHaveBeenCalled()
    })

    it("régression : une session absente ne peut pas inviter", async () => {
      connecteEn(null)
      const result = await inviteUtilisateur(form({ email: "a@org1.test", role: "ADMIN" }))
      expect(result.ok).toBe(false)
      expect(repo.creerUtilisateurAvecJournal).not.toHaveBeenCalled()
    })

    it("refuse un courriel déjà utilisé dans la même organisation", async () => {
      const result = await inviteUtilisateur(form({ email: "eval@org1.test", role: "EVALUATEUR" }))
      expect(result).toEqual({ ok: false, error: "Un utilisateur utilise déjà ce courriel" })
    })

    it("accepte un courriel déjà utilisé dans une autre organisation", async () => {
      const result = await inviteUtilisateur(form({ email: "x@org2.test", role: "EVALUATEUR" }))
      expect(result.ok).toBe(true)
    })

    it("traduit une collision de courriel simultanée (contrainte unique) en erreur lisible", async () => {
      repo.creerUtilisateurAvecJournal.mockRejectedValueOnce(Object.assign(new Error("unique"), { code: "P2002" }))
      const result = await inviteUtilisateur(form({ email: "course@org1.test", role: "EVALUATEUR" }))
      expect(result).toEqual({ ok: false, error: "Un utilisateur utilise déjà ce courriel" })
    })

    it("refuse un rôle hors liste", async () => {
      const result = await inviteUtilisateur(form({ email: "a@org1.test", role: "SUPERUSER" }))
      expect(result).toEqual({ ok: false, error: "Rôle invalide" })
      expect(repo.creerUtilisateurAvecJournal).not.toHaveBeenCalled()
    })

    it("refuse un courriel invalide", async () => {
      const result = await inviteUtilisateur(form({ email: "pas-un-courriel", role: "EVALUATEUR" }))
      expect(result).toEqual({ ok: false, error: "Courriel invalide" })
    })
  })

  describe("changement de rôle", () => {
    it("change le rôle d'un utilisateur de l'organisation et le journalise", async () => {
      const result = await changerRoleUtilisateur("eval-1", "DEVELOPPEUR")
      expect(result).toEqual({ ok: true })
      expect(row("eval-1").role).toBe("DEVELOPPEUR")
      expect(createAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: "UPDATE", diff: { role: "DEVELOPPEUR", ancienRole: "EVALUATEUR" } })
      )
    })

    it("régression : un administrateur ne peut pas modifier son propre rôle", async () => {
      const result = await changerRoleUtilisateur("admin-1", "EVALUATEUR")
      expect(result).toEqual({ ok: false, error: "Vous ne pouvez pas modifier votre propre rôle" })
      expect(row("admin-1").role).toBe("ADMIN")
    })

    it("régression : un utilisateur d'une autre organisation est introuvable", async () => {
      const result = await changerRoleUtilisateur("x-1", "EVALUATEUR")
      expect(result).toEqual({ ok: false, error: "Utilisateur introuvable" })
      expect(row("x-1").role).toBe("ADMIN")
    })

    it("refuse un rôle hors liste", async () => {
      expect(await changerRoleUtilisateur("eval-1", "ROOT")).toEqual({ ok: false, error: "Rôle invalide" })
    })

    it("régression : un non-administrateur ne peut pas changer de rôle", async () => {
      connecteEn("eval-1")
      expect((await changerRoleUtilisateur("admin-2", "EVALUATEUR")).ok).toBe(false)
      expect(row("admin-2").role).toBe("ADMIN")
    })
  })

  describe("activation et désactivation", () => {
    it("désactive un utilisateur de l'organisation et le journalise", async () => {
      const result = await definirActiviteUtilisateur("eval-1", false)
      expect(result).toEqual({ ok: true })
      expect(row("eval-1").actif).toBe(false)
      expect(createAuditLog).toHaveBeenCalledWith(expect.objectContaining({ diff: { actif: false } }))
    })

    it("réactive un utilisateur désactivé", async () => {
      row("eval-1").actif = false
      expect(await definirActiviteUtilisateur("eval-1", true)).toEqual({ ok: true })
      expect(row("eval-1").actif).toBe(true)
    })

    it("régression : un administrateur ne peut pas désactiver son propre compte", async () => {
      const result = await definirActiviteUtilisateur("admin-1", false)
      expect(result).toEqual({ ok: false, error: "Vous ne pouvez pas désactiver votre propre compte" })
      expect(row("admin-1").actif).toBe(true)
    })

    it("régression : un utilisateur d'une autre organisation ne peut pas être désactivé", async () => {
      expect(await definirActiviteUtilisateur("x-1", false)).toEqual({ ok: false, error: "Utilisateur introuvable" })
      expect(row("x-1").actif).toBe(true)
    })

    it("ne journalise pas une demande sans effet", async () => {
      expect(await definirActiviteUtilisateur("eval-1", true)).toEqual({ ok: true })
      expect(repo.modifierUtilisateurAvecJournal).not.toHaveBeenCalled()
      expect(createAuditLog).not.toHaveBeenCalled()
    })

    it("régression : un non-administrateur ne peut pas désactiver quelqu'un", async () => {
      connecteEn("eval-1")
      expect((await definirActiviteUtilisateur("admin-2", false)).ok).toBe(false)
      expect(row("admin-2").actif).toBe(true)
    })
  })
})

describe("erreurs des actions utilisateurs : { ok, error }, jamais d'exception", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    seed()
    installRepo()
    authMock.mockImplementation(async () => store.session)
    connecteEn("admin-1")
    vi.spyOn(console, "error").mockImplementation(() => {})
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("traduit le refus du dernier administrateur en erreur lisible", async () => {
    repo.modifierUtilisateurAvecJournal.mockRejectedValueOnce(new DernierAdministrateurError())
    const result = await changerRoleUtilisateur("admin-2", "EVALUATEUR")
    expect(result).toEqual({ ok: false, error: "Au moins un administrateur actif doit rester dans l'organisation" })
  })

  it("traduit un conflit de transaction sérialisable (P2034) en demande de réessai", async () => {
    repo.modifierUtilisateurAvecJournal.mockRejectedValueOnce(Object.assign(new Error("write conflict"), { code: "P2034" }))
    const result = await definirActiviteUtilisateur("eval-1", false)
    expect(result).toEqual({ ok: false, error: "Une autre modification est en cours. Réessayez." })
  })

  it("renvoie une erreur générique, sans lever d'exception, pour une panne inattendue", async () => {
    repo.modifierUtilisateurAvecJournal.mockRejectedValueOnce(new Error("connexion perdue"))
    const result = await definirActiviteUtilisateur("eval-1", false)
    expect(result).toEqual({ ok: false, error: "Impossible d'enregistrer la modification. Réessayez." })
  })
})
