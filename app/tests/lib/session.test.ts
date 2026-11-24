import { describe, it, expect, vi, beforeEach } from "vitest"

const authMock = vi.hoisted(() => vi.fn())
const findUtilisateurById = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/repositories/utilisateur.repository", () => ({ findUtilisateurById }))

import { getCurrentAdmin, getCurrentUser, isRole } from "@/lib/session"
import { empreinteMotDePasse } from "@/lib/password-fingerprint"

const HASH = "hash-test"

const base = {
  id: "user-1",
  email: "u@org1.test",
  nom: "Utilisateur",
  organisationId: "org-1",
  role: "EVALUATEUR",
  actif: true,
  passwordHash: HASH,
  motDePasseTemporaire: false,
  consentementPolitiqueAt: null,
}

describe("session courante", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: "user-1", empreinte: empreinteMotDePasse(HASH) } })
    findUtilisateurById.mockResolvedValue({ ...base })
  })

  it("renvoie null sans session", async () => {
    authMock.mockResolvedValue(null)
    expect(await getCurrentUser()).toBeNull()
    expect(findUtilisateurById).not.toHaveBeenCalled()
  })

  it("renvoie l'utilisateur et son organisation depuis la base", async () => {
    const user = await getCurrentUser()
    expect(user).toMatchObject({ id: "user-1", organisationId: "org-1", role: "EVALUATEUR" })
  })

  it("régression : un compte désactivé perd l'accès immédiatement, même avec une session encore valide", async () => {
    findUtilisateurById.mockResolvedValue({ ...base, actif: false })
    expect(await getCurrentUser()).toBeNull()
  })

  it("régression : le rôle vient de la base, pas du jeton de session", async () => {
    // The session still claims ADMIN from before a demotion; the database says EVALUATEUR.
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN", empreinte: empreinteMotDePasse(HASH) } })
    expect(await getCurrentAdmin()).toBeNull()
  })

  it("accorde l'accès administrateur à un administrateur actif", async () => {
    findUtilisateurById.mockResolvedValue({ ...base, role: "ADMIN" })
    expect((await getCurrentAdmin())?.role).toBe("ADMIN")
  })

  it("refuse un rôle inconnu en base", async () => {
    findUtilisateurById.mockResolvedValue({ ...base, role: "ROOT" })
    expect(await getCurrentUser()).toBeNull()
  })

  it("isRole n'accepte que les rôles de la spécification", () => {
    expect(isRole("ADMIN")).toBe(true)
    expect(isRole("EVALUATEUR")).toBe(true)
    expect(isRole("DEVELOPPEUR")).toBe(true)
    expect(isRole("admin")).toBe(false)
  })
})
