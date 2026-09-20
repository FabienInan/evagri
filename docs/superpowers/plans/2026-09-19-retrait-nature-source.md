# Retrait de la nature « SOURCE » — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aligner le modèle et les filtres sur le cahier des charges en supprimant la nature `"SOURCE"` inventée : `nature` devient un enum Prisma à deux valeurs, les colonnes de `TransactionSource` sont décrites par un catalogue, et les filtres visent ces colonnes via `code_machine` (snake_case) au lieu d'une relation `ChampEnrichissable` factice.

**Architecture:** Un descripteur pur (`SOURCE_FIELDS`) dans `src/lib/transaction-source-fields.ts` sert de source de vérité : identifiant snake_case ↔ colonne Prisma ↔ libellé ↔ type de données ↔ type de filtre recommandé. `lib/filters.ts` l'utilise pour traduire un `code_machine` en clé Prisma ; `filters.repository.ts` l'utilise pour détecter un filtre source et résoudre ses valeurs distinctes. Le schéma Prisma passe de `nature String` à `enum NatureChamp { SAISISSABLE, CALCULE }`, et la migration supprime les lignes non conformes.

**Tech Stack:** Next.js 16.2.6 (App Router, Server Actions), React 19, TypeScript, Prisma 6 + PostgreSQL, Zod 4, Vitest 3 (environnement `node`, alias `@` → `src`, certains tests serveur frappent une vraie base).

**Spec:** `docs/superpowers/specs/2026-09-19-retrait-nature-source-design.md`

## Global Constraints

