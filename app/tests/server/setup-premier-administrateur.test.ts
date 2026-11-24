import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"

const db = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
}))
const findDefaultOrganisation = vi.hoisted(() => vi.fn())
const createAuditLog = vi.hoisted(() => vi.fn())

vi.mock("@/lib/prisma", () => ({
  prisma: {
    utilisateur: { count: db.count, create: db.create },
    $transaction: db.transaction,
  },
}))
vi.mock("@/repositories/organisation.repository", () => ({ findDefaultOrganisation }))
vi.mock("@/repositories/audit.repository", () => ({ createAuditLog }))

import { createPremierAdministrateur } from "@/server/actions/setup"

const MOT_DE_PASSE = "mot-de-passe-solide-1"

function formulaire(overrides: Record<string, string> = {}) {
  const data = {
    nom: "Admin Test",
    email: "Admin@Example.org",
    password: MOT_DE_PASSE,
    confirmation: MOT_DE_PASSE,
    ...overrides,
  }
  const fd = new FormData()
  for (const [key, value] of Object.entries(data)) fd.set(key, value)
  return fd
}

describe("création du premier administrateur (setup)", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    findDefaultOrganisation.mockResolvedValue({ id: "org-1", nom: "EVAGRI" })
    // The transaction runs its callback against the same fake client.
    db.transaction.mockImplementation(async (fn: (tx: unknown) => unknown) =>
      fn({ utilisateur: { count: db.count, create: db.create } })
    )
    db.create.mockImplementation(async ({ data }: { data: object }) => ({ id: "user-1", ...data }))
  })

  it("crée un administrateur ADMIN dans l'organisation existante", async () => {
    db.count.mockResolvedValue(0)
    const result = await createPremierAdministrateur(formulaire())

    expect(result).toEqual({ ok: true })
    expect(db.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organisationId: "org-1",
        email: "admin@example.org",
        nom: "Admin Test",
        role: "ADMIN",
      }),
    })
  })

  it("ne stocke jamais le mot de passe en clair", async () => {
    db.count.mockResolvedValue(0)
    await createPremierAdministrateur(formulaire())

    const { passwordHash } = db.create.mock.calls[0][0].data
    expect(passwordHash).not.toBe(MOT_DE_PASSE)
    expect(await bcrypt.compare(MOT_DE_PASSE, passwordHash)).toBe(true)
  })

  it("utilise une transaction sérialisable pour que deux setups simultanés ne créent pas deux admins", async () => {
    db.count.mockResolvedValue(0)
    await createPremierAdministrateur(formulaire())
    expect(db.transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" })
  })

  it("régression : le setup est refusé dès qu'un utilisateur existe", async () => {
    db.count.mockResolvedValue(1)
    const result = await createPremierAdministrateur(formulaire())

    expect(result).toEqual({ ok: false, error: "La configuration initiale est déjà faite." })
    expect(db.create).not.toHaveBeenCalled()
    expect(createAuditLog).not.toHaveBeenCalled()
  })

  it("journalise la création dans le journal d'audit", async () => {
    db.count.mockResolvedValue(0)
    await createPremierAdministrateur(formulaire())

    expect(createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        tableCible: "utilisateur",
        enregistrementId: "user-1",
        utilisateurId: "user-1",
        action: "CREATE_PREMIER_ADMINISTRATEUR",
      })
    )
  })

  it("refuse un mot de passe de moins de 12 caractères", async () => {
    const result = await createPremierAdministrateur(
      formulaire({ password: "court", confirmation: "court" })
    )
    expect(result).toEqual({ ok: false, error: "Le mot de passe doit contenir au moins 12 caractères" })
    expect(db.transaction).not.toHaveBeenCalled()
  })

  it("refuse une confirmation différente du mot de passe", async () => {
    const result = await createPremierAdministrateur(formulaire({ confirmation: "autre-mot-de-passe-2" }))
    expect(result).toEqual({ ok: false, error: "Les mots de passe ne correspondent pas" })
  })

  it("refuse un courriel invalide", async () => {
    const result = await createPremierAdministrateur(formulaire({ email: "pas-un-courriel" }))
    expect(result).toEqual({ ok: false, error: "Courriel invalide" })
  })

  it("refuse un nom vide", async () => {
    const result = await createPremierAdministrateur(formulaire({ nom: "   " }))
    expect(result).toEqual({ ok: false, error: "Le nom est requis" })
  })

  it("signale une organisation introuvable au lieu de créer un utilisateur orphelin", async () => {
    findDefaultOrganisation.mockResolvedValue(null)
    const result = await createPremierAdministrateur(formulaire())
    expect(result.ok).toBe(false)
    expect(db.transaction).not.toHaveBeenCalled()
  })
})
