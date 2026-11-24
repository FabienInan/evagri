import { describe, it, expect, vi, beforeEach } from "vitest"
import bcrypt from "bcryptjs"
import { empreinteMotDePasse } from "@/lib/password-fingerprint"

// Capture the configuration object handed to NextAuth so the credentials provider can be exercised directly.
const captured = vi.hoisted(() => ({ config: undefined as unknown as AuthConfigForTest }))

interface AuthConfigForTest {
  providers: { authorize: (credentials: Record<string, unknown>, req: Request) => Promise<unknown> }[]
  callbacks: {
    jwt: (args: { token: Record<string, unknown>; user?: Record<string, unknown> }) => Record<string, unknown>
    session: (args: { session: { user: Record<string, unknown> }; token: Record<string, unknown> }) => { user: Record<string, unknown> }
  }
  pages: { signIn: string }
  session: { strategy: string }
}

vi.mock("next-auth", () => ({
  default: (config: unknown) => {
    captured.config = config as AuthConfigForTest
    return { handlers: {}, auth: vi.fn(), signIn: vi.fn(), signOut: vi.fn() }
  },
}))
vi.mock("next-auth/providers/credentials", () => ({ default: (options: unknown) => options }))

const { findFirst, update } = vi.hoisted(() => ({ findFirst: vi.fn(), update: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ prisma: { utilisateur: { findFirst, update } } }))

const PASSWORD = "mot-de-passe-test"
const passwordHash = bcrypt.hashSync(PASSWORD, 4)

const admin = {
  id: "user-1",
  email: "admin@example.org",
  nom: "Admin Test",
  role: "ADMIN",
  organisationId: "org-1",
  passwordHash,
  actif: true,
  echecsConnexion: 0,
  verrouilleJusqua: null as Date | null,
}

// Simulates the database: the query only returns rows matching the filter, including `actif: true`.
function fakeDatabase(rows: typeof admin[]) {
  findFirst.mockImplementation(async ({ where }: { where: { email: string; actif?: boolean } }) => {
    return (
      rows.find((r) => r.email === where.email && (where.actif === undefined || r.actif === where.actif)) ?? null
    )
  })
}

// Import after the mocks above are registered.
await import("@/lib/auth")

const provider = () => captured.config.providers[0]
const authorize = (credentials: Record<string, unknown>) => provider().authorize(credentials, new Request("http://x"))