- Toutes les commandes (`npm test`, `npm run typecheck`, `npm run lint`, `npx prisma …`) s'exécutent depuis `app/`.
- Les identifiants source sont en **snake_case** (`prix_vente`, `superficie_totale_hectare`) — §7.3.2 du cahier des charges.
- Toute chaîne visible par l'utilisateur est en **français**.
- La colonne `lots_cadastraux` ne doit jamais entrer dans `SOURCE_FIELD_CODES` (une colonne `String[]` n'est pas calculable) — §7.3.2.
- Aucune clé Prisma arbitraire ne doit atteindre une requête : la clé provient toujours du catalogue (`sourceColumnOf`).
- `nature` ne prend que `SAISISSABLE` ou `CALCULE` (§6.5). `est_modifiable` reste dérivé de `nature`.
- **Hors périmètre** : harmoniser `createFilter` / `publishFilters` / `deleteFilter` (`server/actions/filters.ts`) vers le contrat `{ ok, error }` documenté dans la mémoire du projet — les actions filtres lancent encore des erreurs. Ne pas le faire dans ce plan.
- Ordre des tâches imposé : ne pas flipper l'enum Prisma avant que plus aucun code ne référence `nature === "SOURCE"`.

---

### Task 1: Catalogue des données source

**Files:**
- Modify: `app/src/lib/transaction-source-fields.ts`
- Test: `app/tests/lib/transaction-source-fields.test.ts` (créer)

**Interfaces:**
- Consumes: `TypeDonneesChamp` (`@/types/champ`), `FilterType` (`@/types/filter`) — types existants.
- Produces:
  - `interface SourceField { code: string; column: string; label: string; typeDonnees: TypeDonneesChamp; typeFiltreRecommande: FilterType; array?: boolean }`
  - `const SOURCE_FIELDS: SourceField[]` (10 entrées)
  - `const SOURCE_FIELD_CODES: string[]` (9 entrées, dérivée, sans `lots_cadastraux`)
  - `const SOURCE_FIELD_BY_CODE: Record<string, SourceField>`
  - `function isSourceFieldCode(code: string | null | undefined): boolean`
  - `function sourceColumnOf(code: string): string | undefined`

- [ ] **Step 1: Write the failing test**

Créer `app/tests/lib/transaction-source-fields.test.ts` :

```ts
import { describe, it, expect } from "vitest"
import {
  SOURCE_FIELDS,
  SOURCE_FIELD_BY_CODE,
  SOURCE_FIELD_CODES,
  isSourceFieldCode,
  sourceColumnOf,
} from "@/lib/transaction-source-fields"

describe("SOURCE_FIELDS catalogue", () => {
  it("has a unique snake_case code for every entry", () => {
    const codes = SOURCE_FIELDS.map((f) => f.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const code of codes) expect(code).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it("maps every code to a Prisma column", () => {
    for (const f of SOURCE_FIELDS) expect(sourceColumnOf(f.code)).toBe(f.column)
  })

  it("maps superficie_totale_hectare to the superficieTotaleHectare column", () => {
    expect(sourceColumnOf("superficie_totale_hectare")).toBe("superficieTotaleHectare")
  })

  it("recommends PLAGE_NUMERIQUE for prix_vente", () => {
    expect(SOURCE_FIELD_BY_CODE["prix_vente"].typeFiltreRecommande).toBe("PLAGE_NUMERIQUE")
  })

  it("recommends LISTE for mrc", () => {
    expect(SOURCE_FIELD_BY_CODE["mrc"].typeFiltreRecommande).toBe("LISTE")
  })

  it("recommends NUMERO_LOT for lots_cadastraux", () => {
    expect(SOURCE_FIELD_BY_CODE["lots_cadastraux"].typeFiltreRecommande).toBe("NUMERO_LOT")
  })

  it("excludes the array column from SOURCE_FIELD_CODES", () => {
    expect(SOURCE_FIELD_CODES).not.toContain("lots_cadastraux")
    expect(SOURCE_FIELD_CODES).toContain("prix_vente")
    expect(SOURCE_FIELD_CODES).toHaveLength(9)
  })

  it("recognises source codes and rejects others", () => {
    expect(isSourceFieldCode("mrc")).toBe(true)
    expect(isSourceFieldCode("lots_cadastraux")).toBe(true)
    expect(isSourceFieldCode("statut")).toBe(false)
    expect(isSourceFieldCode(null)).toBe(false)
    expect(isSourceFieldCode(undefined)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/transaction-source-fields.test.ts`
Expected: FAIL — `SOURCE_FIELDS` is not exported (import error).

- [ ] **Step 3: Write minimal implementation**

Dans `app/src/lib/transaction-source-fields.ts`, ajouter en tête de fichier les imports, puis ajouter le catalogue **à la fin** du fichier (ne pas toucher `TRANSACTION_SOURCE_FIELDS`) :

```ts
import type { TypeDonneesChamp } from "@/types/champ"
import type { FilterType } from "@/types/filter"
```

```ts
/** Descriptor of a raw TransactionSource column. One entry per column of the table (§6.4). */
export interface SourceField {
  /** Canonical snake_case identifier (§7.3.2): used in regle_calcul and as the filter's code_machine. */
  code: string
  /** Matching property on the Prisma TransactionSource model. */
  column: string
  label: string
  typeDonnees: TypeDonneesChamp
  typeFiltreRecommande: FilterType
  /** true for a multi-valued column (String[]): excluded from rule-calculation codes. */
  array?: boolean
}

export const SOURCE_FIELDS: SourceField[] = [
  { code: "numero_inscription", column: "numeroInscription", label: "N° d'inscription", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE" },
  { code: "date_vente", column: "dateVente", label: "Date de vente", typeDonnees: "DATE", typeFiltreRecommande: "PLAGE_DATE" },
  { code: "prix_vente", column: "prixVente", label: "Prix à l'acte", typeDonnees: "DECIMAL", typeFiltreRecommande: "PLAGE_NUMERIQUE" },
  { code: "vendeur", column: "vendeur", label: "Vendeur", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE" },
  { code: "acheteur", column: "acheteur", label: "Acheteur", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE" },
  { code: "lots_cadastraux", column: "lotsCadastraux", label: "Lots cadastraux", typeDonnees: "TEXTE", typeFiltreRecommande: "NUMERO_LOT", array: true },
  { code: "adresse", column: "adresse", label: "Adresse", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE" },
  { code: "municipalite", column: "municipalite", label: "Municipalité", typeDonnees: "TEXTE", typeFiltreRecommande: "LISTE" },
  { code: "mrc", column: "mrc", label: "MRC", typeDonnees: "TEXTE", typeFiltreRecommande: "LISTE" },
  { code: "superficie_totale_hectare", column: "superficieTotaleHectare", label: "Superficie (ha)", typeDonnees: "DECIMAL", typeFiltreRecommande: "PLAGE_NUMERIQUE" },
]

/** Snake_case identifiers usable inside a regle_calcul: every scalar source column, minus the array ones. */
export const SOURCE_FIELD_CODES = SOURCE_FIELDS.filter((f) => !f.array).map((f) => f.code)

export const SOURCE_FIELD_BY_CODE: Record<string, SourceField> = Object.fromEntries(
  SOURCE_FIELDS.map((f) => [f.code, f])
)

export function isSourceFieldCode(code: string | null | undefined): boolean {
  return !!code && code in SOURCE_FIELD_BY_CODE
}

export function sourceColumnOf(code: string): string | undefined {
  return SOURCE_FIELD_BY_CODE[code]?.column
}
```

**Important :** supprimer l'ancien export `SOURCE_FIELD_CODES` (le tableau littéral `as const` aux lignes 27–37) — il est remplacé par la version dérivée ci-dessus. Le seul consommateur, `src/server/actions/champs.ts:68`, fait `new Set<string>([...SOURCE_FIELD_CODES, ...champCodes])`, compatible avec un `string[]`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/transaction-source-fields.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/transaction-source-fields.ts tests/lib/transaction-source-fields.test.ts
git commit -m "feat(filters): catalogue des colonnes source (code snake_case ↔ colonne Prisma)"
```

---

### Task 2: Clause `where` et recommandation de type

**Files:**
- Modify: `app/src/lib/filters.ts`
- Modify: `app/src/types/filter.ts`
- Modify: `app/src/components/filters-admin-form.tsx` (retrait d'une seule ligne, cf. Step 3)
- Modify: `app/src/repositories/enrichment.repository.ts` (retrait de deux lignes, cf. Step 3)
- Test: `app/tests/lib/filters.test.ts`

**Interfaces:**
- Consumes: `isSourceFieldCode`, `sourceColumnOf`, `SOURCE_FIELD_BY_CODE` (Task 1).
- Produces:
  - `interface RecommendFilterTypeInput { codeMachine: string; nomAffichage: string; typeDonnees: string }` — **le champ `nature` disparaît**.
  - `FilterConfig.optionsListe?: string[] | null` (niveau supérieur) ; `champEnrichissable.nature` disparaît.
  - `buildWhereClause(filters: FilterInput[]): Prisma.TransactionSourceWhereInput` — inchangé en signature, mais traduit désormais les codes source en colonnes.

- [ ] **Step 1: Write the failing tests**

Dans `app/tests/lib/filters.test.ts` :

1. Remplacer la ligne 2 par :
```ts
import { recommendFilterType, DEFAULT_OPERATEURS, buildWhereClause } from "@/lib/filters"
import type { FilterInput, FilterType } from "@/types/filter"
```

2. Remplacer **tout** le bloc `describe("recommendFilterType", …)` (lignes 5–135) par :
```ts
describe("recommendFilterType", () => {
  it("recommends LISTE for topography", () => {
    const result = recommendFilterType({
      codeMachine: "topographie",
      nomAffichage: "Topographie",
      typeDonnees: "TEXTE",
    })
    expect(result).toBe("LISTE")
  })

  it("recommends MULTI_SELECT for type_de_culture", () => {
    const result = recommendFilterType({
      codeMachine: "type_de_culture",
      nomAffichage: "Type de culture",
      typeDonnees: "TEXTE",
    })
    expect(result).toBe("MULTI_SELECT")
  })

  it("recommends BOOLEEN for boolean saisissable", () => {
    const result = recommendFilterType({
      codeMachine: "nouveauChamp",
      nomAffichage: "Nouveau champ",
      typeDonnees: "BOOLEAN",
    })
    expect(result).toBe("BOOLEEN")
  })

  it("recommends TYPE_TRANSACTION for typeTransaction", () => {
    const result = recommendFilterType({
      codeMachine: "typeTransaction",
      nomAffichage: "Type de transaction",
      typeDonnees: "TEXTE",
    })
    expect(result).toBe("TYPE_TRANSACTION")
  })

  it("recommends RECHERCHE_TEXTE for sousclasse_dominante", () => {
    const result = recommendFilterType({
      codeMachine: "sousclasse_dominante",
      nomAffichage: "Sous-classe dominante",
      typeDonnees: "TEXTE",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends RECHERCHE_TEXTE for entaille", () => {
    const result = recommendFilterType({
      codeMachine: "entaille",
      nomAffichage: "$/entaille",
      typeDonnees: "ENTIER",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends RECHERCHE_TEXTE for mls", () => {
    const result = recommendFilterType({
      codeMachine: "mls",
      nomAffichage: "# MLS",
      typeDonnees: "ENTIER",
    })
    expect(result).toBe("RECHERCHE_TEXTE")
  })

  it("recommends PLAGE_NUMERIQUE for superficie_cultive_ha", () => {
    const result = recommendFilterType({
      codeMachine: "superficie_cultive_ha",
      nomAffichage: "Superficie cultivée (ha)",
      typeDonnees: "DECIMAL",
    })
    expect(result).toBe("PLAGE_NUMERIQUE")
  })

  it("recommends PLAGE_DATE for a date field", () => {
    const result = recommendFilterType({
      codeMachine: "date_inspection",
      nomAffichage: "Date d'inspection",
      typeDonnees: "DATE",
    })
    expect(result).toBe("PLAGE_DATE")
  })
})
```

3. Ajouter ce nouveau bloc à la fin du fichier :
```ts
describe("buildWhereClause", () => {
  it("maps a source LISTE filter to its TransactionSource column", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "LISTE", field: "mrc", operator: "in", value: "Drummond" },
    ]
    expect(buildWhereClause(filters)).toEqual({
      AND: [{ mrc: { in: ["Drummond"], mode: "insensitive" } }],
    })
  })

  it("narrows a source text search to its own column", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "RECHERCHE_TEXTE", field: "vendeur", operator: "contient", value: "Gagnon" },
    ]
    expect(buildWhereClause(filters)).toEqual({
      AND: [{ vendeur: { contains: "Gagnon", mode: "insensitive" } }],
    })
  })

  it("maps a source PLAGE_NUMERIQUE filter to its column", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "PLAGE_NUMERIQUE", field: "prix_vente", operator: "+", value: "100000" },
    ]
    expect(buildWhereClause(filters)).toEqual({ AND: [{ prixVente: { gte: 100000 } }] })
  })

  it("maps a source NUMERO_LOT filter to the lotsCadastraux array column", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "NUMERO_LOT", field: "lots_cadastraux", operator: "has", value: "123" },
    ]
    expect(buildWhereClause(filters)).toEqual({ AND: [{ lotsCadastraux: { has: "123" } }] })
  })

  it("keeps enrichment filters on the valeur_enrichissement relation", () => {
    const filters: FilterInput[] = [
      { id: "f1", typeFiltre: "RECHERCHE_TEXTE", field: "topographie", operator: "contient", value: "plat" },
    ]
    expect(buildWhereClause(filters)).toEqual({
      AND: [
        {
          enrichie: {
            valeurs: {
              some: {
                champEnrichissable: { codeMachine: "topographie" },
                valeurTexte: { contains: "plat", mode: "insensitive" },
              },
            },
          },
        },
      ],
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/filters.test.ts`
Expected: FAIL sur les 5 tests `buildWhereClause` (les codes source `mrc`, `vendeur`, `prix_vente`, `lots_cadastraux` ne sont pas traduits en colonnes Prisma : `buildWhereClause` renvoie `{}`). Les 9 tests `recommendFilterType` passent déjà, car l'ancienne fonction ignore `nature` quand il est absent — leur intérêt est de verrouiller le comportement après le nettoyage des `Set`. Note : `vitest` n'effectue pas de vérification de type ; les appels restants à `recommendFilterType({ …, nature })` ne seront signalés qu'au `npm run typecheck` de Step 4.

- [ ] **Step 3: Write minimal implementation**

**`app/src/types/filter.ts`** : remplacer l'interface `FilterConfig` (lignes 39–59) par :

```ts
export interface FilterConfig {
  id: string
  nomFiltre: string
  typeFiltre: FilterType | string
  estActif: boolean
  codeMachine?: string | null
  champEnrichissable?:
    | {
        id: string
        codeMachine: string
        nomAffichage: string
        typeDonnees: string
        unite?: string | null
        optionsListe?: unknown
        typeFiltreRecommande?: string | null
      }
    | null
  operateursDisponibles?: FilterOperator[] | null
  /** Distinct values for a list-type filter: source column values or distinct enrichment values. */
  optionsListe?: string[] | null
  ordreAffichage: number
}
```

**`app/src/lib/filters.ts`** :

a) Ajouter l'import au bloc d'imports existant (après la ligne 3 `import type { FilterInput, FilterOperator, FilterType } from "@/types/filter"`) :

```ts
import { isSourceFieldCode, sourceColumnOf, SOURCE_FIELD_BY_CODE } from "./transaction-source-fields"
```

Puis remplacer le `Set` codé en dur `SOURCE_FIELDS` et la fonction `isSourceField` (lignes 7–26) par un helper :

```ts
/** Prisma column key for a source field code. The catalogue bounds the value, so it doubles as a whitelist. */
function sourceColumnKey(field: string): keyof Prisma.TransactionSourceWhereInput | null {
  const column = sourceColumnOf(field)
  return column ? (column as keyof Prisma.TransactionSourceWhereInput) : null
}
```

b) Remplacer intégralement `buildWhereClause` (lignes 90–202) par :

```ts
export function buildWhereClause(filters: FilterInput[]): Prisma.TransactionSourceWhereInput {
  const andClauses: Prisma.TransactionSourceWhereInput[] = []

  for (const f of filters) {
    if (!f.value && f.value !== "0") continue

    const field = f.field
    const isSource = isSourceFieldCode(field)
    const column = isSource ? sourceColumnKey(field) : null
    let clause: Prisma.TransactionSourceWhereInput = {}

    switch (f.typeFiltre as FilterType) {
      case "RECHERCHE_TEXTE":
        if (column) {
          clause = { [column]: { contains: f.value, mode: "insensitive" } } as Prisma.TransactionSourceWhereInput
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, "RECHERCHE_TEXTE", f.operator as FilterOperator, f.value)
        }
        break
      case "PLAGE_NUMERIQUE":
        if (column) {
          if (f.operator === "entre") {
            const [min, max] = f.value.split("-").map(Number)
            clause = { [column]: { gte: min, lte: max } }
          } else if (f.operator === "+") {
            clause = { [column]: { gte: Number(f.value) } }
          } else if (f.operator === "-") {
            clause = { [column]: { lte: Number(f.value) } }
          } else {
            clause = { [column]: { equals: Number(f.value) } }
          }
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, "PLAGE_NUMERIQUE", f.operator as FilterOperator, f.value)
        }
        break
      case "PLAGE_DATE":
        if (column) {
          if (f.operator === "entre") {
            const [start, end] = f.value.split(",").map((s) => new Date(s.trim()))
            clause = { [column]: { gte: start, lte: end } }
          } else if (f.operator === "+") {
            clause = { [column]: { gte: new Date(f.value) } }
          } else if (f.operator === "-") {
            clause = { [column]: { lte: new Date(f.value) } }
          } else {
            clause = { [column]: { equals: new Date(f.value) } }
          }
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, "PLAGE_DATE", f.operator as FilterOperator, f.value)
        }
        break
      case "LISTE":
      case "MULTI_SELECT":
        if (column) {
          clause = { [column]: { in: f.value.split(","), mode: "insensitive" } } as Prisma.TransactionSourceWhereInput
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, f.typeFiltre as FilterType, "in", f.value)
        }
        break
      case "BOOLEEN":
        if (column) {
          clause = { [column]: f.value === "true" }
        } else if (!isSource) {
          clause = buildEnrichmentWhereClause(field, "BOOLEEN", "=", f.value)
        }
        break
      case "NUMERO_LOT":
        if (column && SOURCE_FIELD_BY_CODE[field]?.array) {
          clause = { [column]: { has: f.value } }
        } else {
          clause = buildEnrichmentWhereClause(field, "NUMERO_LOT", "has", f.value)
        }
        break
      case "TYPE_TRANSACTION":
        clause = {
          enrichie: {
            valeurs: {
              some: {
                champEnrichissable: { codeMachine: "typeTransaction" },
                valeurTexte: { in: f.value.split(",") },
              },
            },
          },
        }
        break
      case "STATUT":
        clause = {
          enrichie: {
            statut: f.operator === "=" ? f.value : { in: f.value.split(",") },
          },
        }
        break
      case "ZONE_GEO":
        // Filtre géographique appliqué de manière applicative après la requête Prisma
        break
    }

    if (Object.keys(clause).length > 0) {
      andClauses.push(clause)
    }
  }

  return andClauses.length > 0 ? { AND: andClauses } : {}
}
```

c) Remplacer `RecommendFilterTypeInput` (lignes 235–240) par :

```ts
export interface RecommendFilterTypeInput {
  codeMachine: string
  nomAffichage: string
  typeDonnees: string
}
```

d) Nettoyage des `Set` codés en dur : retirer les identifiants source désormais couverts par le catalogue.

- `LISTE_FIELDS` : retirer `"mrc"` et `"municipalite"`.
- `PLAGE_NUMERIQUE_FIELDS` : retirer `"prixvente"` et `"superficietotalehectare"`.
- `RECHERCHE_TEXTE_FIELDS` : retirer `"numeroInscription"`, `"vendeur"`, `"acheteur"`, `"adresse"`.
- `NUMERO_LOT_FIELDS` : supprimer la constante entière (son unique entrée `"lotscadastraux"`) et le bloc `if (NUMERO_LOT_FIELDS.has(code)) { return "NUMERO_LOT" }` dans `recommendFilterType`.

e) Dans `recommendFilterType`, supprimer le bloc (lignes 340–344) :

```ts
  if (champ.nature === "SOURCE") {
    if (dataType === "DATE") return "PLAGE_DATE"
    if (["DECIMAL", "ENTIER"].includes(dataType)) return "PLAGE_NUMERIQUE"
    return "RECHERCHE_TEXTE"
  }
