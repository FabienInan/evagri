# Dossiers et paniers — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** Livrer la gestion des dossiers et des paniers de transactions comparables (§7.7) pour le livrable bêta.

**Architecture :** Couche applicative ajoutée sur un modèle de données déjà présent (`Dossier`, `Panier`, `PanierTransaction`) — aucune migration. Suit le motif du dépôt : validateur Zod → repository Prisma → actions serveur `{ ok, error }` → pages serveur → composants client. La vue panier réutilise `DataTable` (tri/visibilité persistés par panier) avec un réordonnancement désactivé ; une modale d'ajout unique est partagée par trois points d'entrée (tableau, fiche, carte).

**Tech Stack :** Next.js 16 (App Router, server actions), React 19, Prisma 6, TypeScript, Zod 4, Vitest 3, Tailwind v4.

**Spec :** `docs/superpowers/specs/2026-10-17-dossiers-paniers-design.md`

## Global Constraints

- Modèles `Dossier` / `Panier` / `PanierTransaction` **déjà présents** — **aucune migration** ; `createurId` reste `null`.
- Numéro de dossier : regex stricte `^\d{2}-[A-Z]{2}-\d{3}$` (AA-RR-DDD) ; unicité par organisation (`@@unique([organisationId, numeroDossier])`).
- Seules les transactions de statut `ANALYSEE` sont admissibles dans un panier.
- Ajout au panier **idempotent** : `createMany({ skipDuplicates: true })`, ré-ajout = succès sans doublon.
- Actions serveur : **jamais de `throw`**, toujours `{ ok: true, ... } | { ok: false, error }` (Next masque les messages des actions lancées en production).
- `Decimal` Prisma → `number` à la sérialisation (motif `transaction.serializer.ts`).
- Les modales utilisent un overlay maison (`fixed inset-0` + `Card`) : `ui/` ne contient **pas** de `Dialog`.
- Aucun réordonnancement manuel des colonnes dans la vue panier (l'ordre suit le tri) ; le reste de l'app garde `reorderable = true` par défaut.
- Commandes de vérification (depuis `app/`) : `npm run typecheck`, `npm test`, `npm run lint`.

## Review Focus

Classes d'entrée / modes de défaillance que la spec implique sans que ses tests les couvrent — chacun reçoit son test dans la tâche propriétaire :

1. **Numéro de dossier dupliqué** (ressaisie, double-clic) → doit renvoyer une erreur lisible, pas un 500 ni une contrainte Prisma non gérée. *(test : Task 3)*
2. **Transaction non `ANALYSEE` ajoutée par un appel direct à l'action** (contournement de l'interface) → doit être rejetée côté serveur. *(test : Task 3)*
3. **Ré-ajout de la même transaction** (double-clic, sélection recomposée) → aucun doublon, aucune erreur. *(tests : Tasks 2 et 3)*
4. **Numéro de dossier mal formé** collé depuis un tableur (`25-ab-1`, espaces, longueur fausse) → rejeté avec un message explicite. *(test : Task 1)*
5. **Numéro de dossier avec espaces autour** (`"25-AB-001 "`) → normalisé et accepté (trim), pas rejeté à tort. *(test : Task 1)*

---

### Task 1: Validateur de dossier

**Files:**
- Create: `app/src/validators/dossier.validator.ts`
- Test: `app/tests/validators/dossier.validator.test.ts`

**Interfaces:**
- Consumes: rien.
- Produces: `NUMERO_DOSSIER_REGEX`, `createDossierSchema`, `createPanierSchema`, `addTransactionsSchema`, `formatDossierInputErrors(error: z.ZodError): string`, types `CreateDossierInput`, `CreatePanierInput`, `AddTransactionsInput`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/validators/dossier.validator.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  NUMERO_DOSSIER_REGEX,
  createDossierSchema,
  createPanierSchema,
  addTransactionsSchema,
} from "@/validators/dossier.validator"

describe("NUMERO_DOSSIER_REGEX", () => {
  it("accepte le format AA-RR-DDD", () => {
    expect(NUMERO_DOSSIER_REGEX.test("25-AB-001")).toBe(true)
  })

  it("refuse les formats invalides", () => {
    for (const bad of ["25-ab-001", "5-AB-001", "25-ABC-001", "25-AB-01", "", "25AB001"]) {
      expect(NUMERO_DOSSIER_REGEX.test(bad)).toBe(false)
    }
  })
})

describe("createDossierSchema", () => {
  it("accepte un numéro valide, nom optionnel", () => {
    expect(createDossierSchema.safeParse({ numeroDossier: "25-AB-001" }).success).toBe(true)
    expect(createDossierSchema.safeParse({ numeroDossier: "25-AB-001", nom: "Essai" }).success).toBe(true)
  })

  it("normalise les espaces autour du numéro (trim)", () => {
    const result = createDossierSchema.safeParse({ numeroDossier: "  25-AB-001 " })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.numeroDossier).toBe("25-AB-001")
  })

  it("refuse un numéro mal formé", () => {
    expect(createDossierSchema.safeParse({ numeroDossier: "25-ab-1" }).success).toBe(false)
  })
})

describe("createPanierSchema", () => {
  it("exige un nom non vide", () => {
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "  " }).success).toBe(false)
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "Panier" }).success).toBe(true)
  })

  it("accepte un typeTransactionId null ou absent", () => {
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P", typeTransactionId: null }).success).toBe(true)
    expect(createPanierSchema.safeParse({ dossierId: "d1", nom: "P" }).success).toBe(true)
  })
})

