import { describe, it, expect, vi, beforeEach } from "vitest"

const signIn = vi.hoisted(() => vi.fn())
const signOut = vi.hoisted(() => vi.fn())

const FakeAuthError = vi.hoisted(() => class FakeAuthError extends Error {})

vi.mock("next-auth", () => ({ AuthError: FakeAuthError }))
vi.mock("@/lib/auth", () => ({ signIn, signOut }))

import { login, logout } from "@/server/actions/auth"

describe("login (server action)", () => {
  beforeEach(() => {
    signIn.mockReset()
    signOut.mockReset()
  })

  it("renvoie ok et demande une connexion sans redirection serveur", async () => {
    signIn.mockResolvedValue(undefined)
    const result = await login("admin@example.org", "mot-de-passe")
    expect(result).toEqual({ ok: true })
    expect(signIn).toHaveBeenCalledWith("credentials", {
      email: "admin@example.org",
      password: "mot-de-passe",
      redirect: false,
    })
  })

  it("renvoie une erreur lisible pour des identifiants refusés", async () => {
    signIn.mockRejectedValue(new FakeAuthError("CredentialsSignin"))
    expect(await login("admin@example.org", "faux")).toEqual({ ok: false, error: "Identifiants invalides" })
  })

  it("renvoie une erreur générique pour une panne inattendue, sans l'exposer ni la lever", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {})
    signIn.mockRejectedValue(new Error("base indisponible"))
    const result = await login("admin@example.org", "mot-de-passe")
    expect(result).toEqual({ ok: false, error: "Une erreur est survenue. Réessayez." })
    expect(JSON.stringify(result)).not.toContain("base indisponible")
    vi.mocked(console.error).mockRestore()
  })
})

describe("logout (server action)", () => {
  beforeEach(() => {
    signOut.mockReset()
  })

  it("déconnecte puis redirige vers /login", async () => {
    signOut.mockResolvedValue(undefined)
    await logout()
    expect(signOut).toHaveBeenCalledWith({ redirectTo: "/login" })
  })
})