```

f) Pour que le projet compile, retirer la propriété `nature` des **trois** appels restants :

- `app/src/components/filters-admin-form.tsx` : dans `recommendedTypeForNew` (lignes 104–109), retirer la ligne `nature: champ.nature,`. Le reste de ce composant est repris en Task 4.
- `app/src/repositories/enrichment.repository.ts` : retirer la ligne `nature: "SAISISSABLE",` des **deux** appels à `recommendFilterType` (lignes 45–50 et 96–101). Ne pas toucher la ligne `nature: "SAISISSABLE",` qui est une propriété de `prisma.champEnrichissable.create` (lignes 51 et 102).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/filters.test.ts && npm run typecheck`
Expected: PASS (15 tests dans `filters.test.ts`) et `tsc` sans erreur.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/filters.ts src/types/filter.ts src/components/filters-admin-form.tsx src/repositories/enrichment.repository.ts tests/lib/filters.test.ts
git commit -m "refactor(filters): clause where et recommandation basées sur le catalogue source"
```

---

### Task 3: Résolution des filtres et options de liste en base

**Files:**
- Modify: `app/src/repositories/filters.repository.ts`
- Modify: `app/src/components/filters-admin-form.tsx` (retrait du champ `nature` du type local `Champ`, cf. Step 3d)
- Test: `app/tests/server/filters.test.ts` (créer)

**Interfaces:**
- Consumes: `isSourceFieldCode`, `sourceColumnOf`, `SOURCE_FIELD_BY_CODE` (Task 1) ; `FilterConfig.optionsListe` (Task 2).
- Produces:
  - `findFiltersByOrganisation(organisationId, options?)` renvoie des objets dont `optionsListe` est porté **au niveau supérieur** (plus d'injection dans `champEnrichissable.optionsListe`).
  - `findChampsByOrganisation(organisationId)` ne sélectionne plus `nature`.
  - `findDistinctSourceValues(organisationId: string, code: string): Promise<string[]>` (interne).

- [ ] **Step 1: Write the failing test**

Créer `app/tests/server/filters.test.ts` (test d'intégration : il frappe la vraie base, comme `tests/server/transaction.test.ts`) :

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"

describe("findFiltersByOrganisation", () => {
  let orgId: string

  beforeAll(async () => {
    const org = await prisma.organisation.create({ data: { nom: "Test Filters Org" } })
    orgId = org.id

    await prisma.transactionSource.createMany({
      data: [
        { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", mrc: "Drummond" },
        { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", mrc: "Arthabaska" },
        { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", mrc: "Drummond" },
      ],
    })

    await prisma.filtreRecherche.create({
      data: {
        organisationId: orgId,
        nomFiltre: "MRC",
        typeFiltre: "LISTE",
        codeMachine: "mrc",
        champEnrichissableId: null,
        ordreAffichage: 0,
      },
    })
  })

  afterAll(async () => {
    await prisma.filtreRecherche.deleteMany({ where: { organisationId: orgId } })
    await prisma.transactionSource.deleteMany({ where: { organisationId: orgId } })
    await prisma.organisation.delete({ where: { id: orgId } })
  })

  it("exposes distinct source values at the top level for a source filter", async () => {
    const filters = await findFiltersByOrganisation(orgId)
    expect(filters).toHaveLength(1)
    expect(filters[0].optionsListe).toEqual(["Arthabaska", "Drummond"])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/server/filters.test.ts`
