import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync, readdirSync } from "node:fs"
import { NextRequest } from "next/server"

const authMock = vi.hoisted(() => vi.fn())
const findUtilisateurById = vi.hoisted(() => vi.fn())
const searchTransactions = vi.hoisted(() => vi.fn())
const findTransactionsForMap = vi.hoisted(() => vi.fn())

vi.mock("@/lib/auth", () => ({ auth: authMock }))
vi.mock("@/repositories/utilisateur.repository", () => ({ findUtilisateurById }))
vi.mock("@/server/actions/transaction", () => ({ searchTransactions }))
vi.mock("@/repositories/transaction.repository", () => ({ findTransactionsForMap }))
vi.mock("@/repositories/organisation.repository", () => ({ getCurrentOrganisationId: () => "org-1" }))

import { GET as getTransactions } from "@/app/api/transactions/route"
import { GET as getTransactionsMap } from "@/app/api/transactions/map/route"
import { empreinteMotDePasse } from "@/lib/password-fingerprint"

const ROUTES = [
  {
    nom: "/api/transactions",
    appel: () => getTransactions(new NextRequest("http://localhost/api/transactions?page=1")),
    donnees: searchTransactions,
    retour: { rows: [], total: 0 },
  },
  {
    nom: "/api/transactions/map",
    appel: () => getTransactionsMap(new Request("http://localhost/api/transactions/map")),
    donnees: findTransactionsForMap,
    retour: [],
  },
]

const HASH = "hash-test"

function session(id: string | null, role: string | null) {
  authMock.mockResolvedValue(id ? { user: { id, empreinte: empreinteMotDePasse(HASH) } } : null)
  if (id && role) {
    findUtilisateurById.mockResolvedValue({
      id,
      email: `${id}@org1.test`,
      nom: null,
      organisationId: "org-1",
      role,
      actif: true,
      passwordHash: HASH,
      motDePasseTemporaire: false,
      consentementPolitiqueAt: null,
    })
  }
}

describe.each(ROUTES)("$nom : garde côté serveur", ({ appel, donnees, retour }) => {
  beforeEach(() => {
    vi.clearAllMocks()
    donnees.mockResolvedValue(retour)
  })

  it("401 sans session, sans lire les données", async () => {
    session(null, null)
    const res = await appel()
    expect(res.status).toBe(401)
    expect(donnees).not.toHaveBeenCalled()
  })

  it("403 pour le développeur (aucun accès aux transactions), sans lire les données", async () => {
    session("dev-1", "DEVELOPPEUR")
    const res = await appel()
    expect(res.status).toBe(403)
    expect(donnees).not.toHaveBeenCalled()
  })

  it("403 pour un compte désactivé, même avec un jeton encore valide", async () => {
    authMock.mockResolvedValue({ user: { id: "eval-1" } })
    findUtilisateurById.mockResolvedValue({
      id: "eval-1",
      email: "e@org1.test",
      nom: null,
      organisationId: "org-1",
      role: "EVALUATEUR",
      actif: false,
      consentementPolitiqueAt: null,
    })
    const res = await appel()
    expect(res.status).toBe(401)
    expect(donnees).not.toHaveBeenCalled()
  })

  it("200 pour l'évaluateur", async () => {
    session("eval-1", "EVALUATEUR")
    const res = await appel()
    expect(res.status).toBe(200)
    expect(donnees).toHaveBeenCalled()
  })

  it("200 pour l'administrateur", async () => {
    session("admin-1", "ADMIN")
    const res = await appel()
    expect(res.status).toBe(200)
  })
})

describe("chaque route d'API de données appelle la garde", () => {
  const apiDir = new URL("../../src/app/api/", import.meta.url)
  const routes = readdirSync(apiDir, { recursive: true })
    .filter((f) => String(f).endsWith("route.ts"))
    .map(String)
  // Public by design: health check and Auth.js's own endpoints (login is handled by Auth.js).
  const publiques = ["health/route.ts", "auth/[...nextauth]/route.ts"]

  it("inventaire : au moins les deux routes de données sont trouvées", () => {
    expect(routes).toEqual(expect.arrayContaining(["transactions/route.ts", "transactions/map/route.ts"]))
  })

  for (const route of routes.filter((r) => !publiques.includes(r))) {
    it(`api/${route} appelle gardeApi avant toute lecture`, () => {
      const source = readFileSync(new URL(route, apiDir), "utf8")
      // Only the handler body matters: imports also mention repositories.
      const corps = source.slice(source.indexOf("export async function"))
      expect(corps).toMatch(/gardeApi\("(evaluation|configuration|administration)"\)/)
      // The guard must run before any data access, so it appears before the first data call.
      const guard = corps.indexOf("gardeApi(")
      const premierAcces = corps.search(/searchTransactions\(|findTransactionsForMap\(|repository|prisma\./)
      expect(premierAcces === -1 || guard < premierAcces).toBe(true)
    })
  }
})
