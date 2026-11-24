import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"
import { empreinteMotDePasse } from "@/lib/password-fingerprint"

// In-memory utilisateur table: the actions are tested against real state transitions.
type Row = {
  id: string
  organisationId: string
  email: string
  nom: string | null
  role: string
  actif: boolean
  passwordHash: string
  motDePasseTemporaire: boolean
  consentementPolitiqueAt: Date | null
  createdAt: Date
}

const store = vi.hoisted(() => ({ rows: [] as Row[], session: null as null | { user: Record<string, string> } }))
const repo = vi.hoisted(() => ({
  findUtilisateurById: vi.fn(),
  modifierUtilisateurAvecJournal: vi.fn(),
}))
const createAuditLog = vi.hoisted(() => vi.fn())
const authMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/repositories/utilisateur.repository", () => ({
  findUtilisateurById: repo.findUtilisateurById,
  modifierUtilisateurAvecJournal: repo.modifierUtilisateurAvecJournal,
  findUtilisateurByEmail: vi.fn(async () => null),
  creerUtilisateurAvecJournal: vi.fn(),
  enregistrerConsentementAvecJournal: vi.fn(),
  listUtilisateursByOrganisation: vi.fn(),
  DernierAdministrateurError: class DernierAdministrateurError extends Error {},
}))
vi.mock("@/repositories/audit.repository", () => ({ createAuditLog }))

import { reinitialiserMotDePasseUtilisateur } from "@/server/actions/users"
import { changerMotDePasse } from "@/server/actions/compte"
import { getCurrentUser, verifierZone, zonesDeLUtilisateur } from "@/lib/session"
import { gardeApi } from "@/lib/api-guard"

const ORG = "org-1"
const ANCIEN = "ancien-mot-de-passe-1"
let hashAdmin: string
let hashEval: string

function seed() {
  const base = { nom: null, consentementPolitiqueAt: null, createdAt: new Date(0), motDePasseTemporaire: false }
  store.rows = [
    { ...base, id: "admin-1", organisationId: ORG, email: "admin@org1.test", role: "ADMIN", actif: true, passwordHash: hashAdmin },
    { ...base, id: "eval-1", organisationId: ORG, email: "eval@org1.test", role: "EVALUATEUR", actif: true, passwordHash: hashEval },
    { ...base, id: "x-1", organisationId: "org-2", email: "x@org2.test", role: "EVALUATEUR", actif: true, passwordHash: hashEval },
  ]
}

function connecteEn(id: string | null) {
  const row = store.rows.find((r) => r.id === id)
  store.session = id && row ? { user: { id, empreinte: empreinteMotDePasse(row.passwordHash) } } : null
}

const row = (id: string) => store.rows.find((r) => r.id === id)!

function form(fields: Record<string, string>) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) fd.set(k, v)
  return fd
}

beforeEach(async () => {
  vi.clearAllMocks()
  hashAdmin = await bcrypt.hash("admin-mot-de-passe-1", 4)
  hashEval = await bcrypt.hash(ANCIEN, 4)
  seed()
  repo.findUtilisateurById.mockImplementation(async (id: string) => {
    const r = store.rows.find((x) => x.id === id)
    return r ? { ...r } : null
  })
  // Mirrors the repository: the change and its audit entry are recorded together.
  repo.modifierUtilisateurAvecJournal.mockImplementation(
    async (org: string, id: string, changes: Partial<Row>, journal: Record<string, unknown>) => {
      const cible = store.rows.find((r) => r.id === id && r.organisationId === org)
      if (!cible) throw new Error("Utilisateur introuvable")
      Object.assign(cible, changes)
      createAuditLog({ ...journal, organisationId: org, tableCible: "utilisateur", enregistrementId: id })
      return { ...cible }
    }
  )
  authMock.mockImplementation(async () => store.session)
  connecteEn("admin-1")
})