Expected: FAIL — `optionsListe` vaut `undefined` (valeur attendue `["Arthabaska", "Drummond"]`).

- [ ] **Step 3: Write minimal implementation**

Dans `app/src/repositories/filters.repository.ts` :

a) Ajouter l'import au bloc d'imports existant (après la ligne 3 `import type { FilterConfig } from "@/types/filter"`) :

```ts
import { isSourceFieldCode, sourceColumnOf, SOURCE_FIELD_BY_CODE } from "@/lib/transaction-source-fields"
```

Puis remplacer la constante `SOURCE_TEXT_FIELDS` (ligne 8) et `findDistinctSourceValues` (lignes 24–33) par :

```ts
/** Distinct non-empty values of a text source column, for a list-type filter's dropdown. */
async function findDistinctSourceValues(organisationId: string, code: string): Promise<string[]> {
  const descriptor = SOURCE_FIELD_BY_CODE[code]
  if (!descriptor || descriptor.array || descriptor.typeDonnees !== "TEXTE") return []
  const column = sourceColumnOf(code) as string
  const rows = await prisma.transactionSource.findMany({
    where: { organisationId, [column]: { not: "" } },
    select: { [column]: true },
    distinct: [column],
  } as Prisma.TransactionSourceFindManyArgs)
  return distinctNonEmpty((rows as Record<string, unknown>[]).map((r) => r[column] as string | null))
}
```