describe("Auth.js credentials provider", () => {
  beforeEach(() => {
    findFirst.mockReset()
    update.mockReset()
    update.mockResolvedValue({ echecsConnexion: 1 })
  })

  it("accepte des identifiants valides et renvoie le rôle et l'organisation", async () => {
    fakeDatabase([admin])
    const user = await authorize({ email: admin.email, password: PASSWORD })
    expect(user).toEqual({
      id: "user-1",
      email: "admin@example.org",
      name: "Admin Test",
      role: "ADMIN",
      organisationId: "org-1",
      empreinte: empreinteMotDePasse(passwordHash),
    })
  })

  it("refuse un mot de passe incorrect", async () => {
    fakeDatabase([admin])
    expect(await authorize({ email: admin.email, password: "mauvais-mot-de-passe" })).toBeNull()
  })

  it("compte chaque échec de connexion dans la base, sans révéler lequel", async () => {
    fakeDatabase([admin])
    expect(await authorize({ email: admin.email, password: "mauvais-mot-de-passe" })).toBeNull()
    expect(update).toHaveBeenCalledWith({ where: { id: "user-1" }, data: { echecsConnexion: { increment: 1 } }, select: { echecsConnexion: true } })
  })

  it("verrouille le compte après 5 échecs consécutifs, pendant 15 minutes", async () => {
    fakeDatabase([admin])
    update.mockResolvedValueOnce({ echecsConnexion: 5 })
    const avant = Date.now()
    expect(await authorize({ email: admin.email, password: "mauvais-mot-de-passe" })).toBeNull()

    const verrou = update.mock.calls.find((c) => c[0].data.verrouilleJusqua)
    expect(verrou).toBeDefined()
    const jusqua = (verrou![0].data.verrouilleJusqua as Date).getTime()
    expect(jusqua - avant).toBeGreaterThanOrEqual(15 * 60 * 1000 - 1000)
    expect(jusqua - avant).toBeLessThanOrEqual(15 * 60 * 1000 + 1000)
    expect(verrou![0].data.echecsConnexion).toBe(0)
  })

  it("un compte verrouillé refuse même le bon mot de passe, sans le vérifier", async () => {
    fakeDatabase([{ ...admin, echecsConnexion: 5, verrouilleJusqua: new Date(Date.now() + 60_000) }])
    expect(await authorize({ email: admin.email, password: PASSWORD })).toBeNull()
    expect(update).not.toHaveBeenCalled()
  })

  it("un verrou expiré n'empêche plus la connexion, et remet le compteur à zéro", async () => {
    fakeDatabase([{ ...admin, echecsConnexion: 5, verrouilleJusqua: new Date(Date.now() - 1000) }])
    const user = await authorize({ email: admin.email, password: PASSWORD })
    expect(user).not.toBeNull()
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { echecsConnexion: 0, verrouilleJusqua: null },
    })
  })

  it("une connexion réussie remet à zéro les échecs précédents", async () => {
    fakeDatabase([{ ...admin, echecsConnexion: 3 }])
    expect(await authorize({ email: admin.email, password: PASSWORD })).not.toBeNull()
    expect(update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { echecsConnexion: 0, verrouilleJusqua: null },
    })
  })

  it("refuse un courriel inconnu", async () => {
    fakeDatabase([admin])
    expect(await authorize({ email: "inconnu@example.org", password: PASSWORD })).toBeNull()
  })

  it("régression : un utilisateur désactivé ne peut plus se connecter", async () => {
    fakeDatabase([{ ...admin, actif: false }])
    expect(await authorize({ email: admin.email, password: PASSWORD })).toBeNull()
    expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { email: admin.email, actif: true } }))
  })

  it("ignore la casse et les espaces autour du courriel", async () => {
    fakeDatabase([admin])
    const user = (await authorize({ email: "  ADMIN@Example.ORG ", password: PASSWORD })) as { id: string } | null
    expect(user?.id).toBe("user-1")
  })

  it("ne interroge pas la base quand le courriel est invalide ou le mot de passe absent", async () => {
    fakeDatabase([admin])
    expect(await authorize({ email: "pas-un-courriel", password: PASSWORD })).toBeNull()
    expect(await authorize({ email: admin.email, password: "" })).toBeNull()
    expect(findFirst).not.toHaveBeenCalled()
  })

  it("jwt copie le rôle et l'organisation dans le jeton, session les expose", () => {
    const token = captured.config.callbacks.jwt({
      token: { sub: "user-1" },
      user: { role: "ADMIN", organisationId: "org-1" },
    })
    expect(token).toMatchObject({ sub: "user-1", role: "ADMIN", organisationId: "org-1" })

    const session = captured.config.callbacks.session({
      session: { user: { email: admin.email } },
      token,
    })
    expect(session.user).toMatchObject({ id: "user-1", role: "ADMIN", organisationId: "org-1" })
  })

  it("jwt ne touche pas au jeton lors des rafraîchissements sans utilisateur", () => {
    const token = captured.config.callbacks.jwt({ token: { sub: "user-1", role: "ADMIN", organisationId: "org-1" } })
    expect(token).toMatchObject({ role: "ADMIN", organisationId: "org-1" })
  })

  it("utilise les pages de connexion de l'application et des sessions JWT", () => {
    expect(captured.config.pages.signIn).toBe("/login")
    expect(captured.config.session.strategy).toBe("jwt")
  })
})
