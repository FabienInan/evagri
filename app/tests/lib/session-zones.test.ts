import { describe, it, expect, vi, beforeEach } from "vitest"

const authMock = vi.hoisted(() => vi.fn())
const findUtilisateurById = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  })
)

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("@/repositories/utilisateur.repository", () => ({ findUtilisateurById }))

import { verifierZone, exigerZonePage, zonesDeLUtilisateur, MESSAGE_ACCES_NON_AUTORISE } from "@/lib/session"
import { empreinteMotDePasse } from "@/lib/password-fingerprint"

const HASH = "hash-test"

function connecte(role: string, actif = true) {
  authMock.mockResolvedValue({ user: { id: "user-1", empreinte: empreinteMotDePasse(HASH) } })
  findUtilisateurById.mockResolvedValue({
    id: "user-1",
    email: "u@org1.test",
    nom: null,
    organisationId: "org-1",
    role,
    actif,
    passwordHash: HASH,
    motDePasseTemporaire: false,
    consentementPolitiqueAt: null,
  })
}

describe("gardes de zone", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("verifierZone laisse passer un rôle qui a la zone", async () => {
    connecte("EVALUATEUR")
    const acces = await verifierZone("evaluation")
    expect(acces).toMatchObject({ ok: true, utilisateur: { role: "EVALUATEUR" } })
  })

  it("régression : verifierZone refuse un rôle sans la zone (évaluateur sur la configuration)", async () => {
    connecte("EVALUATEUR")
    expect(await verifierZone("configuration")).toEqual({ ok: false, error: MESSAGE_ACCES_NON_AUTORISE })
  })

  it("régression : verifierZone refuse le développeur sur les transactions", async () => {
    connecte("DEVELOPPEUR")
    expect(await verifierZone("evaluation")).toEqual({ ok: false, error: MESSAGE_ACCES_NON_AUTORISE })
  })

  it("régression : verifierZone refuse sans session, sans lever d'exception", async () => {
    authMock.mockResolvedValue(null)
    expect(await verifierZone("evaluation")).toEqual({ ok: false, error: MESSAGE_ACCES_NON_AUTORISE })
  })

  it("régression : verifierZone refuse un compte désactivé", async () => {
    connecte("ADMIN", false)
    expect(await verifierZone("administration")).toEqual({ ok: false, error: MESSAGE_ACCES_NON_AUTORISE })
  })

  it("régression : verifierZone refuse un compte qui doit changer son mot de passe", async () => {
    connecte("ADMIN")
    findUtilisateurById.mockResolvedValue({
      ...(await findUtilisateurById()),
      motDePasseTemporaire: true,
    })
    expect(await verifierZone("administration")).toEqual({ ok: false, error: MESSAGE_ACCES_NON_AUTORISE })
  })

  it("exigerZonePage redirige l'évaluateur de /admin/import vers sa page d'accueil", async () => {
    connecte("EVALUATEUR")
    await expect(exigerZonePage("configuration")).rejects.toThrow("REDIRECT:/transactions")
  })

  it("exigerZonePage redirige le développeur de /transactions vers /admin/import", async () => {
    connecte("DEVELOPPEUR")
    await expect(exigerZonePage("evaluation")).rejects.toThrow("REDIRECT:/admin/import")
  })

  it("exigerZonePage redirige vers /login sans session", async () => {
    authMock.mockResolvedValue(null)
    await expect(exigerZonePage("evaluation")).rejects.toThrow("REDIRECT:/login")
  })

  it("exigerZonePage laisse passer un rôle autorisé", async () => {
    connecte("ADMIN")
    await expect(exigerZonePage("administration")).resolves.toMatchObject({ role: "ADMIN" })
    expect(redirect).not.toHaveBeenCalled()
  })

  it("la navigation n'affiche que les zones du rôle", async () => {
    connecte("DEVELOPPEUR")
    expect(await zonesDeLUtilisateur()).toEqual(["configuration"])
    connecte("EVALUATEUR")
    expect(await zonesDeLUtilisateur()).toEqual(["evaluation"])
    authMock.mockResolvedValue(null)
    expect(await zonesDeLUtilisateur()).toEqual([])
  })
})