b) Remplacer intégralement `findFiltersByOrganisation` (lignes 35–72) par :

```ts
export async function findFiltersByOrganisation(
  organisationId: string,
  options: { includeChamp?: boolean } = {}
): Promise<FilterConfig[]> {
  const filters = await prisma.filtreRecherche.findMany({
    where: { organisationId },
    orderBy: { ordreAffichage: "asc" },
    include: options.includeChamp ? { champEnrichissable: true } : undefined,
  })

  const withOptions = await Promise.all(
    filters.map(async (f) => {
      const champ = (f as { champEnrichissable?: Prisma.ChampEnrichissableGetPayload<object> | null })
        .champEnrichissable

      // Distinct dropdown values: static champ options win, otherwise source column or enrichment values.
      let optionsListe: string[] | null = null
      if (champ) {
        const staticOptions = Array.isArray(champ.optionsListe) && champ.optionsListe.length > 0
        if (staticOptions) {
          optionsListe = champ.optionsListe as string[]
        } else if (LIST_TYPE_FILTRES.has(f.typeFiltre)) {
          optionsListe = await findDistinctEnrichmentValues(champ.id)
        }
      } else if (LIST_TYPE_FILTRES.has(f.typeFiltre) && isSourceFieldCode(f.codeMachine)) {
        optionsListe = await findDistinctSourceValues(organisationId, f.codeMachine as string)
      }

      return {
        ...f,
        typeFiltre: f.typeFiltre,
        operateursDisponibles: Array.isArray(f.operateursDisponibles)
          ? (f.operateursDisponibles as string[])
          : null,
        optionsListe: optionsListe && optionsListe.length > 0 ? optionsListe : null,
      }
    })
  )

  return withOptions as FilterConfig[]
}
```

