import { describe, it, expect, vi } from "vitest"

// The real auth() wrapper reads the session cookie; here it forwards the request with `auth` set by the test.
vi.mock("@/lib/auth", () => ({ auth: (handler: (req: unknown) => unknown) => handler }))

import { proxy } from "@/proxy"

interface TestRequest {
  nextUrl: URL
  url: string
  auth: object | null
}

// The Auth.js wrapper's type expects a second argument that the proxy never uses; cast it to the single-argument call.
const run = proxy as unknown as (req: TestRequest) => Response

function request(path: string, session: object | null): TestRequest {
  const url = new URL(`http://localhost:3000${path}`)
  return { nextUrl: url, url: url.toString(), auth: session }
}

const connecte = { user: { id: "user-1", role: "ADMIN", organisationId: "org-1" } }

// NextResponse.next() marks the request as passed through with this header.
const passe = (res: Response) => res.headers.get("x-middleware-next") === "1"
const redirection = (res: Response) => {
  const location = res.headers.get("location")
  return location ? new URL(location) : null
}

describe("proxy (protection des routes)", () => {
  it("redirige un visiteur anonyme vers /login en gardant la page demandée", () => {
    const location = redirection(run(request("/transactions?page=2", null)))
    expect(location?.pathname).toBe("/login")
    expect(location?.searchParams.get("from")).toBe("/transactions?page=2")
  })

  it("répond 401 à un appel d'API anonyme au lieu de rediriger", () => {
    const res = run(request("/api/transactions", null))
    expect(res.status).toBe(401)
    expect(redirection(res)).toBeNull()
  })

  it("laisse passer l'utilisateur connecté, pages et API", () => {
    expect(passe(run(request("/transactions", connecte)))).toBe(true)
    expect(passe(run(request("/api/transactions", connecte)))).toBe(true)
  })

  it("régression : /login reste accessible aux anonymes", () => {
    expect(passe(run(request("/login", null)))).toBe(true)
  })

  it("régression : le proxy ne redirige pas /login d'après le jeton seul (la base décide)", () => {
    expect(passe(run(request("/login", connecte)))).toBe(true)
  })

  it("régression : /setup est accessible sans session (configuration initiale)", () => {
    expect(passe(run(request("/setup", null)))).toBe(true)
  })

  it("régression : les routes Auth.js restent publiques, sinon la connexion est impossible", () => {
    expect(passe(run(request("/api/auth/callback/credentials", null)))).toBe(true)
    expect(passe(run(request("/api/auth/session", null)))).toBe(true)
  })

  it("laisse passer la santé et les images publiques sans session", () => {
    expect(passe(run(request("/api/health", null)))).toBe(true)
    expect(passe(run(request("/pin.svg", null)))).toBe(true)
  })
})