describe("addTransactionsSchema", () => {
  it("refuse une sélection vide", () => {
    expect(addTransactionsSchema.safeParse({ panierId: "p1", transactionIds: [] }).success).toBe(false)
  })

  it("accepte au moins une transaction", () => {
    expect(addTransactionsSchema.safeParse({ panierId: "p1", transactionIds: ["t1"] }).success).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/validators/dossier.validator.test.ts`
Expected: FAIL — `Failed to resolve import "@/validators/dossier.validator"`.

- [ ] **Step 3: Write the implementation**

Create `app/src/validators/dossier.validator.ts`:

```ts
import { z } from "zod"

/** Numéro de dossier au format AA-RR-DDD (§7.7) : 2 chiffres, 2 majuscules, 3 chiffres. */
export const NUMERO_DOSSIER_REGEX = /^\d{2}-[A-Z]{2}-\d{3}$/

export const createDossierSchema = z.object({
  numeroDossier: z
    .string()
    .trim()
    .regex(NUMERO_DOSSIER_REGEX, "Format attendu : AA-RR-DDD (ex. 25-AB-001)."),
  nom: z.string().trim().max(200).optional(),
})

export const createPanierSchema = z.object({
  dossierId: z.string().min(1),
  nom: z.string().trim().min(1, "Le nom du panier est requis.").max(200),
  typeTransactionId: z.string().min(1).nullable().optional(),
})

export const addTransactionsSchema = z.object({
  panierId: z.string().min(1),
  transactionIds: z.array(z.string().min(1)).min(1, "Sélectionnez au moins une transaction."),
})

export type CreateDossierInput = z.infer<typeof createDossierSchema>
export type CreatePanierInput = z.infer<typeof createPanierSchema>
export type AddTransactionsInput = z.infer<typeof addTransactionsSchema>

/** Aplatit un ZodError en une phrase lisible (motif `formatChampInputErrors` de `lib/champs.ts`). */
export function formatDossierInputErrors(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Entrée invalide."
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/validators/dossier.validator.test.ts`
Expected: PASS (tous les cas).

- [ ] **Step 5: Commit**

```bash
git add app/src/validators/dossier.validator.ts app/tests/validators/dossier.validator.test.ts
git commit -m "feat(dossiers): validateur Zod du numéro de dossier et des paniers"
```

---

### Task 2: Repository dossier (accès Prisma)

**Files:**
- Create: `app/src/repositories/dossier.repository.ts`
- Test: `app/tests/repositories/dossier.repository.test.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`).
- Produces (signatures exactes) :
  - `listDossiers(organisationId: string)` → `Dossier` + `_count.paniers[]`
  - `findDossierById(organisationId: string, id: string)`
  - `findDossierByNumero(organisationId: string, numeroDossier: string)`
  - `createDossier(organisationId: string, data: { numeroDossier: string; nom?: string })`
  - `listPaniersByDossier(organisationId: string, dossierId: string)`
  - `createPanier(organisationId: string, data: { dossierId: string; nom: string; typeTransactionId?: string | null })`
  - `findPanierById(organisationId: string, id: string)`
  - `addTransactionsToPanier(panierId: string, transactionIds: string[]): Promise<number>` (renvoie le nombre réellement inséré)
  - `removeTransactionFromPanier(panierId: string, transactionId: string): Promise<void>`
  - `listTransactionsOfPanier(panierId: string)` → `Transaction` + `valeurs`
  - `countEligibleTransactions(organisationId: string, transactionIds: string[]): Promise<number>`

- [ ] **Step 1: Write the failing test**

Create `app/tests/repositories/dossier.repository.test.ts` (base Postgres réelle, org isolée, motif `tests/e2e/lifecycle.test.ts`) :

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"

let orgId = ""
let dossierId = ""
let panierId = ""
let analyseeId = ""
const previousOrganisationId = process.env.DEFAULT_ORGANISATION_ID

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Dossier Repo Org" } })
  orgId = org.id
  const dossier = await prisma.dossier.create({ data: { organisationId: orgId, numeroDossier: "25-AB-001" } })
  dossierId = dossier.id
  const panier = await prisma.panier.create({
    data: { organisationId: orgId, dossierId, nom: "Panier test" },
  })
  panierId = panier.id
  const tx = await prisma.transaction.create({
    data: { organisationId: orgId, systemeSource: "TEST", statut: "ANALYSEE" },
  })
  analyseeId = tx.id
})

afterAll(async () => {
  await prisma.panierTransaction.deleteMany({ where: { panier: { organisationId: orgId } } })
  await prisma.panier.deleteMany({ where: { organisationId: orgId } })
  await prisma.dossier.deleteMany({ where: { organisationId: orgId } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
  if (previousOrganisationId === undefined) delete process.env.DEFAULT_ORGANISATION_ID
  else process.env.DEFAULT_ORGANISATION_ID = previousOrganisationId
})

describe("dossier.repository", () => {
  it("ajoute une transaction au panier", async () => {
    const { addTransactionsToPanier } = await import("@/repositories/dossier.repository")
    expect(await addTransactionsToPanier(panierId, [analyseeId])).toBe(1)
    expect(await addTransactionsToPanier(panierId, [analyseeId])).toBe(0) // idempotent (skipDuplicates)
    expect(await prisma.panierTransaction.count({ where: { panierId } })).toBe(1)
  })

  it("liste les transactions du panier", async () => {
    const { listTransactionsOfPanier } = await import("@/repositories/dossier.repository")
    const rows = await listTransactionsOfPanier(panierId)
    expect(rows.map((t) => t.id)).toContain(analyseeId)
  })

  it("retire une transaction du panier (idempotent si absente)", async () => {
    const { removeTransactionFromPanier } = await import("@/repositories/dossier.repository")
    await removeTransactionFromPanier(panierId, analyseeId)
    expect(await prisma.panierTransaction.count({ where: { panierId } })).toBe(0)
    await expect(removeTransactionFromPanier(panierId, analyseeId)).resolves.toBeUndefined()
  })

  it("compte les transactions éligibles (ANALYSEE seulement)", async () => {
    const { countEligibleTransactions } = await import("@/repositories/dossier.repository")
    const nonAnalysee = await prisma.transaction.create({
      data: { organisationId: orgId, systemeSource: "TEST", statut: "NON_ANALYSEE" },
    })
    expect(await countEligibleTransactions(orgId, [analyseeId, nonAnalysee.id])).toBe(1)
  })

  it("liste les dossiers avec le nombre de paniers", async () => {
    const { listDossiers } = await import("@/repositories/dossier.repository")
    const rows = await listDossiers(orgId)
    const row = rows.find((d) => d.id === dossierId)
    expect(row?._count.paniers).toBe(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/repositories/dossier.repository.test.ts`
Expected: FAIL — `Failed to resolve import "@/repositories/dossier.repository"`.

- [ ] **Step 3: Write the implementation**

Create `app/src/repositories/dossier.repository.ts`:

```ts
import { prisma } from "@/lib/prisma"

export async function listDossiers(organisationId: string) {
  return prisma.dossier.findMany({
    where: { organisationId, actif: true },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { paniers: true } } },
  })
}

export async function findDossierById(organisationId: string, id: string) {
  return prisma.dossier.findFirst({
    where: { id, organisationId },
    include: { _count: { select: { paniers: true } } },
  })
}

export async function findDossierByNumero(organisationId: string, numeroDossier: string) {
  return prisma.dossier.findFirst({ where: { organisationId, numeroDossier } })
}

export async function createDossier(
  organisationId: string,
  data: { numeroDossier: string; nom?: string }
) {
  return prisma.dossier.create({
    data: {
      organisationId,
      numeroDossier: data.numeroDossier,
      nom: data.nom ?? null,
      createurId: null,
    },
  })
}

export async function listPaniersByDossier(organisationId: string, dossierId: string) {
  return prisma.panier.findMany({
    where: { organisationId, dossierId },
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { transactions: true } },
      dossier: true,
      typeTransaction: true,
    },
  })
}

export async function createPanier(
  organisationId: string,
  data: { dossierId: string; nom: string; typeTransactionId?: string | null }
) {
  return prisma.panier.create({
    data: {
      organisationId,
      dossierId: data.dossierId,
      nom: data.nom,
      typeTransactionId: data.typeTransactionId ?? null,
      createurId: null,
    },
  })
}

export async function findPanierById(organisationId: string, id: string) {
  return prisma.panier.findFirst({
    where: { id, organisationId },
    include: {
      _count: { select: { transactions: true } },
      dossier: true,
      typeTransaction: true,
    },
  })
}

/** Renvoie le nombre de lignes réellement insérées : `skipDuplicates` rend l'ajout idempotent. */
export async function addTransactionsToPanier(
  panierId: string,
  transactionIds: string[]
): Promise<number> {
  const result = await prisma.panierTransaction.createMany({
    data: transactionIds.map((transactionId) => ({ panierId, transactionId })),
    skipDuplicates: true,
  })
  return result.count
}

/** `deleteMany` plutôt que `delete` : un retrait d'une transaction déjà absente reste un no-op silencieux. */
export async function removeTransactionFromPanier(
  panierId: string,
  transactionId: string
): Promise<void> {
  await prisma.panierTransaction.deleteMany({ where: { panierId, transactionId } })
}

export async function listTransactionsOfPanier(panierId: string) {
  return prisma.transaction.findMany({
    where: { paniers: { some: { panierId } } },
    include: { valeurs: { include: { champ: true } } },
  })
}

export async function countEligibleTransactions(
  organisationId: string,
  transactionIds: string[]
): Promise<number> {
  return prisma.transaction.count({
    where: { id: { in: transactionIds }, organisationId, statut: "ANALYSEE" },
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/repositories/dossier.repository.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/repositories/dossier.repository.ts app/tests/repositories/dossier.repository.test.ts
git commit -m "feat(dossiers): repository Prisma des dossiers et paniers"
```

---

### Task 3: Sérialiseur et actions serveur dossier

**Files:**
- Create: `app/src/serializers/dossier.serializer.ts`
- Create: `app/src/server/actions/dossier.ts`
- Test: `app/tests/e2e/dossier-lifecycle.test.ts`

**Interfaces:**
- Consumes: `createDossierSchema`, `createPanierSchema`, `addTransactionsSchema`, `formatDossierInputErrors` (Task 1) ; repository dossier (Task 2) ; `getCurrentOrganisationId` (`@/repositories/organisation.repository`) ; `serializeTransaction`, `SerializedTransaction` (`@/serializers/transaction.serializer`).
- Produces :
  - `SerializedDossier = { id, numeroDossier, nom, createdAt, panierCount }`
  - `SerializedPanier = { id, nom, dossierId, numeroDossier, typeTransactionId, typeTransactionNom, createdAt, transactionCount }`
  - `serializeDossier`, `serializePanier`
  - Actions : `listDossiers()`, `createDossier(input)`, `createPanier(input)`, `addTransactionsToPanier({ panierId, transactionIds })`, `removeTransactionFromPanier(panierId, transactionId)`, `listPaniersForDossier(dossierId)`, `listTransactionsForPanier(panierId)`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/e2e/dossier-lifecycle.test.ts` :

```ts
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest"
import { prisma } from "@/lib/prisma"

// Les actions "use server" appellent revalidatePath ; hors requête Next il n'y a pas de cache à revalider.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))

let orgId = ""
let analyseeId = ""
let nonAnalyseeId = ""
const previousOrganisationId = process.env.DEFAULT_ORGANISATION_ID

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Dossiers E2E Org" } })
  orgId = org.id
  // getCurrentOrganisationId lit cette variable au chargement du module : à poser avant tout import d'action.
  process.env.DEFAULT_ORGANISATION_ID = orgId
  const a = await prisma.transaction.create({
    data: { organisationId: orgId, systemeSource: "TEST", statut: "ANALYSEE" },
  })
  analyseeId = a.id
  const b = await prisma.transaction.create({
    data: { organisationId: orgId, systemeSource: "TEST", statut: "NON_ANALYSEE" },
  })
  nonAnalyseeId = b.id
})

afterAll(async () => {
  await prisma.panierTransaction.deleteMany({ where: { panier: { organisationId: orgId } } })
  await prisma.panier.deleteMany({ where: { organisationId: orgId } })
  await prisma.dossier.deleteMany({ where: { organisationId: orgId } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
  if (previousOrganisationId === undefined) delete process.env.DEFAULT_ORGANISATION_ID
  else process.env.DEFAULT_ORGANISATION_ID = previousOrganisationId
})

describe("E2E — cycle de vie dossier → panier → transactions", () => {
  let dossierId = ""
  let panierId = ""

  it("crée un dossier", async () => {
    const { createDossier, listDossiers } = await import("@/server/actions/dossier")
    const res = await createDossier({ numeroDossier: "25-AB-001", nom: "Essai" })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    dossierId = res.id
    expect((await listDossiers()).map((d) => d.numeroDossier)).toContain("25-AB-001")
  })

  it("refuse un numéro de dossier dupliqué", async () => {
    const { createDossier } = await import("@/server/actions/dossier")
    const res = await createDossier({ numeroDossier: "25-AB-001" })
    expect(res.ok).toBe(false)
  })

  it("refuse un numéro de dossier mal formé", async () => {
    const { createDossier } = await import("@/server/actions/dossier")
    const res = await createDossier({ numeroDossier: "25-ab-1" })
    expect(res.ok).toBe(false)
  })

  it("crée un panier dans le dossier", async () => {
    const { createPanier, listPaniersForDossier } = await import("@/server/actions/dossier")
    const res = await createPanier({ dossierId, nom: "Comparables cultivés" })
    expect(res.ok).toBe(true)
    if (!res.ok) return
    panierId = res.id
    const paniers = await listPaniersForDossier(dossierId)
    expect(paniers.map((p) => p.nom)).toContain("Comparables cultivés")
  })

  it("ajoute une transaction analysée au panier", async () => {
    const { addTransactionsToPanier, listTransactionsForPanier } = await import("@/server/actions/dossier")
    const res = await addTransactionsToPanier({ panierId, transactionIds: [analyseeId] })
    expect(res).toEqual({ ok: true, added: 1 })
    expect((await listTransactionsForPanier(panierId)).map((t) => t.id)).toContain(analyseeId)
  })

  it("ignore un ré-ajout (pas de doublon)", async () => {
    const { addTransactionsToPanier, listTransactionsForPanier } = await import("@/server/actions/dossier")
    const res = await addTransactionsToPanier({ panierId, transactionIds: [analyseeId] })
    expect(res).toEqual({ ok: true, added: 0 })
    expect(await listTransactionsForPanier(panierId)).toHaveLength(1)
  })

  it("refuse une transaction non analysée", async () => {
    const { addTransactionsToPanier } = await import("@/server/actions/dossier")
    const res = await addTransactionsToPanier({ panierId, transactionIds: [nonAnalyseeId] })
    expect(res.ok).toBe(false)
  })

  it("retire une transaction du panier", async () => {
    const { removeTransactionFromPanier, listTransactionsForPanier } = await import("@/server/actions/dossier")
    expect(await removeTransactionFromPanier(panierId, analyseeId)).toEqual({ ok: true })
    expect(await listTransactionsForPanier(panierId)).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/e2e/dossier-lifecycle.test.ts`
Expected: FAIL — `Failed to resolve import "@/server/actions/dossier"`.

- [ ] **Step 3: Write the serializer**

Create `app/src/serializers/dossier.serializer.ts` :

```ts
import type { Prisma } from "@prisma/client"

export type SerializedDossier = {
  id: string
  numeroDossier: string
  nom: string | null
  createdAt: string
  panierCount: number
}

export type SerializedPanier = {
  id: string
  nom: string
  dossierId: string
  numeroDossier: string
  typeTransactionId: string | null
  typeTransactionNom: string | null
  createdAt: string
  transactionCount: number
}

type DossierWithCount = Prisma.DossierGetPayload<{
  include: { _count: { select: { paniers: true } } }
}>

export function serializeDossier(dossier: DossierWithCount): SerializedDossier {
  return {
    id: dossier.id,
    numeroDossier: dossier.numeroDossier,
    nom: dossier.nom,
    createdAt: dossier.createdAt.toISOString(),
    panierCount: dossier._count.paniers,
  }
}

type PanierWithRelations = Prisma.PanierGetPayload<{
  include: {
    _count: { select: { transactions: true } }
    dossier: true
    typeTransaction: true
  }
}>

export function serializePanier(panier: PanierWithRelations): SerializedPanier {
  return {
    id: panier.id,
    nom: panier.nom,
    dossierId: panier.dossierId,
    numeroDossier: panier.dossier.numeroDossier,
    typeTransactionId: panier.typeTransactionId,
    typeTransactionNom: panier.typeTransaction?.nom ?? null,
    createdAt: panier.createdAt.toISOString(),
    transactionCount: panier._count.transactions,
  }
}
```

- [ ] **Step 4: Write the server actions**

Create `app/src/server/actions/dossier.ts` :

```ts
"use server"

import { revalidatePath } from "next/cache"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import {
  addTransactionsToPanier as repoAddTransactions,
  countEligibleTransactions,
  createDossier as repoCreateDossier,
  createPanier as repoCreatePanier,
  findDossierById,
  findDossierByNumero,
  findPanierById,
  listDossiers as repoListDossiers,
  listPaniersByDossier,
  listTransactionsOfPanier,
  removeTransactionFromPanier as repoRemoveTransaction,
} from "@/repositories/dossier.repository"
import {
  serializeDossier,
  serializePanier,
  type SerializedDossier,
  type SerializedPanier,
} from "@/serializers/dossier.serializer"
import {
  serializeTransaction,
  type SerializedTransaction,
} from "@/serializers/transaction.serializer"
import {
  addTransactionsSchema,
  createDossierSchema,
  createPanierSchema,
  formatDossierInputErrors,
} from "@/validators/dossier.validator"

export async function listDossiers(): Promise<SerializedDossier[]> {
  const organisationId = getCurrentOrganisationId()
  return (await repoListDossiers(organisationId)).map(serializeDossier)
}

export async function createDossier(input: {
  numeroDossier: string
  nom?: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const organisationId = getCurrentOrganisationId()
  const parsed = createDossierSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  const existing = await findDossierByNumero(organisationId, parsed.data.numeroDossier)
  if (existing) return { ok: false, error: "Un dossier existe déjà avec ce numéro." }

  const dossier = await repoCreateDossier(organisationId, parsed.data)
  revalidatePath("/dossiers")
  return { ok: true, id: dossier.id }
}

export async function createPanier(input: {
  dossierId: string
  nom: string
  typeTransactionId?: string | null
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const organisationId = getCurrentOrganisationId()
  const parsed = createPanierSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  const dossier = await findDossierById(organisationId, parsed.data.dossierId)
  if (!dossier) return { ok: false, error: "Dossier introuvable." }

  const panier = await repoCreatePanier(organisationId, parsed.data)
  revalidatePath(`/dossiers/${parsed.data.dossierId}`)
  return { ok: true, id: panier.id }
}

export async function addTransactionsToPanier(input: {
  panierId: string
  transactionIds: string[]
}): Promise<{ ok: true; added: number } | { ok: false; error: string }> {
  const organisationId = getCurrentOrganisationId()
  const parsed = addTransactionsSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: formatDossierInputErrors(parsed.error) }

  const panier = await findPanierById(organisationId, parsed.data.panierId)
  if (!panier) return { ok: false, error: "Panier introuvable." }

  // Déduplique l'entrée : un id répété ne doit pas faire échouer le contrôle d'éligibilité (count < length).
  const ids = Array.from(new Set(parsed.data.transactionIds))
  const eligible = await countEligibleTransactions(organisationId, ids)
  if (eligible !== ids.length) {
    return { ok: false, error: "Seules les transactions analysées peuvent être ajoutées." }
  }

  const added = await repoAddTransactions(parsed.data.panierId, ids)
  revalidatePath(`/paniers/${parsed.data.panierId}`)
  return { ok: true, added }
}

export async function removeTransactionFromPanier(
  panierId: string,
  transactionId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const organisationId = getCurrentOrganisationId()
  const panier = await findPanierById(organisationId, panierId)
  if (!panier) return { ok: false, error: "Panier introuvable." }

  await repoRemoveTransaction(panierId, transactionId)
  revalidatePath(`/paniers/${panierId}`)
  return { ok: true }
}

export async function listPaniersForDossier(dossierId: string): Promise<SerializedPanier[]> {
  const organisationId = getCurrentOrganisationId()
  return (await listPaniersByDossier(organisationId, dossierId)).map(serializePanier)
}

export async function listTransactionsForPanier(panierId: string): Promise<SerializedTransaction[]> {
  return (await listTransactionsOfPanier(panierId)).map(serializeTransaction)
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- tests/e2e/dossier-lifecycle.test.ts`
Expected: PASS.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: aucune erreur.

- [ ] **Step 7: Commit**

```bash
git add app/src/serializers/dossier.serializer.ts app/src/server/actions/dossier.ts app/tests/e2e/dossier-lifecycle.test.ts
git commit -m "feat(dossiers): sérialiseur et actions serveur dossiers/paniers"
```

---

### Task 4: Prop `reorderable` sur `DataTable`

**Files:**
- Modify: `app/src/components/data-table.tsx`

**Interfaces:**
- Consumes: rien de nouveau.
- Produces: `DataTable` accepte `reorderable?: boolean` (défaut `true`) ; la vue panier le passe à `false`.

- [ ] **Step 1: Add the prop to the interface and destructuring**

Dans `app/src/components/data-table.tsx`, dans `DataTableProps<T>` (après `fillHeight?: boolean`), ajouter :

```ts
  /** When false, column headers are not draggable (order follows the sort, e.g. the panier view). Defaults to true. */
  reorderable?: boolean
```

Puis dans la déstructuration de `DataTable` (après `fillHeight = false,`), ajouter :

```ts
  reorderable = true,
```

- [ ] **Step 2: Thread `reorderable` into the header**

Dans le rendu, remplacer l'appel `<DataTableHeader ... />` (bloc lignes 436-446) par :

```tsx
          <DataTableHeader
            visible={visible}
            sortField={sortField}
            sortOrder={sortOrder}
            onSort={onSort}
            onReorderColumn={handleReorderColumn}
            columnWidths={columnWidths}
            onColumnResize={handleColumnResize}
            onColumnResizeEnd={handleColumnResizeEnd}
            sticky={fillHeight}
            reorderable={reorderable}
          />
```

- [ ] **Step 3: Honor `reorderable` in `DataTableHeader`**

Dans la signature de `DataTableHeader`, ajouter la prop `reorderable` à côté de `sticky` :

```tsx
  /** Keeps the header pinned to the top of the scrolling body (fill-height mode). */
  sticky?: boolean
  /** When false, headers are not draggable and no reorder handle is shown. */
  reorderable?: boolean
```

Et dans la déstructuration du composant, ajouter `reorderable = true`:

```tsx
function DataTableHeader<T>({
  visible,
  sortField,
  sortOrder,
  onSort,
  onReorderColumn,
  columnWidths,
  onColumnResize,
  onColumnResizeEnd,
  sticky = false,
  reorderable = true,
}: {
```

Puis, dans le `.map((col) => { ... })`, remplacer la ligne `const draggable = !col.locked` par :

```tsx
          const draggable = reorderable && !col.locked
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: aucune erreur. (`reorderable` par défaut à `true` préserve le comportement des autres tables.)

- [ ] **Step 5: Commit**

```bash
git add app/src/components/data-table.tsx
git commit -m "feat(data-table): prop reorderable pour désactiver le réordonnancement des colonnes"
```

---

### Task 5: Navigation, page liste des dossiers et formulaire de création

**Files:**
- Modify: `app/src/components/sidebar.tsx`
- Modify: `app/src/components/header.tsx`
- Create: `app/src/components/dossier/modal.tsx`
- Create: `app/src/components/dossier/dossiers-page-client.tsx`
- Create: `app/src/components/dossier/dossier-form-dialog.tsx`
- Create: `app/src/app/(app)/dossiers/page.tsx`

**Interfaces:**
- Consumes: `listDossiers`, `createDossier` (Task 3) ; `SerializedDossier` (Task 3).
- Produces: `Modal` (`{ title, onClose, children }`) réutilisé par les autres modales ; route `/dossiers`.

- [ ] **Step 1: Add the sidebar entry**

Dans `app/src/components/sidebar.tsx`, ajouter `FolderOpen` à l'import lucide-react :

```tsx
import {
  LayoutList,
  FolderOpen,
  Upload,
  SlidersHorizontal,
  ListTree,
  LogOut,
  PanelLeftClose,
  Sprout,
} from "lucide-react"
```

Puis dans `NAV_ITEMS`, insérer après la ligne `transactions` :

```tsx
  { href: "/dossiers", label: "Dossiers", icon: FolderOpen },
```

- [ ] **Step 2: Clean up the header and add titles**

Dans `app/src/components/header.tsx`, remplacer les lignes 3-13 et le bloc badge (31-36).

Nouvel import et table de titres :

```tsx
import { usePathname } from "next/navigation"
import { User } from "lucide-react"
import { useHeaderActions } from "@/components/header-actions"

const PAGE_TITLES: Record<string, string> = {
  "/transactions": "Liste des transactions",
  "/transactions/map": "Carte des transactions",
  "/dossiers": "Dossiers",
  "/admin/import": "Gestion des imports",
  "/admin/filters": "Configuration des filtres",
  "/admin/champs": "Champs enrichissables",
}
```

Dans le corps du composant, remplacer le calcul du titre et retirer `FolderOpen` :

```tsx
  const resolvedTitle =
    PAGE_TITLES[pathname] ??
    (pathname.startsWith("/transactions/")
      ? "Fiche de transaction"
      : pathname.startsWith("/dossiers/")
        ? "Dossier"
        : pathname.startsWith("/paniers/")
          ? "Panier"
          : title)
```

Et supprimer entièrement le bloc :

```tsx
        {!isAdmin && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 shadow-sm">
            <FolderOpen className="h-4 w-4 text-primary" />
            <span className="font-medium text-foreground">Dossier 123456</span>
          </div>
        )}
```

**Note :** `isAdmin` n'était utilisé que par ce bloc ; après suppression, retirer aussi la ligne `const isAdmin = pathname.startsWith("/admin")` (sinon variable inutilisée → lint en erreur). Ne pas toucher à `{action && <div .../>}`.

- [ ] **Step 3: Create the shared modal**

Create `app/src/components/dossier/modal.tsx` :

```tsx
"use client"

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

/** Overlay maison : `ui/` n'expose pas de composant Dialog. Clic sur le fond ou la croix pour fermer. */
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <Card
        className="w-full max-w-md gap-3 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Fermer"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Create the dossier creation dialog**

Create `app/src/components/dossier/dossier-form-dialog.tsx` :

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import { createDossier } from "@/server/actions/dossier"

export function DossierFormDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [numeroDossier, setNumeroDossier] = useState("")
  const [nom, setNom] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    const res = await createDossier({ numeroDossier, nom: nom.trim() || undefined })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onCreated(res.id)
  }

  return (
    <Modal title="Nouveau dossier" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="numero-dossier">Numéro de dossier</Label>
          <Input
            id="numero-dossier"
            value={numeroDossier}
            placeholder="25-AB-001"
            onChange={(e) => setNumeroDossier(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="nom-dossier">Nom (optionnel)</Label>
          <Input id="nom-dossier" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 5: Create the dossiers list client**

Create `app/src/components/dossier/dossiers-page-client.tsx` :

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FolderPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DossierFormDialog } from "@/components/dossier/dossier-form-dialog"
import type { SerializedDossier } from "@/serializers/dossier.serializer"

export function DossiersPageClient({ dossiers }: { dossiers: SerializedDossier[] }) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          {dossiers.length} dossier{dossiers.length > 1 ? "s" : ""}
        </h2>
        <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
          <FolderPlus className="h-4 w-4" />
          Nouveau dossier
        </Button>
      </div>

      {dossiers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun dossier. Créez-en un pour commencer.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dossiers.map((d) => (
            <Link key={d.id} href={`/dossiers/${d.id}`}>
              <Card className="h-full transition-colors hover:border-primary/60">
                <CardContent className="space-y-1 p-4">
                  <p className="text-base font-semibold tabular-nums text-foreground">{d.numeroDossier}</p>
                  <p className="text-sm text-muted-foreground">{d.nom ?? "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {d.panierCount} panier{d.panierCount > 1 ? "s" : ""}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <DossierFormDialog
          onClose={() => setShowForm(false)}
          onCreated={(id) => {
            setShowForm(false)
            router.push(`/dossiers/${id}`)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 6: Create the page**

Create `app/src/app/(app)/dossiers/page.tsx` :

```tsx
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listDossiers } from "@/repositories/dossier.repository"
import { serializeDossier } from "@/serializers/dossier.serializer"
import { DossiersPageClient } from "@/components/dossier/dossiers-page-client"

export const dynamic = "force-dynamic"

export default async function DossiersPage() {
  const organisationId = getCurrentOrganisationId()
  const dossiers = (await listDossiers(organisationId)).map(serializeDossier)
  return <DossiersPageClient dossiers={dossiers} />
}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint`
Expected: aucune erreur. Vérification visuelle : la sidebar affiche « Dossiers » ; le badge « Dossier 123456 » a disparu ; `/dossiers` liste/crée des dossiers.

- [ ] **Step 8: Commit**

```bash
git add app/src/components/sidebar.tsx app/src/components/header.tsx app/src/components/dossier app/src/app/\(app\)/dossiers
git commit -m "feat(dossiers): navigation, liste des dossiers et création"
```

---

### Task 6: Détail d'un dossier et création de panier

**Files:**
- Create: `app/src/components/dossier/panier-form-dialog.tsx`
- Create: `app/src/components/dossier/dossier-detail-client.tsx`
- Create: `app/src/app/(app)/dossiers/[id]/page.tsx`

**Interfaces:**
- Consumes: `Modal` (Task 5) ; `createPanier` (Task 3) ; `listTypologies` (`@/server/actions/champs`) ; `listPaniersByDossier`, `findDossierById` (Task 2) ; `serializeDossier`, `serializePanier`, `SerializedPanier` (Task 3) ; `TypologieOption`.
- Produces: route `/dossiers/[id]`.

- [ ] **Step 1: Create the panier creation dialog**

Create `app/src/components/dossier/panier-form-dialog.tsx` :

```tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import { createPanier } from "@/server/actions/dossier"
import type { TypologieOption } from "@/repositories/typologie.repository"

export function PanierFormDialog({
  dossierId,
  typologies,
  onClose,
  onCreated,
}: {
  dossierId: string
  typologies: TypologieOption[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [nom, setNom] = useState("")
  const [typeTransactionId, setTypeTransactionId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleSubmit() {
    setSaving(true)
    setError(null)
    const res = await createPanier({
      dossierId,
      nom,
      typeTransactionId: typeTransactionId || null,
    })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    onCreated(res.id)
  }

  return (
    <Modal title="Nouveau panier" onClose={onClose}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="nom-panier">Nom du panier</Label>
          <Input id="nom-panier" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="type-panier">Type de transaction (optionnel)</Label>
          <select
            id="type-panier"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            value={typeTransactionId}
            onChange={(e) => setTypeTransactionId(e.target.value)}
          >
            <option value="">— Aucun —</option>
            {typologies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nom}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            Créer
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 2: Create the dossier detail client**

Create `app/src/components/dossier/dossier-detail-client.tsx` :

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PanierFormDialog } from "@/components/dossier/panier-form-dialog"
import type { TypologieOption } from "@/repositories/typologie.repository"
import type { SerializedDossier, SerializedPanier } from "@/serializers/dossier.serializer"

export function DossierDetailClient({
  dossier,
  paniers,
  typologies,
}: {
  dossier: SerializedDossier
  paniers: SerializedPanier[]
  typologies: TypologieOption[]
}) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-lg font-semibold tabular-nums text-foreground">{dossier.numeroDossier}</p>
            <p className="text-sm text-muted-foreground">{dossier.nom ?? "—"}</p>
          </div>
          <Button size="sm" className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4" />
            Nouveau panier
          </Button>
        </CardContent>
      </Card>

      {paniers.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun panier dans ce dossier.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paniers.map((p) => (
            <Link key={p.id} href={`/paniers/${p.id}`}>
              <Card className="h-full transition-colors hover:border-primary/60">
                <CardContent className="space-y-1 p-4">
                  <p className="text-base font-semibold text-foreground">{p.nom}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.transactionCount} transaction{p.transactionCount > 1 ? "s" : ""}
                  </p>
                  {p.typeTransactionNom && <Badge variant="secondary">{p.typeTransactionNom}</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showForm && (
        <PanierFormDialog
          dossierId={dossier.id}
          typologies={typologies}
          onClose={() => setShowForm(false)}
          onCreated={(id) => {
            setShowForm(false)
            router.push(`/paniers/${id}`)
          }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create the page**

Create `app/src/app/(app)/dossiers/[id]/page.tsx` :

```tsx
import { notFound } from "next/navigation"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findDossierById, listPaniersByDossier } from "@/repositories/dossier.repository"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { serializeDossier, serializePanier } from "@/serializers/dossier.serializer"
import { DossierDetailClient } from "@/components/dossier/dossier-detail-client"

export const dynamic = "force-dynamic"

export default async function DossierDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const organisationId = getCurrentOrganisationId()

  const dossier = await findDossierById(organisationId, id)
  if (!dossier) notFound()

  const [paniers, typologies] = await Promise.all([
    listPaniersByDossier(organisationId, id),
    listTypologiesByOrganisation(organisationId),
  ])

  return (
    <DossierDetailClient
      dossier={serializeDossier(dossier)}
      paniers={paniers.map(serializePanier)}
      typologies={typologies}
    />
  )
}
```

- [ ] **Step 4: Verify**

Run: `npm run typecheck && npm run lint`
Expected: aucune erreur.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/dossier/panier-form-dialog.tsx app/src/components/dossier/dossier-detail-client.tsx app/src/app/\(app\)/dossiers/\[id\]
git commit -m "feat(dossiers): détail d'un dossier et création de panier"
```

---

### Task 7: Vue panier (tableau des transactions)

**Files:**
- Create: `app/src/lib/panier.ts`
- Test: `app/tests/lib/panier.test.ts`
- Create: `app/src/components/dossier/panier-view.tsx`
- Create: `app/src/app/(app)/paniers/[id]/page.tsx`

**Interfaces:**
- Consumes: `DataTable` + `DataTableColumn` (`reorderable` de Task 4) ; `SerializedTransaction`, `SerializedValue` ; `removeTransactionFromPanier` (Task 3) ; `findPanierById`, `listTransactionsOfPanier` (Task 2) ; `listChampsEnrichissablesByOrganisation` ; `IMPORTED_FIELDS` ; `formatValue`, `formatNumber`, `formatCurrency` (`@/components/transaction-table`).
- Produces: `sortTransactionRows(rows, sortField, sortOrder)` ; route `/paniers/[id]`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/panier.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import { sortTransactionRows } from "@/lib/panier"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"

function tx(id: string, fields: Record<string, unknown>): SerializedTransaction {
  return {
    id,
    statut: "ANALYSEE",
    fields: fields as SerializedTransaction["fields"],
    latitude: null,
    longitude: null,
    importationId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  }
}

describe("sortTransactionRows", () => {
  it("trie numériquement un champ de `fields`", () => {
    const rows = [tx("a", { prix_vente: 30 }), tx("b", { prix_vente: 10 })]
    expect(sortTransactionRows(rows, "prix_vente", "asc").map((r) => r.id)).toEqual(["b", "a"])
  })

  it("place les valeurs nulles en fin quel que soit le sens", () => {
    const rows = [tx("a", { prix_vente: null }), tx("b", { prix_vente: 10 })]
    expect(sortTransactionRows(rows, "prix_vente", "asc").map((r) => r.id)).toEqual(["b", "a"])
    expect(sortTransactionRows(rows, "prix_vente", "desc").map((r) => r.id)).toEqual(["b", "a"])
  })

  it("ne mute pas le tableau d'entrée", () => {
    const rows = [tx("a", { prix_vente: 30 }), tx("b", { prix_vente: 10 })]
    sortTransactionRows(rows, "prix_vente", "asc")
    expect(rows.map((r) => r.id)).toEqual(["a", "b"])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/panier.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/panier"`.

- [ ] **Step 3: Implement the sort helper**

Create `app/src/lib/panier.ts` :

```ts
import type { SerializedTransaction, SerializedValue } from "@/serializers/transaction.serializer"

/** Normalise une valeur sérialisée pour comparaison : tableaux joints, booléens en 0/1, null conservé. */
function normalizeSortValue(value: SerializedValue): string | number | null {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.join(",")
  if (typeof value === "boolean") return value ? 1 : 0
  return value
}

/**
 * Trie une liste de transactions sérialisées par un champ de `fields` (aucune colonne triable en base sur
 * le modèle unifié). Les valeurs nulles descendent en fin quel que soit le sens ; le tri des nombres est
 * numérique, le reste en locale fr ; les égalités retombent sur createdAt décroissant. Ne mute pas l'entrée.
 */
export function sortTransactionRows(
  rows: SerializedTransaction[],
  sortField: string,
  sortOrder: "asc" | "desc"
): SerializedTransaction[] {
  const dir = sortOrder === "asc" ? 1 : -1
  return [...rows].sort((a, b) => {
    const av = normalizeSortValue(a.fields[sortField])
    const bv = normalizeSortValue(b.fields[sortField])
    if (av === null && bv === null) return b.createdAt.localeCompare(a.createdAt)
    if (av === null) return 1
    if (bv === null) return -1

    const an = typeof av === "number" ? av : Number(av)
    const bn = typeof bv === "number" ? bv : Number(bv)
    if (Number.isFinite(an) && Number.isFinite(bn)) {
      if (an !== bn) return (an - bn) * dir
      return b.createdAt.localeCompare(a.createdAt)
    }

    const cmp = String(av).localeCompare(String(bv), "fr")
    if (cmp !== 0) return cmp * dir
    return b.createdAt.localeCompare(a.createdAt)
  })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/panier.test.ts`
Expected: PASS.

- [ ] **Step 5: Create the panier view component**

Create `app/src/components/dossier/panier-view.tsx` :

```tsx
"use client"

import { useMemo, useState, useTransition } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable, type DataTableColumn } from "@/components/data-table"
import { removeTransactionFromPanier } from "@/server/actions/dossier"
import { formatCurrency, formatNumber } from "@/components/transaction-table"
import { sortTransactionRows } from "@/lib/panier"
import { isImportedFieldCode, type ImportedField } from "@/lib/imported-fields"
import type { SerializedTransaction, SerializedValue } from "@/serializers/transaction.serializer"
import type { ChampEnrichissableConfig, TypeDonneesChamp } from "@/types/champ"

function renderFieldValue(value: SerializedValue | undefined, typeDonnees: TypeDonneesChamp): string {
  if (typeDonnees === "DATE" && typeof value === "string" && value !== "") {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("fr-CA")
  }
  if (value === null || value === undefined) return "—"
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—"
  if (typeof value === "boolean") return value ? "Oui" : "Non"
  if (typeof value === "number") return typeDonnees === "DECIMAL" ? formatNumber(value) : String(value)
  return String(value)
}

function usePanierColumns(
  importedFields: ImportedField[],
  champs: ChampEnrichissableConfig[],
  onRemove: (row: SerializedTransaction) => void
): DataTableColumn<SerializedTransaction>[] {
  return useMemo(() => {
    const importedCols: DataTableColumn<SerializedTransaction>[] = importedFields.map((field) => ({
      key: field.code,
      label: field.label,
      numeric: field.numeric,
      sortable: field.display.sortable,
      defaultVisible: field.display.defaultVisible,
      minWidth: field.display.minWidth,
      render: (row) => renderFieldValue(row.fields[field.code], field.typeDonnees),
    }))

    // Indicateurs (CALCULE) visibles par défaut ; champs SAISISSABLE non importés masqués par défaut (décision 7).
    const champCols: DataTableColumn<SerializedTransaction>[] = champs
      .filter((champ) => champ.actif && !isImportedFieldCode(champ.codeMachine))
      .map((champ) => ({
        key: champ.codeMachine,
        label: champ.nomAffichage,
        numeric: champ.typeDonnees === "DECIMAL" || champ.typeDonnees === "ENTIER",
        defaultVisible: champ.nature === "CALCULE",
        minWidth: 130,
        priority: champ.nature === "CALCULE" ? 3 : 1,
        render: (row) => renderFieldValue(row.fields[champ.codeMachine], champ.typeDonnees),
      }))

    const actionCol: DataTableColumn<SerializedTransaction> = {
      key: "retirer",
      label: "",
      defaultVisible: true,
      minWidth: 60,
      locked: true,
      render: (row) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            title="Retirer du panier"
            onClick={() => onRemove(row)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    }

    return [...importedCols, ...champCols, actionCol]
  }, [importedFields, champs, onRemove])
}

export function PanierView({
  panierId,
  nom,
  transactions,
  importedFields,
  champs,
}: {
  panierId: string
  nom: string
  transactions: SerializedTransaction[]
  importedFields: ImportedField[]
  champs: ChampEnrichissableConfig[]
}) {
  const [rows, setRows] = useState(transactions)
  const [sortField, setSortField] = useState("date_vente")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [, startTransition] = useTransition()

  function handleRemove(row: SerializedTransaction) {
    // Optimiste : on retire la ligne tout de suite, le serveur confirme ensuite.
    setRows((prev) => prev.filter((r) => r.id !== row.id))
    startTransition(async () => {
      await removeTransactionFromPanier(panierId, row.id)
    })
  }

  const columns = usePanierColumns(importedFields, champs, handleRemove)
  const sorted = useMemo(
    () => sortTransactionRows(rows, sortField, sortOrder),
    [rows, sortField, sortOrder]
  )

  return (
    <DataTable
      storageKey={`panier-table:${panierId}`}
      columns={columns}
      rows={sorted}
      rowKey={(row) => row.id}
      sortField={sortField}
      sortOrder={sortOrder}
      onSort={(field) => {
        if (field === sortField) setSortOrder((o) => (o === "asc" ? "desc" : "asc"))
        else {
          setSortField(field)
          setSortOrder("asc")
        }
      }}
      reorderable={false}
      title={nom}
      totalCount={rows.length}
      emptyMessage="Aucune transaction dans ce panier"
    />
  )
}
```

- [ ] **Step 6: Create the page**

Create `app/src/app/(app)/paniers/[id]/page.tsx` :

```tsx
import { notFound } from "next/navigation"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { findPanierById, listTransactionsOfPanier } from "@/repositories/dossier.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { IMPORTED_FIELDS } from "@/lib/imported-fields"
import { PanierView } from "@/components/dossier/panier-view"

export const dynamic = "force-dynamic"

export default async function PanierPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const organisationId = getCurrentOrganisationId()

  const panier = await findPanierById(organisationId, id)
  if (!panier) notFound()

  const [transactions, champs] = await Promise.all([
    listTransactionsOfPanier(id),
    listChampsEnrichissablesByOrganisation(organisationId),
  ])

  return (
    <PanierView
      panierId={id}
      nom={panier.nom}
      transactions={transactions.map(serializeTransaction)}
      importedFields={IMPORTED_FIELDS}
      champs={champs}
    />
  )
}
```

- [ ] **Step 7: Verify**

Run: `npm run typecheck && npm run lint && npm test -- tests/lib/panier.test.ts`
Expected: aucune erreur ; test PASS. Vérification visuelle : `/paniers/[id]` affiche le tableau, l'ordre des colonnes suit le tri (aucune poignée de réordonnancement), le retrait fonctionne, l'état vide s'affiche pour un panier sans transaction.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/panier.ts app/tests/lib/panier.test.ts app/src/components/dossier/panier-view.tsx app/src/app/\(app\)/paniers
git commit -m "feat(paniers): vue tableau des transactions du panier"
```

---

### Task 8: Modale d'ajout au panier et points d'entrée

**Files:**
- Create: `app/src/components/dossier/add-to-panier-dialog.tsx`
- Test: `app/tests/components/add-to-panier-dialog.test.tsx`
- Modify: `app/src/components/transaction-table.tsx`
- Modify: `app/src/components/fiche/fiche-header.tsx`
- Modify: `app/src/components/fiche/fiche-transaction.tsx`
- Modify: `app/src/components/transaction-map/selected-panel.tsx`
- Modify: `app/src/components/transaction-map.tsx`

**Interfaces:**
- Consumes: `Modal` (Task 5) ; `listDossiers`, `listPaniersForDossier`, `addTransactionsToPanier` (Task 3) ; `SerializedDossier`, `SerializedPanier` (Task 3).
- Produces: `AddToPanierDialog({ transactionIds, open, onOpenChange })` ; `TransactionMapSelectedPanel` gagne `onAddToPanier` ; `FicheHeader` gagne `onAddToPanier`.

- [ ] **Step 1: Write the failing component test**

Create `app/tests/components/add-to-panier-dialog.test.tsx` (jsdom via `@vitest-environment`) :

```tsx
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { AddToPanierDialog } from "@/components/dossier/add-to-panier-dialog"

const listDossiers = vi.fn()
const listPaniersForDossier = vi.fn()
const addTransactionsToPanier = vi.fn()

vi.mock("@/server/actions/dossier", () => ({
  listDossiers: () => listDossiers(),
  listPaniersForDossier: (id: string) => listPaniersForDossier(id),
  addTransactionsToPanier: (input: unknown) => addTransactionsToPanier(input),
}))

beforeEach(() => {
  listDossiers.mockReset()
  listPaniersForDossier.mockReset()
  addTransactionsToPanier.mockReset()
  listDossiers.mockResolvedValue([
    { id: "d1", numeroDossier: "25-AB-001", nom: "Essai", createdAt: "2026-01-01T00:00:00.000Z", panierCount: 1 },
  ])
  listPaniersForDossier.mockResolvedValue([
    { id: "p1", nom: "Comparables", dossierId: "d1", numeroDossier: "25-AB-001", typeTransactionId: null, typeTransactionNom: null, createdAt: "2026-01-01T00:00:00.000Z", transactionCount: 0 },
  ])
})

describe("AddToPanierDialog", () => {
  it("charge les dossiers à l'ouverture", async () => {
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={() => {}} />)
    await waitFor(() => expect(listDossiers).toHaveBeenCalled())
  })

  it("ajoute les transactions au panier choisi", async () => {
    addTransactionsToPanier.mockResolvedValue({ ok: true, added: 1 })
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={() => {}} />)
    await waitFor(() => expect(listDossiers).toHaveBeenCalled())

    fireEvent.change(screen.getByLabelText("Dossier"), { target: { value: "d1" } })
    await waitFor(() => expect(listPaniersForDossier).toHaveBeenCalledWith("d1"))
    fireEvent.change(screen.getByLabelText("Panier"), { target: { value: "p1" } })
    fireEvent.click(screen.getByRole("button", { name: /ajouter/i }))

    await waitFor(() =>
      expect(addTransactionsToPanier).toHaveBeenCalledWith({ panierId: "p1", transactionIds: ["t1"] })
    )
    expect(await screen.findByText(/1 transaction ajoutée/i)).toBeTruthy()
  })

  it("affiche une erreur si aucun panier n'est choisi", async () => {
    render(<AddToPanierDialog transactionIds={["t1"]} open onOpenChange={() => {}} />)
    await waitFor(() => expect(listDossiers).toHaveBeenCalled())
    fireEvent.click(screen.getByRole("button", { name: /ajouter/i }))
    expect(await screen.findByText(/Sélectionnez un panier/i)).toBeTruthy()
    expect(addTransactionsToPanier).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/components/add-to-panier-dialog.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/dossier/add-to-panier-dialog"`.

- [ ] **Step 3: Implement the dialog**

Create `app/src/components/dossier/add-to-panier-dialog.tsx` :

```tsx
"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Modal } from "@/components/dossier/modal"
import {
  addTransactionsToPanier,
  listDossiers,
  listPaniersForDossier,
} from "@/server/actions/dossier"
import type { SerializedDossier, SerializedPanier } from "@/serializers/dossier.serializer"

export function AddToPanierDialog({
  transactionIds,
  open,
  onOpenChange,
}: {
  transactionIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [dossiers, setDossiers] = useState<SerializedDossier[]>([])
  const [dossierId, setDossierId] = useState("")
  const [paniers, setPaniers] = useState<SerializedPanier[]>([])
  const [panierId, setPanierId] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setError(null)
    setSuccess(null)
    setDossierId("")
    setPanierId("")
    setPaniers([])
    listDossiers().then(setDossiers)
  }, [open])

  useEffect(() => {
    if (!dossierId) {
      setPaniers([])
      setPanierId("")
      return
    }
    setPanierId("")
    listPaniersForDossier(dossierId).then(setPaniers)
  }, [dossierId])

  async function handleConfirm() {
    if (!panierId) {
      setError("Sélectionnez un panier.")
      return
    }
    setSaving(true)
    setError(null)
    const res = await addTransactionsToPanier({ panierId, transactionIds })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return
    }
    setSuccess(`${res.added} transaction${res.added > 1 ? "s" : ""} ajoutée${res.added > 1 ? "s" : ""}.`)
  }

  if (!open) return null

  return (
    <Modal title="Ajouter au panier" onClose={() => onOpenChange(false)}>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="add-dossier">Dossier</Label>
          <select
            id="add-dossier"
            aria-label="Dossier"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            value={dossierId}
            onChange={(e) => setDossierId(e.target.value)}
          >
            <option value="">— Choisir un dossier —</option>
            {dossiers.map((d) => (
              <option key={d.id} value={d.id}>
                {d.numeroDossier}
                {d.nom ? ` — ${d.nom}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="add-panier">Panier</Label>
          <select
            id="add-panier"
            aria-label="Panier"
            className="h-9 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground"
            value={panierId}
            disabled={!dossierId}
            onChange={(e) => setPanierId(e.target.value)}
          >
            <option value="">— Choisir un panier —</option>
            {paniers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        {success && <p className="text-sm text-primary">{success}</p>}

        <p className="text-xs text-muted-foreground">
          {transactionIds.length} transaction{transactionIds.length > 1 ? "s" : ""} sélectionnée
          {transactionIds.length > 1 ? "s" : ""}.
        </p>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} disabled={saving}>
            Fermer
          </Button>
          <Button size="sm" onClick={handleConfirm} disabled={saving}>
            Ajouter
          </Button>
        </div>
      </div>
    </Modal>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/components/add-to-panier-dialog.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the table entry point**

Dans `app/src/components/transaction-table.tsx`, ajouter les imports :

```tsx
import { useState } from "react"
import { AddToPanierDialog } from "@/components/dossier/add-to-panier-dialog"
```

(remplacer `import { useMemo } from "react"` par `import { useMemo, useState } from "react"`.)

Modifier `Actions` pour accepter un callback et câbler le bouton « + » :

```tsx
function Actions({ id, statut, onAddToPanier }: { id: string; statut: string; onAddToPanier: () => void }) {
  const router = useRouter()
  const isAnalysee = statut === "ANALYSEE"

  return (
    // stopPropagation: keeps action clicks from toggling the row selection
    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {isAnalysee ? (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Voir"
            onClick={() => router.push(`/transactions/${id}`)}
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Ajouter au panier"
            onClick={onAddToPanier}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Analyser"
          onClick={() => router.push(`/transactions/${id}`)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}
```

`useTableColumns` doit recevoir le callback : changer la signature et la colonne `actions` :

```tsx
function useTableColumns(
  importedFields: ImportedField[],
  champs: ChampEnrichissableConfig[],
  onAddToPanier: (id: string) => void
): DataTableColumn<TransactionRow>[] {
  return useMemo(() => {
    // ... (importedCols et champCols inchangés) ...
```

et dans `computedCols`, la colonne actions devient :

```tsx
      {
        key: "actions",
        label: "Actions",
        defaultVisible: true,
        minWidth: 80,
        priority: 10,
        locked: true,
        render: (row) => <Actions id={row.id} statut={row.statut} onAddToPanier={() => onAddToPanier(row.id)} />,
      },
```

ajouter `onAddToPanier` aux dépendances du `useMemo`.

Dans `TransactionTable`, ajouter l'état et le rendu de la modale :

```tsx
export function TransactionTable({
  data,
  importedFields,
  champs,
  onSort,
  sortField,
  sortOrder,
  loading,
  sentinelRef,
  selectedIds,
  onSelectRow,
  fillHeight,
}: TransactionTableProps) {
  const [addToPanierIds, setAddToPanierIds] = useState<string[] | null>(null)
  const columns = useTableColumns(importedFields, champs, (id) => setAddToPanierIds([id]))

  return (
    <>
      <DataTable
        storageKey="transaction-table:v2"
        columns={columns}
        rows={data.transactions}
        rowKey={(row, index) => `${row.id}-${index}`}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={onSort}
        loading={loading}
        sentinelRef={sentinelRef}
        fillHeight={fillHeight}
        title="Résultats"
        totalCount={data.total}
        onRowClick={onSelectRow}
        isRowSelected={selectedIds ? (row) => selectedIds.has(row.id) : undefined}
      />
      <AddToPanierDialog
        transactionIds={addToPanierIds ?? []}
        open={addToPanierIds !== null}
        onOpenChange={(open) => {
          if (!open) setAddToPanierIds(null)
        }}
      />
    </>
  )
}
```

- [ ] **Step 6: Wire the fiche entry point**

Dans `app/src/components/fiche/fiche-header.tsx`, ajouter l'import `Plus` :

```tsx
import { Check, Save, Plus } from "lucide-react"
```

Ajouter la prop `onAddToPanier` à la signature et à la déstructuration :

```tsx
  onSave,
  onAnalyse,
  onAddToPanier,
}: {
  fields: Record<string, SerializedValue>
  mode: FicheMode
  typologies: TypologieOption[]
  typeCode: string | null
  statut: string
  saving: boolean
  /** Fiche-wide messages (V-001, V-004, échec générique) — the per-field ones render under their field. */
  errors: string[]
  typeError: string | null
  onTypeChange: (code: string | null) => void
  onSave: () => void
  onAnalyse: () => void
  onAddToPanier: () => void
}) {
```

Dans l'en-tête, à côté des boutons d'édition, rendre le bouton « Ajouter au panier » quand la transaction est analysée :

```tsx
        {isEdition && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" disabled={saving} onClick={onSave}>
              <Save className="h-4 w-4" />
              Enregistrer
            </Button>
            <Button size="sm" className="gap-2" disabled={saving} onClick={onAnalyse}>
              <Check className="h-4 w-4" />
              Analyser
            </Button>
          </div>
        )}
        {!isEdition && (
          <Button variant="outline" size="sm" className="gap-2" onClick={onAddToPanier}>
            <Plus className="h-4 w-4" />
            Ajouter au panier
          </Button>
        )}
```

Dans `app/src/components/fiche/fiche-transaction.tsx`, ajouter l'import et l'état + le rendu :

```tsx
import { AddToPanierDialog } from "@/components/dossier/add-to-panier-dialog"
```

```tsx
  const [addToPanierOpen, setAddToPanierOpen] = useState(false)
```

(à déclarer près des autres `useState`.)

Passer la prop au header :

```tsx
        onSave={handleSave}
        onAnalyse={handleAnalyse}
        onAddToPanier={() => setAddToPanierOpen(true)}
      />
```

et rendre la modale en fin de composant (avant la fermeture `</div>`) :

```tsx
      <AddToPanierDialog
        transactionIds={[fiche.id]}
        open={addToPanierOpen}
        onOpenChange={setAddToPanierOpen}
      />
```

- [ ] **Step 7: Wire the map selection entry point**

Dans `app/src/components/transaction-map/selected-panel.tsx`, ajouter le bouton (prop `onAddToPanier`) :

```tsx
import { MapPin, Trash2, Filter, Plus } from "lucide-react"
```

```tsx
type TransactionMapSelectedPanelProps = {
  selectedCount: number
  onClear: () => void
  onFilter: () => void
  onAddToPanier: () => void
}

export function TransactionMapSelectedPanel({
  selectedCount,
  onClear,
  onFilter,
  onAddToPanier,
}: TransactionMapSelectedPanelProps) {
```

et dans le `CardContent`, après le bouton « Filtrer dans la liste » :

```tsx
        <Button size="sm" variant="outline" className="w-full gap-2" onClick={onAddToPanier}>
          <Plus className="h-4 w-4" />
          Ajouter au panier
        </Button>
```

Dans `app/src/components/transaction-map.tsx`, ajouter l'import et l'état :

```tsx
import { AddToPanierDialog } from "@/components/dossier/add-to-panier-dialog"
```

```tsx
  const [addToPanierIds, setAddToPanierIds] = useState<string[] | null>(null)
```

(ajouter `useState` à l'import React du fichier s'il n'y est pas déjà.)

Passer la prop au panneau (bloc 117-124) :

```tsx
        <TransactionMapSelectedPanel
          selectedCount={selectedIds.size}
          onClear={() => {
            /* ...inchangé... */
          }}
          onFilter={handleFilter}
          onAddToPanier={() => setAddToPanierIds(Array.from(selectedIds))}
        />
```

et rendre la modale au même niveau que le panneau :

```tsx
      <AddToPanierDialog
        transactionIds={addToPanierIds ?? []}
        open={addToPanierIds !== null}
        onOpenChange={(open) => {
          if (!open) setAddToPanierIds(null)
        }}
      />
```

- [ ] **Step 8: Verify**

Run: `npm run typecheck && npm run lint && npm test -- tests/components/add-to-panier-dialog.test.tsx`
Expected: aucune erreur ; test PASS. Vérifier que les tests de la fiche passent toujours : `npm test -- tests/components/fiche-transaction.test.tsx`.

- [ ] **Step 9: Run the full suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: toute la suite verte (aucune régression).

- [ ] **Step 10: Commit**

```bash
git add app/src/components/dossier/add-to-panier-dialog.tsx app/tests/components/add-to-panier-dialog.test.tsx app/src/components/transaction-table.tsx app/src/components/fiche app/src/components/transaction-map.tsx app/src/components/transaction-map
git commit -m "feat(paniers): modale d'ajout au panier et points d'entrée (tableau, fiche, carte)"
```

---

## Notes d'implémentation

- Les modales utilisent des `<select>` natifs (pas Radix `Select`) : plus simple à tester en jsdom et sans portail. Écart assumé par rapport à la mention « Select » de la spec.
- `removeTransactionFromPanier` du repository utilise `deleteMany` : le retrait d'une transaction absente est un no-op, pas une exception (cas limite de la spec).
- La fiche n'affiche « Ajouter au panier » qu'en **consultation** (`statut === ANALYSEE`) : cohérent avec la règle « seules les transactions analysées sont admissibles ».
- `reorderable` vaut `true` par défaut : les autres tables (transactions) ne changent pas de comportement.
- Vérification finale du plan : `npm run build` (génère Prisma puis Next) peut être lancé une fois à la fin pour valider le rendu serveur des routes.