c) Dans `findChampsByOrganisation` (lignes 74–87), retirer la ligne `nature: true,` du `select`.

d) **Obligatoire dans la même tâche** : dans `app/src/components/filters-admin-form.tsx`, retirer la ligne `nature: string` du type local `Champ` (lignes 61–69). Sans cela, la page `src/app/(app)/admin/filters/page.tsx` (qui passe `champs` sans cast à `FiltersAdminForm`) ne satisfait plus `champs: Champ[]` une fois `nature` retiré du `select`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/server/filters.test.ts && npm run typecheck`
Expected: PASS (1 test) et `tsc` sans erreur.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/repositories/filters.repository.ts src/components/filters-admin-form.tsx tests/server/filters.test.ts
git commit -m "refactor(filters): détection source par code_machine et options de liste au niveau supérieur"
```

---

### Task 4: Interface admin des filtres alimentée par le catalogue

**Files:**
- Modify: `app/src/components/filters-admin-form.tsx`

**Interfaces:**
- Consumes: `SOURCE_FIELDS`, `SOURCE_FIELD_BY_CODE` (Task 1) ; `recommendFilterType` sans `nature` (Task 2).
- Produces: rien de réutilisable (composant feuille). Un filtre source est créé avec `champEnrichissableId: null`, `codeMachine: <code>`.

**Vérification :** ce formulaire n'a pas de harnais de test (aucun test de composant dans `app/tests`), et la logique métier qu'il utilise est déjà couverte par Tasks 1–2. Validation = `tsc`, `lint`, puis vérification manuelle (Step 4).

- [ ] **Step 1: Import**

Ajouter :
```ts
import { SOURCE_FIELDS, SOURCE_FIELD_BY_CODE } from "@/lib/transaction-source-fields"
```

(Le retrait de `nature` du type `Champ` a déjà été fait en Task 3, étape 3d.)

- [ ] **Step 2: Sélection courante et type recommandé**

Remplacer le bloc lignes 92–110 par :

```ts
  const [newChampId, setNewChampId] = useState<string>(
    firstAvailableChamp?.id ?? (firstAvailableVirtual ? `__VIRTUAL_${firstAvailableVirtual.codeMachine}` : "")
  )
  const isSourceSelection = newChampId.startsWith("__SOURCE_")
  const sourceCode = isSourceSelection ? newChampId.replace("__SOURCE_", "") : null
  const isVirtualSelection = newChampId.startsWith("__VIRTUAL_")
  const selectedVirtualCode = isVirtualSelection ? newChampId.replace("__VIRTUAL_", "") : null
  const isNewChampUsed = isSourceSelection
    ? items.some((f) => f.codeMachine === sourceCode)
    : isVirtualSelection
      ? items.some((f) => f.codeMachine === selectedVirtualCode)
      : items.some((f) => f.champEnrichissable?.id === newChampId)
  const recommendedTypeForNew = useMemo<FilterType | null>(() => {
    if (isSourceSelection) return SOURCE_FIELD_BY_CODE[sourceCode ?? ""]?.typeFiltreRecommande ?? null
    if (isVirtualSelection) return null
    const champ = champs.find((c) => c.id === newChampId)
    if (!champ) return null
    return recommendFilterType({
      codeMachine: champ.codeMachine,
      nomAffichage: champ.nomAffichage,
      typeDonnees: champ.typeDonnees,
    })
  }, [newChampId, isSourceSelection, sourceCode, isVirtualSelection, champs])
```

- [ ] **Step 3: Création du filtre et options du sélecteur**

Remplacer `handleCreate` (lignes 169–219) par :

```ts
  async function handleCreate(formData: FormData) {
    setCreateError(null)
    const rawChampId = formData.get("champEnrichissableId") as string
    const type = formData.get("typeFiltre") as FilterType
    const ordre = Number(formData.get("ordreAffichage") || items.length)

    const baseInput: Omit<CreateFilterInput, "nomFiltre" | "champEnrichissableId" | "codeMachine"> = {
      typeFiltre: type,
      operateurs: DEFAULT_OPERATEURS[type],
      ordreAffichage: ordre,
    }

    let input: CreateFilterInput

    if (rawChampId.startsWith("__SOURCE_")) {
      const code = rawChampId.replace("__SOURCE_", "")
      const descriptor = SOURCE_FIELD_BY_CODE[code]
      if (!descriptor) return
      if (items.some((f) => f.codeMachine === code)) {
        setCreateError("Un filtre existe déjà pour cette donnée source.")
        return
      }
      input = {
        ...baseInput,
        nomFiltre: descriptor.label,
        codeMachine: code,
        champEnrichissableId: null,
      }
    } else if (rawChampId.startsWith("__VIRTUAL_")) {
      const virtualCode = rawChampId.replace("__VIRTUAL_", "")
      const virtual = VIRTUAL_FILTERS.find((v) => v.codeMachine === virtualCode)
      if (!virtual) return
      if (items.some((f) => f.codeMachine === virtual.codeMachine)) {
        setCreateError("Un filtre existe déjà pour ce filtre virtuel.")
        return
      }
      input = {
        ...baseInput,
        nomFiltre: virtual.nomFiltre,
        codeMachine: virtual.codeMachine,
        champEnrichissableId: null,
      }
    } else {
      const champ = champs.find((c) => c.id === rawChampId)
      if (!champ) return
      if (items.some((f) => f.champEnrichissable?.id === champ.id)) {
        setCreateError("Un filtre existe déjà pour ce champ.")
        return
      }
      input = {
        ...baseInput,
        nomFiltre: champ.nomAffichage,
        champEnrichissableId: champ.id,
        codeMachine: null,
      }
    }

    try {
      await createFilter(input)
      window.location.reload()
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erreur lors de la création du filtre.")
    }
  }
```

