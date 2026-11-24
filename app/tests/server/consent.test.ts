import { describe, it, expect, vi, beforeEach } from "vitest"

const authMock = vi.hoisted(() => vi.fn())
const findUtilisateurById = vi.hoisted(() => vi.fn())
const enregistrerConsentementAvecJournal = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/repositories/utilisateur.repository", () => ({
  findUtilisateurById,
  enregistrerConsentementAvecJournal,
}))

import { accepterPolitiqueConfidentialite } from "@/server/actions/consent"
import { empreinteMotDePasse } from "@/lib/password-fingerprint"

const HASH = "hash-test"

const utilisateur = (overrides: Record<string, unknown> = {}) => ({
  id: "user-1",
  email: "eval@org1.test",
  nom: "Évaluateur",
  organisationId: "org-1",
  role: "EVALUATEUR",
  actif: true,
  passwordHash: HASH,
  motDePasseTemporaire: false,
  consentementPolitiqueAt: null,
  ...overrides,
})

describe("consentement à la politique de confidentialité (Loi 25)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMock.mockResolvedValue({ user: { id: "user-1", empreinte: empreinteMotDePasse(HASH) } })
    findUtilisateurById.mockResolvedValue(utilisateur())
    enregistrerConsentementAvecJournal.mockResolvedValue(undefined)
  })

  it("enregistre la date d'acceptation pour l'utilisateur connecté, avec son entrée de journal", async () => {
    const result = await accepterPolitiqueConfidentialite()

    expect(result).toEqual({ ok: true })
    // La date et l'entrée de journal partent dans la même transaction (repository).
    expect(enregistrerConsentementAvecJournal).toHaveBeenCalledWith(
      "org-1",
      "user-1",
      expect.any(Date),
      expect.objectContaining({ utilisateurId: "user-1", action: "CONSENT_POLITIQUE" })
    )
  })

  it("régression : l'acceptation ne touche jamais le compte d'un autre utilisateur", async () => {
    await accepterPolitiqueConfidentialite()
    for (const call of enregistrerConsentementAvecJournal.mock.calls) {
      expect(call[1]).toBe("user-1")
    }
  })

  it("renvoie une erreur lisible, sans exception, si l'enregistrement échoue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    enregistrerConsentementAvecJournal.mockRejectedValueOnce(new Error("panne"))
    const result = await accepterPolitiqueConfidentialite()
    expect(result).toEqual({ ok: false, error: "Impossible d'enregistrer votre acceptation. Réessayez." })
    vi.mocked(console.error).mockRestore()
  })

  it("est idempotente : un utilisateur déjà consentant n'est pas réécrit", async () => {
    findUtilisateurById.mockResolvedValue(utilisateur({ consentementPolitiqueAt: new Date("2026-10-01") }))
    expect(await accepterPolitiqueConfidentialite()).toEqual({ ok: true })
    expect(enregistrerConsentementAvecJournal).not.toHaveBeenCalled()
  })

  it("refuse sans session", async () => {
    authMock.mockResolvedValue(null)
    const result = await accepterPolitiqueConfidentialite()
    expect(result.ok).toBe(false)
    expect(enregistrerConsentementAvecJournal).not.toHaveBeenCalled()
  })

  it("refuse pour un compte désactivé même si la session existe encore", async () => {
    findUtilisateurById.mockResolvedValue(utilisateur({ actif: false }))
    const result = await accepterPolitiqueConfidentialite()
    expect(result.ok).toBe(false)
    expect(enregistrerConsentementAvecJournal).not.toHaveBeenCalled()
  })
})
