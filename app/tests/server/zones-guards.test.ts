import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"

// Module-level mocks for the guard behaviour tests below (Vitest only accepts vi.mock at the top level).
const { verifierZone, utilisateurPourZone, listChampsRepo, createChampRepo } = vi.hoisted(() => ({
  verifierZone: vi.fn(),
  utilisateurPourZone: vi.fn(),
  listChampsRepo: vi.fn(),
  createChampRepo: vi.fn(),
}))
vi.mock("@/lib/session", () => ({ verifierZone, utilisateurPourZone, MESSAGE_ACCES_NON_AUTORISE: "Accès non autorisé" }))
vi.mock("@/lib/prisma", () => ({ prisma: {} }))
vi.mock("@/repositories/champs.repository", () => ({
  listChampsEnrichissablesByOrganisation: listChampsRepo,
  createChampEnrichissable: createChampRepo,
  findChampByOrganisationAndCode: vi.fn(async () => null),
}))

// Regression guard for the role matrix: every server action and page must declare its zone.
// Read the source directly so a new action added without a guard fails this test.
const src = (rel: string) => readFileSync(new URL(`../../src/${rel}`, import.meta.url), "utf8")

function exportedFunctions(source: string): { name: string; body: string }[] {
  const out: { name: string; body: string }[] = []
  const re = /export (?:default )?async function (\w+)?/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    const next = source.indexOf("\nexport ", m.index + 1)
    out.push({ name: m[1] ?? "default", body: source.slice(m.index, next === -1 ? undefined : next) })
  }
  return out
}

describe("garde de zone sur les actions serveur", () => {
  const evaluation = ["server/actions/dossier.ts", "server/actions/fiche.ts", "server/actions/transaction.ts"]
  const configuration = [
    "server/actions/actes.ts",
    "server/actions/champs.ts",
    "server/actions/filters.ts",
    "server/actions/import.ts",
    "server/actions/sections.ts",
  ]

  for (const file of evaluation) {
    it(`${file} : chaque action exige la zone evaluation`, () => {
      const fns = exportedFunctions(src(file))
      expect(fns.length).toBeGreaterThan(0)
      for (const fn of fns) {
        expect(fn.body, `${file} ${fn.name}`).toMatch(/(verifierZone|utilisateurPourZone)\("evaluation"\)/)
      }
    })
  }

  for (const file of configuration) {
    it(`${file} : chaque action exige la zone configuration`, () => {
      const fns = exportedFunctions(src(file))
      expect(fns.length).toBeGreaterThan(0)
      for (const fn of fns) {
        expect(fn.body, `${file} ${fn.name}`).toMatch(/(verifierZone|utilisateurPourZone)\("configuration"\)/)
      }
    })
  }

  it("la gestion des utilisateurs exige un administrateur", () => {
    for (const fn of exportedFunctions(src("server/actions/users.ts"))) {
      expect(fn.body, fn.name).toContain("requireAdmin()")
    }
  })
})

describe("garde de zone sur les pages", () => {
  const pages: [string, string][] = [
    ["app/(app)/transactions/page.tsx", "evaluation"],
    ["app/(app)/transactions/map/page.tsx", "evaluation"],
    ["app/(app)/transactions/[id]/page.tsx", "evaluation"],
    ["app/(app)/dossiers/page.tsx", "evaluation"],
    ["app/(app)/dossiers/[id]/page.tsx", "evaluation"],
    ["app/(app)/paniers/[id]/page.tsx", "evaluation"],
    ["app/(app)/admin/import/page.tsx", "configuration"],
    ["app/(app)/admin/champs/page.tsx", "configuration"],
    ["app/(app)/admin/filters/page.tsx", "configuration"],
    ["app/(app)/admin/utilisateurs/page.tsx", "administration"],
  ]
  for (const [file, zone] of pages) {
    it(`${file} : exige la zone ${zone}`, () => {
      expect(src(file)).toContain(`exigerZonePage("${zone}")`)
    })
  }
})