Remplacer `ChampSelect` (lignes 460–505) par :

```ts
function ChampSelect({
  champs,
  value,
  onValueChange,
}: {
  champs: Champ[]
  value?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <Select name="champEnrichissableId" value={value} defaultValue={champs[0]?.id} onValueChange={onValueChange}>
      <SelectTrigger className="h-10 w-full rounded-lg">
        <SelectValue placeholder="Champ cible" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__source-heading__" disabled className="font-semibold text-muted-foreground">
          Données sources
        </SelectItem>
        {SOURCE_FIELDS.map((f) => (
          <SelectItem key={f.code} value={`__SOURCE_${f.code}`} className="pl-6">
            {f.label}
          </SelectItem>
        ))}
        <SelectItem value="__enrichi-heading__" disabled className="font-semibold text-muted-foreground">
          Champs enrichis
        </SelectItem>
        {champs.map((c) => (
          <SelectItem key={c.id} value={c.id} className="pl-6">
            {c.nomAffichage}
          </SelectItem>
        ))}
        <SelectItem value="__virtual-heading__" disabled className="font-semibold text-muted-foreground">
          Filtres virtuels
        </SelectItem>
        {VIRTUAL_FILTERS.map((v) => (
          <SelectItem key={v.codeMachine} value={`__VIRTUAL_${v.codeMachine}`} className="pl-6">
            {v.nomFiltre}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 4: Vérifier**

Run: `cd app && npm run typecheck && npm run lint`
Expected: aucune erreur.

Vérification manuelle : `npm run dev`, ouvrir **Admin → Filtres**, dans « Champ cible » la section **Données sources** doit lister les 10 entrées du catalogue (N° d'inscription, Date de vente, Prix à l'acte, Vendeur, Acheteur, Lots cadastraux, Adresse, Municipalité, MRC, Superficie (ha)). Sélectionner « MRC » : le type de filtre proposé doit être **Liste** (badge « Recommandé »). Ajouter le filtre : il apparaît dans la liste.

- [ ] **Step 5: Commit**

```bash
cd app && git add src/components/filters-admin-form.tsx
git commit -m "feat(admin): options de filtres source issues du catalogue"
```

---

### Task 5: Filtres côté transaction

**Files:**
- Modify: `app/src/components/transaction-filters.tsx`

**Interfaces:**
- Consumes: `FilterConfig.optionsListe` (niveau supérieur, Task 2/3) ; `isSourceFieldCode` (Task 1).
- Produces: le filtre « N° de lot » émet `field: "lots_cadastraux"` (snake_case) au lieu de `"lotsCadastraux"`.

**Vérification :** composant sans harnais de test ; validation = `tsc`, `lint`, vérification manuelle (Step 4).

- [ ] **Step 1: Import**

Ajouter :
```ts
import { isSourceFieldCode } from "@/lib/transaction-source-fields"
```

- [ ] **Step 2: Champ du filtre lot**

Remplacer, dans `buildFilters` (ligne 132), `field: "lotsCadastraux",` par `field: "lots_cadastraux",`.

- [ ] **Step 3: Options et opérateurs (distinguer virtuel et source)**

Remplacer le bloc lignes 220–227 par :

```ts
            const isVirtual = !!f.codeMachine && !isSourceFieldCode(f.codeMachine)
            const rawOptions = isVirtual
              ? VIRTUAL_FILTER_OPTIONS[f.codeMachine as string] || []
              : Array.isArray(f.optionsListe)
                ? f.optionsListe
                    .filter((o): o is string => typeof o === "string")
                    .map((o) => ({ label: o, value: o }))
                : []
            const operators = isVirtual
              ? VIRTUAL_FILTER_OPERATORS[f.codeMachine as string] || [defaultOperator(f.typeFiltre)]
              : f.operateursDisponibles || [defaultOperator(f.typeFiltre)]