describe("réinitialisation du mot de passe par l'administrateur", () => {
  it("génère un mot de passe temporaire, stocké haché, et force le changement", async () => {
    const result = await reinitialiserMotDePasseUtilisateur("eval-1")
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(row("eval-1").motDePasseTemporaire).toBe(true)
    expect(row("eval-1").passwordHash).not.toBe(result.motDePasseTemporaire)
    expect(await bcrypt.compare(result.motDePasseTemporaire, row("eval-1").passwordHash)).toBe(true)
    expect(await bcrypt.compare(ANCIEN, row("eval-1").passwordHash)).toBe(false)
  })

  it("régression : les sessions ouvertes avec l'ancien mot de passe cessent de fonctionner", async () => {
    connecteEn("eval-1")
    const sessionEvaluateur = store.session
    expect(await getCurrentUser()).not.toBeNull()

    // The administrator performs the reset with their own session.
    connecteEn("admin-1")
    const result = await reinitialiserMotDePasseUtilisateur("eval-1")
    expect(result.ok).toBe(true)

    store.session = sessionEvaluateur
    expect(await getCurrentUser()).toBeNull()
  })

  it("le compte réinitialisé ne peut plus rien faire tant qu'il n'a pas changé son mot de passe", async () => {
    await reinitialiserMotDePasseUtilisateur("eval-1")
    connecteEn("eval-1")
    const user = await getCurrentUser()
    expect(user?.motDePasseTemporaire).toBe(true)
    expect(await verifierZone("evaluation")).toEqual({ ok: false, error: "Accès non autorisé" })
    expect(await zonesDeLUtilisateur()).toEqual([])
  })

  it("journalise la réinitialisation sans jamais écrire le mot de passe dans l'audit", async () => {
    const result = await reinitialiserMotDePasseUtilisateur("eval-1")
    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "RESET_MOT_DE_PASSE", utilisateurId: "admin-1", enregistrementId: "eval-1" })
    )
    const audit = createAuditLog.mock.calls[0][0]
    expect(JSON.stringify(audit)).not.toContain(result.ok ? result.motDePasseTemporaire : "")
  })

  it("régression : un non-administrateur ne peut pas réinitialiser un mot de passe", async () => {
    connecteEn("eval-1")
    const result = await reinitialiserMotDePasseUtilisateur("admin-1")
    expect(result.ok).toBe(false)
    expect(row("admin-1").motDePasseTemporaire).toBe(false)
  })

  it("régression : un administrateur ne réinitialise pas son propre mot de passe par ce chemin", async () => {
    const result = await reinitialiserMotDePasseUtilisateur("admin-1")
    expect(result).toEqual({ ok: false, error: "Modifiez votre propre mot de passe depuis votre compte" })
    expect(row("admin-1").motDePasseTemporaire).toBe(false)
  })

  it("régression : un utilisateur d'une autre organisation est introuvable", async () => {
    const result = await reinitialiserMotDePasseUtilisateur("x-1")
    expect(result).toEqual({ ok: false, error: "Utilisateur introuvable" })
    expect(repo.modifierUtilisateurAvecJournal).not.toHaveBeenCalled()
  })

  it("un administrateur dont le mot de passe est temporaire perd les droits d'administration", async () => {
    await reinitialiserMotDePasseUtilisateur("admin-1").catch(() => undefined)
    row("admin-1").motDePasseTemporaire = true
    connecteEn("admin-1")
    const result = await reinitialiserMotDePasseUtilisateur("eval-1")
    expect(result.ok).toBe(false)
    expect(row("eval-1").motDePasseTemporaire).toBe(false)
  })
})

describe("changement de mot de passe par l'utilisateur", () => {
  it("exige le mot de passe actuel", async () => {
    connecteEn("eval-1")
    const result = await changerMotDePasse(
      form({ actuel: "mauvais-mot-de-passe", nouveau: "nouveau-mot-de-passe-2", confirmation: "nouveau-mot-de-passe-2" })
    )
    expect(result).toEqual({ ok: false, error: "Mot de passe actuel incorrect" })
    expect(await bcrypt.compare(ANCIEN, row("eval-1").passwordHash)).toBe(true)
  })

  it("refuse un nouveau mot de passe de moins de 12 caractères", async () => {
    connecteEn("eval-1")
    const result = await changerMotDePasse(form({ actuel: ANCIEN, nouveau: "court", confirmation: "court" }))
    expect(result).toEqual({ ok: false, error: "Le mot de passe doit contenir au moins 12 caractères" })
  })

  it("refuse une confirmation différente", async () => {
    connecteEn("eval-1")
    const result = await changerMotDePasse(
      form({ actuel: ANCIEN, nouveau: "nouveau-mot-de-passe-2", confirmation: "autre-mot-de-passe-3" })
    )
    expect(result).toEqual({ ok: false, error: "Les mots de passe ne correspondent pas" })
  })

  it("refuse de garder le même mot de passe", async () => {
    connecteEn("eval-1")
    const result = await changerMotDePasse(form({ actuel: ANCIEN, nouveau: ANCIEN, confirmation: ANCIEN }))
    expect(result).toEqual({ ok: false, error: "Le nouveau mot de passe doit être différent de l'actuel" })
  })

  it("change le mot de passe et lève le changement forcé", async () => {
    await reinitialiserMotDePasseUtilisateur("eval-1")
    const temporaire = (await reinitialiserMotDePasseUtilisateur("eval-1"))
    expect(temporaire.ok).toBe(true)
    connecteEn("eval-1")
    const actuel = temporaire.ok ? temporaire.motDePasseTemporaire : ""

    const result = await changerMotDePasse(
      form({ actuel, nouveau: "nouveau-mot-de-passe-2", confirmation: "nouveau-mot-de-passe-2" })
    )
    expect(result).toEqual({ ok: true })
    expect(row("eval-1").motDePasseTemporaire).toBe(false)
    expect(await bcrypt.compare("nouveau-mot-de-passe-2", row("eval-1").passwordHash)).toBe(true)
  })

  it("régression : après le changement, l'ancienne session est refusée (il faut se reconnecter)", async () => {
    connecteEn("eval-1")
    const ancienneSession = store.session
    await changerMotDePasse(form({ actuel: ANCIEN, nouveau: "nouveau-mot-de-passe-2", confirmation: "nouveau-mot-de-passe-2" }))
    store.session = ancienneSession
    expect(await getCurrentUser()).toBeNull()
  })

  it("refuse sans session", async () => {
    store.session = null
    const result = await changerMotDePasse(form({ actuel: ANCIEN, nouveau: "nouveau-mot-de-passe-2", confirmation: "nouveau-mot-de-passe-2" }))
    expect(result.ok).toBe(false)
  })
})

describe("garde d'API pendant un changement forcé", () => {
  it("renvoie 403 tant que le mot de passe temporaire n'est pas remplacé", async () => {
    row("eval-1").motDePasseTemporaire = true
    connecteEn("eval-1")
    const refus = await gardeApi("evaluation")
    expect(refus?.status).toBe(403)
    expect(await refus?.json()).toEqual({ error: "Changement de mot de passe requis" })
  })
})