describe("garde de zone sur les routes d'API", () => {
  it("la route de la carte exige la zone evaluation (sinon n'importe quelle session lit les transactions)", () => {
    expect(src("app/api/transactions/map/route.ts")).toContain('gardeApi("evaluation")')
  })

  it("la route de recherche exige la zone evaluation avant toute lecture", () => {
    const source = src("app/api/transactions/route.ts")
    expect(source).toContain('gardeApi("evaluation")')
    expect(source.indexOf('gardeApi("evaluation")')).toBeLessThan(source.indexOf("searchTransactions("))
  })

  it("aucune garde ne lève d'exception : les actions renvoient { ok, error }", () => {
    for (const file of ["actes", "champs", "dossier", "fiche", "filters", "import", "sections", "transaction"]) {
      expect(src(`server/actions/${file}.ts`), file).not.toMatch(/\bassertZone\(/)
    }
    expect(src("lib/session.ts")).not.toContain("class AccesNonAutoriseError")
  })
})

describe("comportement des gardes d'action", () => {
  beforeEach(() => {
    verifierZone.mockReset()
    utilisateurPourZone.mockReset()
    listChampsRepo.mockReset()
    createChampRepo.mockReset()
  })

  it("une lecture de configuration sans la zone renvoie une liste vide, sans toucher aux données", async () => {
    utilisateurPourZone.mockResolvedValue(null)
    const { listChamps } = await import("@/server/actions/champs")
    await expect(listChamps()).resolves.toEqual([])
    expect(utilisateurPourZone).toHaveBeenCalledWith("configuration")
    expect(listChampsRepo).not.toHaveBeenCalled()
  })

  it("une écriture de configuration sans la zone renvoie { ok: false } avant tout accès aux données", async () => {
    verifierZone.mockResolvedValue({ ok: false, error: "Accès non autorisé" })
    const { createChamp } = await import("@/server/actions/champs")
    const result = await createChamp({} as never)
    expect(result).toEqual({ ok: false, error: "Accès non autorisé" })
    expect(verifierZone).toHaveBeenCalledWith("configuration")
    expect(createChampRepo).not.toHaveBeenCalled()
  })
})

describe("organisation : toujours celle de l'utilisateur connecté", () => {
  // Regression: actions and pages must never read the organisation from the environment.
  const fichiers = [
    ...["actes", "champs", "dossier", "fiche", "filters", "import", "sections", "transaction"].map((f) => `server/actions/${f}.ts`),
    "app/(app)/transactions/page.tsx",
    "app/(app)/transactions/map/page.tsx",
    "app/(app)/transactions/[id]/page.tsx",
    "app/(app)/dossiers/page.tsx",
    "app/(app)/dossiers/[id]/page.tsx",
    "app/(app)/paniers/[id]/page.tsx",
    "app/(app)/admin/champs/page.tsx",
    "app/(app)/admin/filters/page.tsx",
    "app/api/transactions/map/route.ts",
  ]
  for (const f of fichiers) {
    it(`${f} n'utilise pas getCurrentOrganisationId`, () => {
      expect(src(f)).not.toContain("getCurrentOrganisationId")
    })
  }
})

describe("pas de boucle entre la connexion et l'application", () => {
  // Regression (found in the browser): the proxy redirected /login on the token alone while pages redirected
  // to /login from the database, so a stale session looped forever. Only the database decides.
  it("l'accueil et le layout renvoient vers la connexion sans utilisateur valide", () => {
    expect(src("app/(app)/layout.tsx")).toContain('redirect("/login")')
    expect(src("app/page.tsx")).toContain("pageAccueil(user.role)")
  })

  it("le proxy ne redirige plus /login d'après le jeton", () => {
    expect(src("proxy.ts")).not.toMatch(/pathname === "\/login"\)\s*\{\s*return NextResponse\.redirect/)
  })
})

describe("changement de son propre mot de passe", () => {
  // Regression: the page existed but no menu led to it. The entry needs no zone, so every signed-in role sees it.
  it("le menu propose « Changer mon mot de passe » hors de la liste filtrée par zone", () => {
    const menu = src("components/sidebar.tsx")
    expect(menu).toContain('href="/compte/mot-de-passe"')
    // Placed after the zone-filtered navigation, so no zone can hide it.
    expect(menu.indexOf("</nav>")).toBeLessThan(menu.indexOf('href="/compte/mot-de-passe"'))
  })
})