```

**Pourquoi :** jusqu'ici `f.codeMachine` n'était renseigné que pour les filtres virtuels. Désormais un filtre source porte aussi un `codeMachine` (`"mrc"`), donc le test `f.codeMachine ? …` confondrait les deux et afficherait un champ texte au lieu d'une liste. `isSourceFieldCode` les distingue.

- [ ] **Step 4: Vérifier**

Run: `cd app && npm run typecheck && npm run lint`
Expected: aucune erreur.

Vérification manuelle : `npm run dev`, ouvrir **Transactions**. Le filtre « MRC » ajouté en Task 4 doit afficher une **liste déroulante** de valeurs (MRC distincts des transactions), et non un champ texte. Saisir un n° de lot dans « N° de lot (revente) » puis **Rechercher** : le filtre doit s'appliquer (aucune erreur serveur).

- [ ] **Step 5: Commit**

```bash
cd app && git add src/components/transaction-filters.tsx
git commit -m "fix(transaction): distinguer filtres source et virtuels, code lot snake_case"
```

---

### Task 6: Enum Prisma `NatureChamp`, migration et seeds

**Files:**
- Modify: `app/prisma/schema.prisma`
- Create: `app/prisma/migrations/<timestamp>_nature_champ_enum/migration.sql` (généré puis édité)
- Modify: `app/prisma/seed.ts`
- Modify: `app/prisma/seed.sql`

**Interfaces:**
- Consumes: tout le travail précédent — plus aucun `nature === "SOURCE"` ne doit subsister.
- Produces: `enum NatureChamp { SAISISSABLE CALCULE }` ; `ChampEnrichissable.nature` typé `NatureChamp`.

- [ ] **Step 1: Vérifier qu'aucun code ne référence encore la nature SOURCE**

Run: `cd app && npx rg -n '"SOURCE"|nature === "SOURCE"|nature !== "SOURCE"|\.nature\b' src/`
Expected: aucune occurrence de `"SOURCE"`. Des `.nature` subsistent légitimement dans `lib/champs.ts`, `components/champs-admin.tsx`, `repositories/champs.repository.ts`, `repositories/enrichment.repository.ts`, `services/import.service.ts` (constantes locales sans rapport). Si `repositories/filters.repository.ts` ou `components/filters-admin-form.tsx` apparaissent, revenir aux Tasks 3/4.

- [ ] **Step 2: Modifier le schéma**

Dans `app/prisma/schema.prisma`, ajouter avant `model ChampEnrichissable` :

```prisma
enum NatureChamp {
  SAISISSABLE
  CALCULE
}
```

Puis remplacer, dans `model ChampEnrichissable`, la ligne `nature String` par :

```prisma
  nature               NatureChamp
```

- [ ] **Step 3: Générer la migration puis l'éditer**

Run: `cd app && npx prisma migrate dev --create-only --name nature_champ_enum`
Expected: création d'un dossier `prisma/migrations/<timestamp>_nature_champ_enum/migration.sql` avec une conversion `String` → `NatureChamp`.

Éditer ce `migration.sql` pour insérer les suppressions **avant** la création du type et la conversion. Contenu cible (les noms de contraintes/index générés par Prisma pour le reste du fichier sont conservés tels quels) :

```sql
-- Remove rows that do not match the cahier des charges enum, and their dependents.
DELETE FROM "filtre_recherche"
 WHERE "id_champ_enrichissable" IN (
   SELECT "id" FROM "champ_enrichissable" WHERE "nature" NOT IN ('SAISISSABLE', 'CALCULE'));

DELETE FROM "valeur_enrichissement"
 WHERE "id_champ_enrichissable" IN (
   SELECT "id" FROM "champ_enrichissable" WHERE "nature" NOT IN ('SAISISSABLE', 'CALCULE'));

DELETE FROM "champ_enrichissable" WHERE "nature" NOT IN ('SAISISSABLE', 'CALCULE');

CREATE TYPE "NatureChamp" AS ENUM ('SAISISSABLE', 'CALCULE');

ALTER TABLE "champ_enrichissable"
  ALTER COLUMN "nature" TYPE "NatureChamp" USING ("nature"::"NatureChamp");
```

Si Prisma a émis d'autres instructions (`DROP DEFAULT`, index, clés étrangères), les laisser en place et n'insérer que les `DELETE` **au tout début** du fichier ; l'ordre relatif des `CREATE TYPE` / `ALTER COLUMN` émis par Prisma reste valide.

- [ ] **Step 4: Appliquer la migration et régénérer le client**

Run: `cd app && npx prisma migrate dev`
Expected: migration appliquée sans erreur, puis `prisma generate` rafraîchit le client. `ChampEnrichissable.nature` est désormais typé `NatureChamp`.

- [ ] **Step 5: Retirer les champs source des seeds**

Dans `app/prisma/seed.ts`, supprimer le bloc `const sourceChamps = [ … ]` (lignes 46–57) **et** sa boucle `for (const c of sourceChamps) { … }` (lignes 59–65). Conserver les blocs `typologies`, `villes`, `geoChamps`, `typeTransaction` et les deux filtres.

Dans `app/prisma/seed.sql`, supprimer le bloc `-- Champs enrichissables sources` (lignes 27–43, du commentaire jusqu'au `ON CONFLICT … DO NOTHING;` inclus). Conserver « Champs géo », « Type de transaction » et « Filtres virtuels ».

- [ ] **Step 6: Rejouer le seed**

Run: `cd app && npm run db:seed`
Expected: `Seed completed.`

- [ ] **Step 7: Vérifier l'ensemble**

Run: `cd app && npm run typecheck && npm run lint && npm test`
Expected: `tsc` sans erreur, `lint` propre, **tous** les tests verts (y compris `tests/lib/transaction-source-fields.test.ts` et `tests/server/filters.test.ts`).

Vérification manuelle : `npm run dev`, **Admin → Champs enrichissables** ne doit plus lister les données source ; **Admin → Filtres** propose toujours la section « Données sources » (issue du catalogue, plus de la base).

- [ ] **Step 8: Commit**

```bash
cd app && git add prisma/schema.prisma prisma/migrations prisma/seed.ts prisma/seed.sql
git commit -m "feat(db): nature devient un enum SAISISSABLE|CALCULE et les champs source quittent le seed"
```

---

## Références consommées par plusieurs tâches

- `SOURCE_FIELDS`, `SOURCE_FIELD_BY_CODE`, `SOURCE_FIELD_CODES`, `isSourceFieldCode(code)`, `sourceColumnOf(code)` — Task 1.
- `FilterConfig.optionsListe?: string[] | null` — Task 2 (type), rempli en Task 3, lu en Task 5.
- Convention de filtre : `champEnrichissableId === null && isSourceFieldCode(codeMachine)` ⇒ filtre source ; `champEnrichissableId === null && codeMachine non source` ⇒ filtre virtuel (`statut`).
