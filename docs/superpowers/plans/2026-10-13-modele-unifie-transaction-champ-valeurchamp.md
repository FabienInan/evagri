# Modèle unifié Transaction / Champ / ValeurChamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer l'application EVAGRI du modèle à deux tables (`TransactionSource` + `TransactionEnrichie` + `ValeurEnrichissement`) vers le modèle unifié EAV (`Transaction` + `Champ` + `ValeurChamp`) décrit dans le cahier des charges révisé (§6.4–6.8, §7.1–7.3), en conservant une carte plate `fields: Record<code_machine, value>` comme unique frontière entre le stockage et le reste de l'app.

**Architecture:** Le stockage devient EAV (toutes les valeurs, importées/saisies/calculées, vivent dans `valeur_champ`). Repositories et sérialiseurs hydratent une carte plate `fields` (clés snake_case `code_machine`) plus `statut`. Les couches `lib`, actions et composants ne lisent que cette carte. Le catalogue statique `transaction-source-fields.ts` est remplacé par `imported-fields.ts` (source d'amorçage du seed + hints d'affichage). La base est reset + reseed (environnement dev uniquement).

**Tech Stack:** Next.js 16 (App Router, server actions), React 19, Prisma 6 + PostgreSQL, Vitest (env node), Decimal.js, Zod, TypeScript (`tsc --noEmit`).

**Spec:** `docs/superpowers/specs/2026-10-13-modele-unifie-transaction-champ-valeurchamp-design.md`

## Global Constraints

- Travailler directement sur `main` ; garder le travail commité en local (ne pas pousser).
- `code_machine` (snake_case) est l'identifiant canonique unique : règles de calcul, filtres, clés de `fields`, résolution à l'import. Plus de double vocabulaire camelCase/snake_case.
- Modèle reset+reseed : aucune donnée de production conservée. La migration drope les anciennes tables et crée les nouvelles ; `npm run db:migrate` enchaîne `postdb:migrate` → `tsx prisma/seed.ts`.
- `StatutTransaction { NON_ANALYSEE, ANALYSEE }`, défaut `NON_ANALYSEE` ; libellés affichés « Non analysée » / « Analysée ». Toute comparaison `=== "Analysée"` devient `=== "ANALYSEE"`.
- `NatureChamp { IMPORTE, SAISISSABLE, CALCULE }`. `est_modifiable` devient `est_lecture_seule` (sens inversé) : `true` pour `IMPORTE`, `false` pour `SAISISSABLE`, forcé `true` pour `CALCULE`.
- `ValeurChamp` ajoute `valeur_texte_multiple String[]` et `valeur_date Date?` ; `@@unique([transactionId, champId])`.
- Le nom d'interface TypeScript `ChampEnrichissableConfig` est **conservé** (renommage cosmétique évité pour limiter le diff) ; son champ `estModifiable` devient `estLectureSeule`.
- Ne pas toucher aux règles de calcul (calculator.ts) ni à la validation (validation.ts) au-delà de l'adaptation au contexte fusionné `fields`.
- TDD : chaque tâche écrit d'abord un test rouge, le fait échouer, implémente, le fait passer, commit.

### Zone rouge de compilation

Le renommage des modèles Prisma est atomique : dès la Task 3, `npm run typecheck` et les tests qui touchent l'ancien schéma sont rouges jusqu'à la fin de la migration. C'est attendu. Chaque tâche n'est tenue qu'à faire passer **son** fichier de test ciblé (`npm test -- <fichier>`). La vérification globale verte (`typecheck` + `test` + `lint`) est l'acceptance de la Task 12.

## Review Focus

Cinq classes d'entrées que la spec implique sans qu'aucun test de tâche ne les exerce par défaut ; chacune est rattachée au test de la tâche propriétaire du code.

1. **Champ importé éditable en lecture seule** : un admin décoche « Lecture seule » sur un champ `IMPORTE` → l'évaluateur doit pouvoir corriger la valeur et la sauvegarde doit persister `valeur_champ` (test dans Task 7, `tests/server/transaction.test.ts` + Task 11 `field-control`).
2. **`lots_cadastraux` (`TEXTE_MULTIPLE`) filtré** : un filtre `NUMERO_LOT` doit matcher via `valeurTexteMultiple.hasSome`, pas via `valeurTexte.contains` (test dans Task 6, `tests/lib/filters.test.ts`).
3. **Booléen importé stocké en texte** (« Oui ») : un filtre `BOOLEEN` doit matcher `valeurBooleen=true` OU `valeurTexte in booleanTextMatches` (test dans Task 6).
4. **Comparaisons de statut** : toute comparaison de code à `"Analysée"`/`"A analyser"` doit devenir `ANALYSEE`/`NON_ANALYSEE` ; une comparaison oubliée bascule silencieusement la fiche entre édition et consultation (test dans Task 5 `tests/lib/fiche.test.ts` + Task 11 composants).
5. **Détection de doublon** `(numero_inscription, date_vente)` via `ValeurChamp` : une date nulle doit dédupliquer contre une date nulle (pas contre une autre date), et un ré-import ne doit pas créer de seconde ligne (test dans Task 9, `tests/services/import.test.ts`).

---

### Task 1: Catalogue des champs importés

**Files:**
- Create: `app/src/lib/imported-fields.ts`
- Test: `app/tests/lib/imported-fields.test.ts`
- Delete (at end of task): `app/src/lib/transaction-source-fields.ts`, `app/tests/lib/transaction-source-fields.test.ts`

**Interfaces:**
- Consumes: `TypeDonneesChamp` (`@/types/champ`), `FilterType` (`@/types/filter`).
- Produces: `ImportedField { code, label, typeDonnees, typeFiltreRecommande, entetesImport:{JLR:string[];EXISTANT_EVAGRI:string[]}, numeric, display:{sortable,defaultVisible,minWidth,priority} }`, `IMPORTED_FIELDS: ImportedField[]`, `IMPORTED_FIELD_BY_CODE: Record<string, ImportedField>`, `isImportedFieldCode(code): boolean`.

> Garder `transaction-source-fields.ts` intact jusqu'à la Task 12 (ses consommateurs ne sont migrés qu'ensuite) ; il est supprimé une fois `SOURCE_FIELDS`/`TRANSACTION_SOURCE_FIELDS` sans consommateur.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/imported-fields.test.ts
import { describe, it, expect } from "vitest"
import { IMPORTED_FIELDS, IMPORTED_FIELD_BY_CODE, isImportedFieldCode } from "@/lib/imported-fields"

describe("IMPORTED_FIELDS", () => {
  it("catalogues the 12 imported fields with unique snake_case codes", () => {
    expect(IMPORTED_FIELDS).toHaveLength(12)
    expect(new Set(IMPORTED_FIELDS.map((f) => f.code)).size).toBe(12)
    for (const f of IMPORTED_FIELDS) expect(f.code).toMatch(/^[a-z][a-z0-9_]*$/)
  })

  it("exposes a by-code lookup and a membership guard", () => {
    expect(IMPORTED_FIELD_BY_CODE.mrc.label).toBe("MRC")
    expect(isImportedFieldCode("lots_cadastraux")).toBe(true)
    expect(isImportedFieldCode("champ_inconnu")).toBe(false)
    expect(isImportedFieldCode(null)).toBe(false)
  })

  it("types lots_cadastraux as TEXTE_MULTIPLE and latitude/longitude as numeric geo", () => {
    expect(IMPORTED_FIELD_BY_CODE.lots_cadastraux.typeDonnees).toBe("TEXTE_MULTIPLE")
    expect(IMPORTED_FIELD_BY_CODE.latitude.numeric).toBe(true)
    expect(IMPORTED_FIELD_BY_CODE.latitude.typeFiltreRecommande).toBe("ZONE_GEO")
  })

  it("carries EVAGRI/JLR import headers", () => {
    expect(IMPORTED_FIELD_BY_CODE.date_vente.entetesImport.EXISTANT_EVAGRI).toContain("Date de L'acte")
    expect(IMPORTED_FIELD_BY_CODE.mrc.entetesImport.JLR).toContain("MRC")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/imported-fields.test.ts`
Expected: FAIL — `Cannot find module '@/lib/imported-fields'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/imported-fields.ts
import type { TypeDonneesChamp } from "@/types/champ"
import type { FilterType } from "@/types/filter"

export interface ImportedField {
  /** code_machine (snake_case) : identifiant canonique, clé de `fields` et des règles de calcul. */
  code: string
  /** nom_affichage par défaut du Champ amorcé. */
  label: string
  typeDonnees: TypeDonneesChamp
  typeFiltreRecommande: FilterType
  /** Correspondance d'en-têtes de feuille par système source (§6.5). */
  entetesImport: { JLR: string[]; EXISTANT_EVAGRI: string[] }
  numeric: boolean
  /** Hints d'affichage du tableau de transactions. */
  display: { sortable: boolean; defaultVisible: boolean; minWidth: number; priority: number }
}

export const IMPORTED_FIELDS: ImportedField[] = [
  { code: "numero_inscription", label: "N° d'inscription", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["No d'enregistrement", "No d'enr."] },
    display: { sortable: true, defaultVisible: true, minWidth: 140, priority: 9 } },
  { code: "date_vente", label: "Date de vente", typeDonnees: "DATE", typeFiltreRecommande: "PLAGE_DATE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Date de L'acte", "Date de l'acte ou de l'avant contrat"] },
    display: { sortable: true, defaultVisible: true, minWidth: 130, priority: 8 } },
  { code: "vendeur", label: "Vendeur", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Vendeur"] },
    display: { sortable: true, defaultVisible: false, minWidth: 160, priority: 1 } },
  { code: "acheteur", label: "Acheteur", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Acheteur"] },
    display: { sortable: true, defaultVisible: false, minWidth: 160, priority: 1 } },
  { code: "lots_cadastraux", label: "Lots cadastraux", typeDonnees: "TEXTE_MULTIPLE", typeFiltreRecommande: "NUMERO_LOT", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Lots"] },
    display: { sortable: false, defaultVisible: false, minWidth: 140, priority: 1 } },
  { code: "prix_vente", label: "Prix à l'acte", typeDonnees: "DECIMAL", typeFiltreRecommande: "PLAGE_NUMERIQUE", numeric: true,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Prix de vente", "Prix de vente ($)"] },
    display: { sortable: true, defaultVisible: true, minWidth: 140, priority: 7 } },
  { code: "mrc", label: "MRC", typeDonnees: "TEXTE", typeFiltreRecommande: "LISTE", numeric: false,
    entetesImport: { JLR: ["MRC"], EXISTANT_EVAGRI: ["MRC"] },
    display: { sortable: true, defaultVisible: true, minWidth: 120, priority: 4 } },
  { code: "municipalite", label: "Municipalité", typeDonnees: "TEXTE", typeFiltreRecommande: "LISTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Ville/Municipalité"] },
    display: { sortable: true, defaultVisible: false, minWidth: 150, priority: 1 } },
  { code: "adresse", label: "Adresse", typeDonnees: "TEXTE", typeFiltreRecommande: "RECHERCHE_TEXTE", numeric: false,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Adresse complete", "Adresse complète"] },
    display: { sortable: true, defaultVisible: false, minWidth: 200, priority: 1 } },
  { code: "superficie_totale_hectare", label: "Superficie (ha)", typeDonnees: "DECIMAL", typeFiltreRecommande: "PLAGE_NUMERIQUE", numeric: true,
    entetesImport: { JLR: [], EXISTANT_EVAGRI: ["Superficie Totale (ha)"] },
    display: { sortable: true, defaultVisible: true, minWidth: 130, priority: 5 } },
  { code: "latitude", label: "Latitude", typeDonnees: "DECIMAL", typeFiltreRecommande: "ZONE_GEO", numeric: true,
    entetesImport: { JLR: ["Latitude"], EXISTANT_EVAGRI: ["Latitude", "Lat"] },
    display: { sortable: false, defaultVisible: false, minWidth: 110, priority: 1 } },
  { code: "longitude", label: "Longitude", typeDonnees: "DECIMAL", typeFiltreRecommande: "ZONE_GEO", numeric: true,
    entetesImport: { JLR: ["Longitude"], EXISTANT_EVAGRI: ["Longitude", "Long", "Lng"] },
    display: { sortable: false, defaultVisible: false, minWidth: 110, priority: 1 } },
]

export const IMPORTED_FIELD_BY_CODE: Record<string, ImportedField> = Object.fromEntries(
  IMPORTED_FIELDS.map((f) => [f.code, f])
)

export function isImportedFieldCode(code: string | null | undefined): boolean {
  return !!code && Object.hasOwn(IMPORTED_FIELD_BY_CODE, code)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/imported-fields.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/imported-fields.ts app/tests/lib/imported-fields.test.ts
git commit -m "feat(champ): ajouter le catalogue des champs importés"
```

---

### Task 2: Types partagés + `lib/champs.ts`

**Files:**
- Modify: `app/src/types/champ.ts`, `app/src/types/filter.ts`
- Modify: `app/src/lib/champs.ts`
- Test: `app/tests/lib/champs.test.ts`

**Interfaces:**
- Produces: `NATURE_CHAMP` includes `"IMPORTE"`; `TYPE_DONNEES_CHAMP` includes `"TEXTE_MULTIPLE"`; `ChampEnrichissableConfig` exposes `estLectureSeule: boolean` (plus `typeFiltreRecommande: string | null`) instead of `estModifiable`; `ChampEnrichissableInput = Omit<ChampEnrichissableConfig, "id" | "estLectureSeule" | "actif">`; `deriveEstLectureSeule(nature: NatureChamp): boolean`; `validateChampConfig` rejects a `regle_calcul` on an `IMPORTE` champ and collisions against the passed `knownCodes`.
- Consumes: nothing new.

- [ ] **Step 1: Update the shared types**

In `src/types/champ.ts` replace the first two consts and the config interface:

```ts
export const NATURE_CHAMP = ["IMPORTE", "SAISISSABLE", "CALCULE"] as const
export type NatureChamp = (typeof NATURE_CHAMP)[number]

export const TYPE_DONNEES_CHAMP = ["DECIMAL", "ENTIER", "LISTE", "MULTI_SELECT", "TEXTE", "TEXTE_MULTIPLE", "BOOLEAN", "DATE"] as const
export type TypeDonneesChamp = (typeof TYPE_DONNEES_CHAMP)[number]

/** LISTE and MULTI_SELECT both draw their values from `optionsListe`; MULTI_SELECT stores several of them. */
export const OPTION_TYPES: TypeDonneesChamp[] = ["LISTE", "MULTI_SELECT"]
```

Then in `ChampEnrichissableConfig` replace `estModifiable: boolean` with:

```ts
  typeFiltreRecommande: string | null
  estLectureSeule: boolean
```

and change the input alias to:

```ts
/** Fields an administrator can set; est_lecture_seule is always derived from nature, never sent by the client. */
export type ChampEnrichissableInput = Omit<ChampEnrichissableConfig, "id" | "estLectureSeule" | "actif" | "typeFiltreRecommande">
```

In `src/types/filter.ts` rename the nested field `champEnrichissable` → `champ` inside `FilterConfig` (keep `codeMachine?` for virtual filters):

```ts
export interface FilterConfig {
  id: string
  nomFiltre: string
  typeFiltre: FilterType | string
  estActif: boolean
  codeMachine?: string | null
  champ?:
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
  /** Distinct values for a list-type filter, read from ValeurChamp for any nature. */
  optionsListe?: string[] | null
  ordreAffichage: number
}
```

- [ ] **Step 2: Write the failing test**

```ts
// tests/lib/champs.test.ts  (remplacer le contenu existant)
import { describe, it, expect } from "vitest"
import { deriveEstLectureSeule, validateChampConfig, normalizeChampInput } from "@/lib/champs"
import type { ChampEnrichissableInput } from "@/types/champ"

const base: ChampEnrichissableInput = {
  codeMachine: "nouveau",
  nomAffichage: "Nouveau",
  typeDonnees: "TEXTE",
  nature: "SAISISSABLE",
  unite: "N/A",
  plageMin: null,
  plageMax: null,
  optionsListe: null,
  regleCalcul: null,
  applicableATypes: ["TERRES_CULTIVEES"],
  ordreAffichage: 0,
  estAffiche: true,
  estObligatoire: false,
}

describe("deriveEstLectureSeule", () => {
  it("is true for IMPORTE and CALCULE, false for SAISISSABLE", () => {
    expect(deriveEstLectureSeule("IMPORTE")).toBe(true)
    expect(deriveEstLectureSeule("CALCULE")).toBe(true)
    expect(deriveEstLectureSeule("SAISISSABLE")).toBe(false)
  })
})

describe("normalizeChampInput", () => {
  it("forces est_obligatoire off for a non-SAISISSABLE nature", () => {
    expect(normalizeChampInput({ ...base, nature: "CALCULE", estObligatoire: true, regleCalcul: "a + b" }).estObligatoire).toBe(false)
  })
})

describe("validateChampConfig", () => {
  it("rejects a code that collides with a reserved imported code", () => {
    const errors = validateChampConfig({ ...base, codeMachine: "prix_vente" }, new Set(["prix_vente"]))
    expect(errors.some((e) => e.field === "codeMachine")).toBe(true)
  })

  it("rejects a regle_calcul on an IMPORTE champ", () => {
    const errors = validateChampConfig({ ...base, nature: "IMPORTE", regleCalcul: "a + b" }, new Set())
    expect(errors.some((e) => e.field === "regleCalcul")).toBe(true)
  })

  it("accepts a valid saisissable champ", () => {
    expect(validateChampConfig(base, new Set())).toEqual([])
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/champs.test.ts`
Expected: FAIL — `deriveEstLectureSeule is not a function` / type errors.

- [ ] **Step 4: Update `lib/champs.ts`**

Replace the import line, the `deriveEstModifiable` function, the `normalizeChampInput` body and the collision/regle block:

```ts
import { z } from "zod"
import { validateRuleSyntax } from "@/lib/calculator"
import { hasOptions, type ChampEnrichissableInput, type NatureChamp } from "@/types/champ"
```

```ts
/** est_lecture_seule is never client-supplied: it is entirely derived from nature (§6.5). */
export function deriveEstLectureSeule(nature: NatureChamp): boolean {
  return nature !== "SAISISSABLE"
}
```

In `normalizeChampInput`, unchanged except it still forces `estObligatoire` only for SAISISSABLE.

In `validateChampConfig`, replace the source-code collision branch:

```ts
  } else if (knownFieldCodes.has(input.codeMachine)) {
    // A champ whose code shadows an existing champ (imported codes included) would make a
    // regle_calcul ambiguous; imported codes are reserved.
    errors.push({ field: "codeMachine", message: "Ce code machine est déjà utilisé." })
  }
```

and add, after the CALCULE-regle block:

```ts
  if (input.nature === "IMPORTE" && regleCalcul) {
    errors.push({ field: "regleCalcul", message: "Un champ importé ne peut pas porter de règle de calcul." })
  }
```

Remove the now-unused `import { isSourceFieldCode } from "@/lib/transaction-source-fields"`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/champs.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/types/champ.ts app/src/types/filter.ts app/src/lib/champs.ts app/tests/lib/champs.test.ts
git commit -m "feat(champ): nature IMPORTE, est_lecture_seule et validation"
```

---

### Task 3: Schéma Prisma, migration et seed

**Files:**
- Modify: `app/prisma/schema.prisma`
- Create: `app/prisma/migrations/<timestamp>_unified_transaction_champ_valeurchamp/migration.sql` (généré puis revu)
- Modify: `app/prisma/seed.ts`
- Test: `app/tests/server/schema.test.ts`

**Interfaces:**
- Produces: modèles Prisma `Transaction`, `Champ`, `ValeurChamp` ; enums `StatutTransaction`, `NatureChamp` (3 valeurs) ; FK renommées (`PanierTransaction.transactionId`, `ParametresAnalyseTransaction.transactionId`, `IndicateursAjustes.transactionId`, `DocumentActe.transactionId`, `FiltreRecherche.champId`). Seed : 12 `Champ` `IMPORTE`, section « Données de l'acte » dans `VueFicheEvaluation`.
- Consumes: `IMPORTED_FIELDS` (Task 1).

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/schema.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"

const ORG = "90a5866e-06e5-46ce-9941-56582b8ca15c"

describe("unified schema", () => {
  it("enumerates StatutTransaction and NatureChamp", async () => {
    const rows = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'StatutTransaction' ORDER BY e.enumsortorder`
    expect(rows.map((r) => r.enumlabel)).toEqual(["NON_ANALYSEE", "ANALYSEE"])
    const nature = await prisma.$queryRaw<{ enumlabel: string }[]>`
      SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'NatureChamp' ORDER BY e.enumsortorder`
    expect(nature.map((r) => r.enumlabel)).toEqual(["IMPORTE", "SAISISSABLE", "CALCULE"])
  })

  it("seeds the 12 imported champs as read-only IMPORTE", async () => {
    const champs = await prisma.champ.findMany({ where: { organisationId: ORG, nature: "IMPORTE" } })
    expect(champs).toHaveLength(12)
    expect(champs.every((c) => c.estLectureSeule)).toBe(true)
    const mrc = champs.find((c) => c.codeMachine === "mrc")
    expect(mrc?.entetesImport).not.toBeNull()
  })

  it("seeds a default fiche section holding the imported champs", async () => {
    const vue = await prisma.vueFicheEvaluation.findFirst({ where: { organisationId: ORG, typeVue: "FICHE_TRANSACTION" } })
    const contenu = vue?.contenu as { sections?: { nom: string; champs: string[] }[] } | undefined
    expect(contenu?.sections?.[0]?.nom).toBe("Données de l'acte")
    expect(contenu?.sections?.[0]?.champs.length).toBe(12)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/server/schema.test.ts`
Expected: FAIL — `prisma.champ` undefined / tables inexistantes.

- [ ] **Step 3: Edit the Prisma schema**

Replace `model TransactionSource`, `model TransactionEnrichie`, `enum NatureChamp`, `model ChampEnrichissable`, `model ValeurEnrichissement` with (keep the rest of the file unchanged):

```prisma
enum StatutTransaction {
  NON_ANALYSEE
  ANALYSEE
}

model Transaction {
  id             String            @id @default(uuid())
  organisationId String            @map("id_organisation")
  importationId  String?           @map("id_importation")
  systemeSource  String            @map("systeme_source")
  statut         StatutTransaction @default(NON_ANALYSEE)
  contributeurId String?           @map("id_contributeur")
  dateStatut     DateTime?         @map("date_statut")
  createdAt      DateTime          @default(now()) @map("date_creation")
  updatedAt      DateTime          @updatedAt @map("date_modification")

  valeurs    ValeurChamp[]
  documents  DocumentActe[]
  paniers    PanierTransaction[]
  resultats  IndicateursAjustes[]
  parametres ParametresAnalyseTransaction[]
  importation Importation?         @relation(fields: [importationId], references: [id])
  organisation Organisation        @relation(fields: [organisationId], references: [id])

  @@map("transaction")
}

enum NatureChamp {
  IMPORTE
  SAISISSABLE
  CALCULE
}

model Champ {
  id                   String      @id @default(uuid())
  organisationId       String      @map("id_organisation")
  codeMachine          String      @map("code_machine")
  nomAffichage         String      @map("nom_affichage")
  typeDonnees          String      @map("type_donnees")
  typeFiltreRecommande String?     @map("type_filtre_recommande")
  nature               NatureChamp
  unite                String      @default("N/A") @map("unite")
  plageMin             Decimal?    @map("plage_min") @db.Decimal(18, 4)
  plageMax             Decimal?    @map("plage_max") @db.Decimal(18, 4)
  optionsListe         Json?       @map("options_liste")
  regleCalcul          String?     @map("regle_calcul")
  entetesImport        Json?       @map("entetes_import")
  applicableATypes     Json        @default("[]") @map("applicable_a_types")
  ordreAffichage       Int         @default(0) @map("ordre_affichage")
  estAffiche           Boolean     @default(true) @map("est_affiche")
  estLectureSeule      Boolean     @default(true) @map("est_lecture_seule")
  estObligatoire       Boolean     @default(false) @map("est_obligatoire")
  actif                Boolean     @default(true)
  organisation         Organisation @relation(fields: [organisationId], references: [id])
  filtres              FiltreRecherche[]
  valeurs              ValeurChamp[]

  @@unique([organisationId, codeMachine])
  @@map("champ")
}

model ValeurChamp {
  id                  String      @id @default(uuid())
  transactionId       String      @map("id_transaction")
  champId             String      @map("id_champ")
  valeurNombre        Decimal?    @map("valeur_nombre") @db.Decimal(18, 4)
  valeurTexte         String?     @map("valeur_texte")
  valeurTexteMultiple String[]    @map("valeur_texte_multiple")
  valeurBooleen       Boolean?    @map("valeur_booleen")
  valeurDate          DateTime?   @map("valeur_date") @db.Date
  dateModification    DateTime    @default(now()) @map("date_modification")
  modifieParId        String?     @map("id_modifie_par")
  transaction         Transaction @relation(fields: [transactionId], references: [id])
  champ               Champ       @relation(fields: [champId], references: [id])

  @@unique([transactionId, champId])
  @@index([champId, valeurTexte])
  @@index([champId, valeurDate])
  @@index([champId, valeurTexteMultiple(ops: ArrayOps)], type: Gin)
  @@map("valeur_champ")
}
```

Also update the dependent models and `Organisation`:
- `Organisation`: `enrichies TransactionEnrichie[]` → remove; `transactions TransactionSource[]` → `transactions Transaction[]`.
- `FiltreRecherche`: `champEnrichissableId String? @map("id_champ_enrichissable")` → `champId String? @map("id_champ")`; relation field `champEnrichissable ChampEnrichissable?` → `champ Champ? @relation(fields: [champId], references: [id])`. Keep `codeMachine String?`.
- `PanierTransaction`: `transactionEnrichieId String @map("id_transaction_enrichie")` → `transactionId String @map("id_transaction")`; relation `transactionEnrichie TransactionEnrichie @relation(...)` → `transaction Transaction @relation(fields: [transactionId], references: [id])`; `@@id([panierId, transactionId])`.
- `ParametresAnalyseTransaction`: `transactionSourceId String @map("id_transaction_source")` → `transactionId String @map("id_transaction")`; relation → `transaction Transaction`; `@@unique([analyseDossierId, transactionId])`.
- `IndicateursAjustes`: same rename as above.
- `DocumentActe`: `transactionSourceId` → `transactionId @map("id_transaction")`; relation → `transaction Transaction`.
- `Importation`: `transactions TransactionSource[]` → `transactions Transaction[]`.

- [ ] **Step 4: Generate and review the migration**

Run: `cd app && npx prisma migrate dev --create-only --name unified_transaction_champ_valeurchamp`
Prisma détecte les modèles supprimés (`transaction_source`, `transaction_enrichie`, `champ_enrichissable`, `valeur_enrichissement`) → `DROP TABLE`, et les nouveaux → `CREATE TABLE` ; les dépendantes sont recréées. Ouvrir le `migration.sql` généré et vérifier que :
1. les `DROP TABLE` des anciennes tables précèdent les `CREATE` ;
2. `DROP TYPE "NatureChamp"` est présent avant `CREATE TYPE "NatureChamp"` (3 valeurs) ;
3. l'index GIN sur `valeur_texte_multiple` est présent.

Compléter à la main si un `DROP TYPE "NatureChamp"` manque. Les warnings « data will be lost » sont attendus (reset+reseed).

- [ ] **Step 5: Update the seed**

Dans `prisma/seed.ts` :
- Ajouter en tête : `import { IMPORTED_FIELDS } from "../src/lib/imported-fields"`.
- Remplacer le bloc `geoChamps` (lignes 46-57) par un bloc qui crée les 12 champs importés **avant** tout autre champ, en conservant les ids pour la section :

```ts
  const importedChampIds: string[] = []
  for (const [index, f] of IMPORTED_FIELDS.entries()) {
    const champ = await prisma.champ.upsert({
      where: { organisationId_codeMachine: { organisationId: org.id, codeMachine: f.code } },
      update: { nature: "IMPORTE", estLectureSeule: true, typeFiltreRecommande: f.typeFiltreRecommande, entetesImport: f.entetesImport },
      create: {
        organisationId: org.id,
        codeMachine: f.code,
        nomAffichage: f.label,
        typeDonnees: f.typeDonnees,
        typeFiltreRecommande: f.typeFiltreRecommande,
        nature: "IMPORTE",
        unite: f.numeric ? (f.code.startsWith("superficie") ? "ha" : f.code === "prix_vente" ? "$" : "°") : "N/A",
        entetesImport: f.entetesImport,
        applicableATypes: [],
        ordreAffichage: index,
        estAffiche: true,
        estLectureSeule: true,
      },
    })
    importedChampIds.push(champ.id)
  }
```

- Remplacer partout `prisma.champEnrichissable` par `prisma.champ`.
- Remplacer `estModifiable: false` par `estLectureSeule: true` (bloc indicateurs) ; dans les blocs `create` des champs SAISISSABLE/CALCULE ne pas passer `estLectureSeule` (défaut dérivé : `true` par défaut du schéma couvre CALCULE/IMPORTE ; pour SAISISSABLE passer `estLectureSeule: false`).
- `typeTransaction` : conserver, ajouter `estLectureSeule: false`.
- `champsIndicateurs` : ajouter `estLectureSeule: false`.
- Filtrer `typeTransaction` : `champId: typeTransaction.id` (au lieu de `champEnrichissableId`). Le filtre `statut` garde `codeMachine: "statut"`.
- Avant le `console.log("Seed completed.")`, créer la section par défaut :

```ts
  await prisma.vueFicheEvaluation.deleteMany({ where: { organisationId: org.id, typeVue: "FICHE_TRANSACTION" } })
  await prisma.vueFicheEvaluation.create({
    data: {
      organisationId: org.id,
      typeVue: "FICHE_TRANSACTION",
      contenu: {
        sections: [
          { id: "00000000-0000-0000-0000-0000000000a1", nom: "Données de l'acte", ordre: 0, champs: importedChampIds },
        ],
      },
    },
  })
```

- [ ] **Step 6: Apply the migration and reseed**

Run: `cd app && npm run db:migrate`
Expected: migration appliquée, puis `Seed completed.`. Si Prisma refuse à cause de données existantes : `npx prisma migrate reset --force` (dev uniquement).

- [ ] **Step 7: Run test to verify it passes**

Run: `cd app && npm test -- tests/server/schema.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/prisma/schema.prisma app/prisma/migrations app/prisma/seed.ts app/tests/server/schema.test.ts
git commit -m "feat(prisma): modèle unifié transaction/champ/valeur_champ + seed"
```

---

### Task 4: `lib/calculator.ts` — contexte à carte unique

**Files:**
- Modify: `app/src/lib/calculator.ts`
- Test: `app/tests/lib/calculator.test.ts`

**Interfaces:**
- Produces: `CalculationContext = { fields: Record<string, number | null> }`; `evaluateRule(rule, { fields })` ; `validateRuleSyntax(rule, knownFieldCodes)` inchangé.
- Consumes: rien.

- [ ] **Step 1: Update the test**

Dans `tests/lib/calculator.test.ts`, remplacer chaque contexte `{ source: {...}, enrichi: {...} }` par `{ fields: {...} }` fusionné (le dernier gagne en cas de collision de clés) :

```ts
  it("evaluates a simple rule against flat field values", () => {
    const context = { fields: { prix_vente: 100000, superficie_totale_hectare: 50 } }
    expect(evaluateRule("prix_vente / superficie_totale_hectare", context)).toBe(2000)
  })

  it("evaluates a compound rule mixing several fields", () => {
    const context = { fields: { a: 10, b: 20, c: 30 } }
    expect(evaluateRule("(a + b) * c / 100", context)).toBe(9)
  })

  it("returns null when a referenced field is missing", () => {
    expect(evaluateRule("prix_vente / superficie_totale_hectare", { fields: { prix_vente: 100000 } })).toBeNull()
  })

  it("returns null for an empty rule", () => {
    expect(evaluateRule("", { fields: {} })).toBeNull()
  })
```

(adapter de même les autres `it` du fichier qui passent `{ source, enrichi }`.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/calculator.test.ts`
Expected: FAIL — `context.enrichi`/`context.source` undefined.

- [ ] **Step 3: Update the implementation**

Dans `src/lib/calculator.ts` :

```ts
/** A computed field resolves its identifiers against the flat field map (imported + saisissable + calculé). */
export interface CalculationContext {
  fields: Record<string, number | null>
}
```

Remplacer `resolveIdentifier` :

```ts
function resolveIdentifier(identifier: string, context: CalculationContext): number | null {
  if (identifier in context.fields) {
    return context.fields[identifier]
  }
  return null
}
```

Le reste (`evaluateRule`, `validateRuleSyntax`, RPN) inchangé.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/calculator.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/calculator.ts app/tests/lib/calculator.test.ts
git commit -m "refactor(calculator): résoudre les identifiants sur une carte fields unique"
```

---

### Task 5: `lib/fiche.ts`

**Files:**
- Modify: `app/src/lib/fiche.ts`
- Test: `app/tests/lib/fiche.test.ts`

**Interfaces:**
- Produces: `deriveFicheMode(statut)` compares `=== "ANALYSEE"` ; `buildNumericFields(fields)` (remplace `buildSourceNumbers`) ; `buildCalculationContext(fields)` → `{ fields }` ; `toStorageValue` gère `TEXTE_MULTIPLE` → `valeurTexteMultiple` ; `buildStorageEntries(champs, valeurs, typeTransactionCode)` → entrées `{ champId, valeurNombre, valeurTexte, valeurTexteMultiple, valeurBooleen, valeurDate }` ; `withRecomputedIndicateurs(champs, fields)` ; `buildFicheViewModel` place `IMPORTE` + `SAISISSABLE` en zone principale, `CALCULE` en latérale ; `validateFiche({ champs, sections, valeurs, fields, typeCode, dateVente })`.
- Supprime : `formatSourceFieldValue`, `buildSourceNumbers`, l'import `SOURCE_FIELDS`.
- Consumes: `CalculationContext` (Task 4), `joinMultiValue`/`parseMultiValue` (`lib/multi-value`), `validateEnrichment`/`validateSaleDate` (`lib/validation`).

- [ ] **Step 1: Update the test**

Dans `tests/lib/fiche.test.ts` :
- Le helper `champ()` produit `estLectureSeule: false` (au lieu de `estModifiable: true`) et `typeFiltreRecommande: null`.
- Remplacer `withRecomputedIndicateurs(champs, sourceCols, valeurs)` par `withRecomputedIndicateurs(champs, { ...sourceColsNumeric, ...valeursNumeric })` sous forme de carte plate.
- Remplacer le cas `buildSourceNumbers({ superficie_totale_hectare })` par `buildNumericFields({ superficie_totale_hectare: 50, prix_vente: 100000 })` → `{ superficie_totale_hectare: 50, prix_vente: 100000 }`.
- `buildStorageEntries` : attendre des entrées `{ champId, valeurNombre, valeurTexte, valeurTexteMultiple, valeurBooleen, valeurDate }`. Ajouter :

```ts
  it("stores a TEXTE_MULTIPLE champ in valeurTexteMultiple", () => {
    const champs = [champ({ id: "c1", codeMachine: "lots_cadastraux", typeDonnees: "TEXTE_MULTIPLE" })]
    const entries = buildStorageEntries(champs, { lots_cadastraux: ["L1", "L2"] }, null)
    expect(entries[0]).toMatchObject({ champId: "c1", valeurTexteMultiple: ["L1", "L2"], valeurTexte: null })
  })
```

- `deriveFicheMode("ANALYSEE")` → `"consultation"`, `deriveFicheMode("NON_ANALYSEE")` → `"edition"`.
- `validateFiche` : passer `fields` (fusion source+enrichi) au lieu de `source`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/fiche.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `lib/fiche.ts`**

- Import : supprimer `import { SOURCE_FIELDS } from "@/lib/transaction-source-fields"`.
- Remplacer `deriveFicheMode` :

```ts
export function deriveFicheMode(statut: string | null | undefined): FicheMode {
  return statut === "ANALYSEE" ? "consultation" : "edition"
}
```

- Supprimer `formatSourceFieldValue` et `buildSourceNumbers`. Les remplacer par :

```ts
/** Numeric entries of the flat field map feed the calculation/validation context; other values are ignored. */
export function buildNumericFields(fields: Record<string, FicheValeur>): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const [code, valeur] of Object.entries(fields)) {
    if (typeof valeur === "number") result[code] = valeur
  }
  return result
}
```

- Remplacer `buildCalculationContext` :

```ts
export function buildCalculationContext(fields: Record<string, FicheValeur>): CalculationContext {
  return { fields: toNumericValues(fields) }
}
```

- `recomputeIndicateurs` : remplacer les usages de `context.source`/`context.enrichi` par un unique `const fields = { ...context.fields }` et évaluer `evaluateRule(champ.regleCalcul, { fields })`.

- Remplacer `withRecomputedIndicateurs` :

```ts
export function withRecomputedIndicateurs(
  champs: ChampEnrichissableConfig[],
  fields: Record<string, FicheValeur>
): Record<string, FicheValeur> {
  return { ...fields, ...recomputeIndicateurs(champs, buildCalculationContext(fields)) }
}
```

- Remplacer `toStorageValue` (retour quintuplet) :

```ts
export function toStorageValue(
  typeDonnees: TypeDonneesChamp,
  valeur: FicheValeur
): { valeurNombre: number | null; valeurTexte: string | null; valeurTexteMultiple: string[]; valeurBooleen: boolean | null; valeurDate: Date | null } {
  const empty = { valeurNombre: null, valeurTexte: null, valeurTexteMultiple: [], valeurBooleen: null, valeurDate: null }
  if (valeur === null || valeur === undefined || valeur === "") return empty

  switch (typeDonnees) {
    case "DECIMAL":
    case "ENTIER": {
      const n = typeof valeur === "number" ? valeur : Number(valeur)
      return Number.isNaN(n) ? empty : { ...empty, valeurNombre: n }
    }
    case "BOOLEAN": {
      const b = typeof valeur === "boolean" ? valeur : valeur === "true"
      return { ...empty, valeurBooleen: b }
    }
    case "DATE": {
      const d = valeur instanceof Date ? valeur : new Date(String(valeur))
      return Number.isNaN(d.getTime()) ? empty : { ...empty, valeurDate: d }
    }
    case "TEXTE_MULTIPLE": {
      const parts = Array.isArray(valeur) ? valeur.map(String) : parseMultiValue(valeur)
      return parts.length === 0 ? empty : { ...empty, valeurTexteMultiple: parts }
    }
    case "MULTI_SELECT": {
      const text = Array.isArray(valeur) ? joinMultiValue(valeur) : String(valeur)
      return text === null ? empty : { ...empty, valeurTexte: text }
    }
    default:
      return { ...empty, valeurTexte: String(valeur) }
  }
}
```

(ajouter `import { joinMultiValue, parseMultiValue } from "@/lib/multi-value"`)

- `buildFicheViewModel` : autoriser `IMPORTE` en zone principale :

```ts
      if (config.codeMachine === TYPE_TRANSACTION_CODE) continue
      if (config.nature === "CALCULE") continue
      if (!isChampVisible(config, input.typeCode, placedChampIds)) continue
```

- `validateFiche` : renommer l'entrée `source` → `fields` (`Record<string, FicheValeur>`) et lire `input.fields["superficie_totale_hectare"]` ; `pickNumber`/`pickSuperficie` opèrent déjà sur `valeurs` (inchangé).
- Remplacer `buildStorageEntries` :

```ts
export function buildStorageEntries(
  champs: ChampEnrichissableConfig[],
  valeurs: Record<string, FicheValeur>,
  typeTransactionCode: string | null
): { champId: string; valeurNombre: number | null; valeurTexte: string | null; valeurTexteMultiple: string[]; valeurBooleen: boolean | null; valeurDate: Date | null }[] {
  const entries: ReturnType<typeof buildStorageEntries> = []

  for (const champ of champs) {
    if (champ.codeMachine === TYPE_TRANSACTION_CODE) continue
    const raw = valeurs[champ.codeMachine]
    if (raw === undefined) continue
    const stored = toStorageValue(champ.typeDonnees, raw)
    if (stored.valeurNombre === null && stored.valeurTexte === null && stored.valeurTexteMultiple.length === 0 && stored.valeurBooleen === null && stored.valeurDate === null) continue
    entries.push({ champId: champ.id, ...stored })
  }

  if (typeTransactionCode) {
    const typeChamp = champs.find((c) => c.codeMachine === TYPE_TRANSACTION_CODE)
    if (typeChamp) {
      entries.push({ champId: typeChamp.id, valeurNombre: null, valeurTexte: typeTransactionCode, valeurTexteMultiple: [], valeurBooleen: null, valeurDate: null })
    }
  }

  return entries
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/fiche.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/fiche.ts app/tests/lib/fiche.test.ts
git commit -m "refactor(fiche): carte fields unifiée, TEXTE_MULTIPLE et stockage par champId"
```

---

### Task 6: `lib/filters.ts`

**Files:**
- Modify: `app/src/lib/filters.ts`
- Test: `app/tests/lib/filters.test.ts`

**Interfaces:**
- Produces: `buildWhereClause(filters): Prisma.TransactionWhereInput` émettant des clauses `valeurs: { some: { champ: { codeMachine }, … } }` pour **toute** nature (plus de branche colonne source) ; `NUMERO_LOT` → `valeurTexteMultiple: { has: value }` ; `recommendedTypeForField({ champ })` ; `filterByPolygon` inchangé (lit `latitude`/`longitude` passés par le sérialiseur).
- Supprime : `sourceColumnKey`, `buildEnrichmentWhereClause` (fusionné), l'import `transaction-source-fields`.
- Consumes: `booleanTextMatches` (`lib/normalization/parsing`).

- [ ] **Step 1: Update the test**

Dans `tests/lib/filters.test.ts`, remplacer les cas « colonne source » et enrichis par des cas `valeurs.some` sur toutes les natures :

```ts
  it("maps a LISTE filter to a ValeurChamp clause whatever the nature", () => {
    const filters: FilterInput[] = [{ id: "f1", typeFiltre: "LISTE", field: "mrc", operator: "in", value: "Drummond" }]
    expect(buildWhereClause(filters)).toEqual({
      AND: [{ valeurs: { some: { champ: { codeMachine: "mrc" }, valeurTexte: { in: ["Drummond"], mode: "insensitive" } } } }],
    })
  })

  it("maps a NUMERO_LOT filter to the multiple-value column", () => {
    const filters: FilterInput[] = [{ id: "f1", typeFiltre: "NUMERO_LOT", field: "lots_cadastraux", operator: "has", value: "123" }]
    expect(buildWhereClause(filters)).toEqual({
      AND: [{ valeurs: { some: { champ: { codeMachine: "lots_cadastraux" }, valeurTexteMultiple: { has: "123" } } } }],
    })
  })

  it("maps a numeric range filter to valeurNombre", () => {
    const filters: FilterInput[] = [{ id: "f1", typeFiltre: "PLAGE_NUMERIQUE", field: "prix_vente", operator: "+", value: "100000" }]
    expect(buildWhereClause(filters)).toEqual({
      AND: [{ valeurs: { some: { champ: { codeMachine: "prix_vente" }, valeurNombre: { gte: 100000 } } } }],
    })
  })

  it("maps a boolean filter to the boolean OR text match", () => {
    const filters: FilterInput[] = [{ id: "f1", typeFiltre: "BOOLEEN", field: "cptaq", operator: "=", value: "true" }]
    expect(buildWhereClause(filters)).toEqual({
      AND: [{ valeurs: { some: { champ: { codeMachine: "cptaq" }, OR: [
        { valeurBooleen: true },
        { valeurTexte: { in: ["true", "1", "oui", "yes", "vrai", "o", "y"], mode: "insensitive" } },
      ] } } }],
    })
  })

  it("maps a STATUT filter to the enum on the transaction", () => {
    const filters: FilterInput[] = [{ id: "s", typeFiltre: "STATUT", field: "statut", operator: "=", value: "ANALYSEE" }]
    expect(buildWhereClause(filters)).toEqual({ AND: [{ statut: "ANALYSEE" }] })
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/lib/filters.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `lib/filters.ts`**

- Imports : remplacer `import { isSourceFieldCode, sourceColumnOf, SOURCE_FIELD_BY_CODE } from "./transaction-source-fields"` par `import { booleanTextMatches } from "./normalization/parsing"` (déplacer l'import existant) ; supprimer `sourceColumnKey`.
- Remplacer `buildEnrichmentWhereClause` par une version qui produit directement la clause `valeurs.some` (renommée `buildFieldWhereClause`), avec `NUMERO_LOT` sur `valeurTexteMultiple` :

```ts
function buildFieldWhereClause(
  field: string,
  typeFiltre: FilterType,
  operator: FilterOperator,
  value: string
): Prisma.TransactionWhereInput {
  let valeurClause: Prisma.ValeurChampWhereInput = { champ: { codeMachine: field } }

  switch (typeFiltre) {
    case "RECHERCHE_TEXTE":
      valeurClause = { ...valeurClause, valeurTexte: { contains: value, mode: "insensitive" } }
      break
    case "PLAGE_NUMERIQUE":
      if (operator === "entre") {
        const [min, max] = value.split("-").map(Number)
        valeurClause = { ...valeurClause, valeurNombre: { gte: min, lte: max } }
      } else if (operator === "+") valeurClause = { ...valeurClause, valeurNombre: { gte: Number(value) } }
      else if (operator === "-") valeurClause = { ...valeurClause, valeurNombre: { lte: Number(value) } }
      else valeurClause = { ...valeurClause, valeurNombre: { equals: Number(value) } }
      break
    case "PLAGE_DATE":
      if (operator === "entre") {
        const [start, end] = value.split(",").map((s) => new Date(s.trim()))
        valeurClause = { ...valeurClause, valeurDate: { gte: start, lte: end } }
      } else if (operator === "+") valeurClause = { ...valeurClause, valeurDate: { gte: new Date(value) } }
      else if (operator === "-") valeurClause = { ...valeurClause, valeurDate: { lte: new Date(value) } }
      else valeurClause = { ...valeurClause, valeurDate: { equals: new Date(value) } }
      break
    case "LISTE":
    case "MULTI_SELECT":
      valeurClause = { ...valeurClause, valeurTexte: { in: value.split(","), mode: "insensitive" } }
      break
    case "BOOLEEN": {
      const truthy = value === "true"
      valeurClause = { ...valeurClause, OR: [
        { valeurBooleen: truthy },
        { valeurTexte: { in: booleanTextMatches(truthy), mode: "insensitive" } },
      ] }
      break
    }
    case "NUMERO_LOT":
      valeurClause = { ...valeurClause, valeurTexteMultiple: { has: value } }
      break
    default:
      valeurClause = { ...valeurClause, valeurTexte: { contains: value, mode: "insensitive" } }
  }

  return { valeurs: { some: valeurClause } }
}
```

- Remplacer `buildWhereClause` :

```ts
export function buildWhereClause(filters: FilterInput[]): Prisma.TransactionWhereInput {
  const andClauses: Prisma.TransactionWhereInput[] = []

  for (const f of filters) {
    if (!f.value && f.value !== "0") continue
    let clause: Prisma.TransactionWhereInput = {}

    switch (f.typeFiltre as FilterType) {
      case "RECHERCHE_TEXTE":
      case "PLAGE_NUMERIQUE":
      case "PLAGE_DATE":
      case "LISTE":
      case "MULTI_SELECT":
      case "BOOLEEN":
      case "NUMERO_LOT":
        clause = buildFieldWhereClause(f.field, f.typeFiltre as FilterType, f.operator as FilterOperator, f.value)
        break
      case "TYPE_TRANSACTION":
        clause = { valeurs: { some: { champ: { codeMachine: "typeTransaction" }, valeurTexte: { in: f.value.split(",") } } } }
        break
      case "STATUT":
        clause = { statut: f.operator === "=" ? (f.value as never) : { in: f.value.split(",") as never } }
        break
      case "ZONE_GEO":
      case "REVENTE":
        // appliqués de manière applicative après la requête
        break
    }

    if (Object.keys(clause).length > 0) andClauses.push(clause)
  }

  return andClauses.length > 0 ? { AND: andClauses } : {}
}
```

- `recommendedTypeForField` : supprimer la branche `isSourceFieldCode`/`SOURCE_FIELD_BY_CODE` :

```ts
export interface RecommendFilterTypeForFieldInput {
  champ?: {
    codeMachine: string
    nomAffichage: string
    typeDonnees: string
  } | null
}

export function recommendedTypeForField(input: RecommendFilterTypeForFieldInput): FilterType | null {
  if (input.champ) return recommendFilterType(input.champ)
  return null
}
```

- `orderRenteTransactions` et `filterByPolygon` : inchangés (types génériques conservés).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npm test -- tests/lib/filters.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/filters.ts app/tests/lib/filters.test.ts
git commit -m "refactor(filters): clauses unifiées sur valeur_champ pour toutes les natures"
```

---

### Task 7: Sérialiseurs + repositories transaction/fiche

**Files:**
- Modify: `app/src/serializers/transaction.serializer.ts`, `app/src/serializers/fiche.serializer.ts`
- Modify: `app/src/repositories/transaction.repository.ts`, `app/src/repositories/fiche.repository.ts`
- Modify: `app/src/repositories/fiche-layout.repository.ts`
- Test: `app/tests/server/transaction.test.ts`

**Interfaces:**
- Produces: `SerializedTransaction = { id, statut: StatutTransaction, fields: Record<string, string|number|boolean|string[]|null>, latitude: number|null, longitude: number|null, importationId, createdAt }` ; `serializeTransaction`. `TRANSACTION_INCLUDE = { valeurs: { include: { champ: true } } }`. `findTransactions`, `countTransactions`, `buildTransactionWhere` (`Prisma.TransactionWhereInput`), `findTransactionsForMap`, `findExistingTransaction`, `createImportedTransaction` (écrit `Transaction` + `ValeurChamp`). `withRenteLots(where, lots)` → `valeurs.some(champ.codeMachine='lots_cadastraux', valeurTexteMultiple.hasSome=lots)`. `saveFicheValues(transactionId, entries)` ; `updateFicheStatut(transactionId, statut, dateStatut)` ; `StorageValueEntry { champId, valeurNombre, valeurTexte, valeurTexteMultiple, valeurBooleen, valeurDate }`.
- Consumes: `buildStorageEntries` (Task 5), `serializeTransaction`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/transaction.test.ts
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { findExistingTransaction } from "@/repositories/transaction.repository"

let orgId: string

beforeAll(async () => {
  const org = await prisma.organisation.create({ data: { nom: "Test Tx Org" } })
  orgId = org.id
})

afterAll(async () => {
  await prisma.valeurChamp.deleteMany({ where: { transaction: { organisationId: orgId } } })
  await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
  await prisma.champ.deleteMany({ where: { organisationId: orgId } })
  await prisma.organisation.delete({ where: { id: orgId } })
})

describe("createImportedTransaction / serializeTransaction", () => {
  it("writes a Transaction with a ValeurChamp per imported field and hydrates a flat fields map", async () => {
    const numeroChamp = await prisma.champ.create({ data: { organisationId: orgId, codeMachine: "numero_inscription", nomAffichage: "N° d'inscription", typeDonnees: "TEXTE", nature: "IMPORTE", estLectureSeule: true } })
    const prixChamp = await prisma.champ.create({ data: { organisationId: orgId, codeMachine: "prix_vente", nomAffichage: "Prix à l'acte", typeDonnees: "DECIMAL", nature: "IMPORTE", estLectureSeule: true } })

    const tx = await prisma.transaction.create({
      data: {
        organisationId: orgId,
        systemeSource: "EXISTANT_EVAGRI",
        valeurs: { create: [
          { champId: numeroChamp.id, valeurTexte: "22309676" },
          { champId: prixChamp.id, valeurNombre: "36000" },
        ] },
      },
      include: { valeurs: { include: { champ: true } } },
    })

    const dto = serializeTransaction(tx)
    expect(dto.statut).toBe("NON_ANALYSEE")
    expect(dto.fields["numero_inscription"]).toBe("22309676")
    expect(dto.fields["prix_vente"]).toBe(36000)
  })
})

describe("findExistingTransaction", () => {
  it("dedups symmetric null dates", async () => {
    const numeroChamp = await prisma.champ.findFirstOrThrow({ where: { organisationId: orgId, codeMachine: "numero_inscription" } })
    const tx = await prisma.transaction.create({
      data: { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", valeurs: { create: [{ champId: numeroChamp.id, valeurTexte: "DUP-1" }] } },
    })
    const found = await findExistingTransaction(orgId, "DUP-1", null)
    expect(found?.id).toBe(tx.id)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/server/transaction.test.ts`
Expected: FAIL.

- [ ] **Step 3: Rewrite the transaction serializer**

```ts
// src/serializers/transaction.serializer.ts
import { Prisma } from "@prisma/client"
import Decimal from "decimal.js"

export type SerializedValue = string | number | boolean | string[] | null
export type SerializedTransaction = {
  id: string
  statut: string
  fields: Record<string, SerializedValue>
  latitude: number | null
  longitude: number | null
  importationId: string | null
  createdAt: string
}

type TransactionWithValeurs = Prisma.TransactionGetPayload<{
  include: { valeurs: { include: { champ: true } } }
}>

function decimalToNumber(value: Prisma.Decimal | null | undefined): number | null {
  if (value === null || value === undefined) return null
  return new Decimal(value.toString()).toNumber()
}

export function serializeTransaction(transaction: TransactionWithValeurs): SerializedTransaction {
  const fields: Record<string, SerializedValue> = {}

  for (const v of transaction.valeurs) {
    const code = v.champ?.codeMachine
    if (!code) continue
    if (v.valeurNombre !== null && v.valeurNombre !== undefined) fields[code] = decimalToNumber(v.valeurNombre)
    else if (v.valeurBooleen !== null && v.valeurBooleen !== undefined) fields[code] = v.valeurBooleen
    else if (v.valeurTexteMultiple.length > 0) fields[code] = v.valeurTexteMultiple
    else if (v.valeurDate !== null && v.valeurDate !== undefined) fields[code] = v.valeurDate.toISOString()
    else fields[code] = v.valeurTexte ?? null
  }

  return {
    id: transaction.id,
    statut: transaction.statut,
    fields,
    latitude: typeof fields.latitude === "number" ? fields.latitude : null,
    longitude: typeof fields.longitude === "number" ? fields.longitude : null,
    importationId: transaction.importationId ?? null,
    createdAt: transaction.createdAt.toISOString(),
  }
}
```

- [ ] **Step 4: Rewrite `transaction.repository.ts`**

- `TRANSACTION_INCLUDE` → `{ valeurs: { include: { champ: true } } } as const`.
- `TransactionSourceOrderByInput` → type de tri sur `Prisma.TransactionOrderByWithRelationInput` (garder le nom exporté pour limiter le churn, ou renommer `TransactionOrderByInput` et mettre à jour `searchTransactions`).
- `findTransactions`/`countTransactions` : `prisma.transaction...`.
- `buildTransactionWhere(filters, organisationId): Prisma.TransactionWhereInput`.
- `findRenteLotNumbers` :

```ts
export async function findRenteLotNumbers(organisationId: string): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ lot: string }[]>`
    SELECT lot
    FROM valeur_champ vc
    JOIN champ c ON c.id = vc.id_champ
    JOIN transaction t ON t.id = vc.id_transaction
    CROSS JOIN unnest(vc.valeur_texte_multiple) AS lot
    WHERE t.id_organisation = ${organisationId}
      AND c.code_machine = 'lots_cadastraux'
      AND lot <> ''
    GROUP BY lot
    HAVING count(*) > 1
  `
  return rows.map((row) => row.lot)
}
```

- `withRenteLots` :

```ts
export function withRenteLots(
  where: Prisma.TransactionWhereInput,
  lots: string[]
): Prisma.TransactionWhereInput {
  const reventeClause: Prisma.TransactionWhereInput = {
    valeurs: { some: { champ: { codeMachine: "lots_cadastraux" }, valeurTexteMultiple: { hasSome: lots } } },
  }
  const existingAnd = where.AND
  return { ...where, AND: [...(Array.isArray(existingAnd) ? existingAnd : existingAnd ? [existingAnd] : []), reventeClause] }
}
```

- `findTransactionsForMap` : `where: { organisationId, ...filterWhere }`, `select` → `valeurs: { where: { champ: { codeMachine: { in: ["latitude", "longitude"] } } }, select: { valeurNombre: true, champ: { select: { codeMachine: true } } } }` ; `extractCoordinate` inchangé (lit `v.champ?.codeMachine`).
- `findExistingTransaction(organisationId, numeroInscription, dateVente)` : interroge `ValeurChamp` joint à `Champ` :

```ts
export async function findExistingTransaction(
  organisationId: string,
  numeroInscription: string | null | undefined,
  dateVente: Date | null | undefined
) {
  if (!numeroInscription) return null
  return prisma.transaction.findFirst({
    where: {
      organisationId,
      AND: [
        { valeurs: { some: { champ: { codeMachine: "numero_inscription" }, valeurTexte: numeroInscription } } },
        dateVente
          ? { valeurs: { some: { champ: { codeMachine: "date_vente" }, valeurDate: dateVente } } }
          : { NOT: { valeurs: { some: { champ: { codeMachine: "date_vente" }, valeurDate: { not: null } } } } },
      ],
    },
  })
}
```

- `createImportedTransaction` : créer une `Transaction` (organisationId, importationId, systemeSource, statut) puis `valeurChamp.createMany` avec `transactionId`, `champId` (résolu par code_machine via `input.enrichmentValues[].champId`) et les colonnes typées. Adapter `CreateImportedTransactionInput` en conséquence (les valeurs portent `champId` + `valeurTexteMultiple`/`valeurDate`). Passer `statut: input.statut as StatutTransaction`.

- [ ] **Step 5: Update `fiche.repository.ts`**

- `ficheInclude` → `{ valeurs: { include: { champ: true } } }`.
- `FicheTransactionRecord` → payload `Transaction` avec `valeurs.champ`.
- `StorageValueEntry` → `{ champId, valeurNombre, valeurTexte, valeurTexteMultiple, valeurBooleen, valeurDate }`.
- `saveFicheValues(transactionId, entries)` : `valeurChamp.deleteMany({ where: { transactionId } })` + `createMany({ data: entries.map((e) => ({ transactionId, ...e })) })`.
- `updateFicheStatut(transactionId, statut, dateStatut)` : `transaction.update({ where: { id: transactionId }, data: { statut, dateStatut } })`.
- DocumentActe CRUD : `transactionId` (au lieu de `transactionSourceId`).

- [ ] **Step 6: Update `fiche-layout.repository.ts`**

Aucun changement de modèle (reste sur `VueFicheEvaluation`) ; vérifier que `contenu.sections` accepte les ids de champs importés (aucune contrainte de nature). Si un filtre `nature === "SAISISSABLE"` y apparaît, le retirer.

- [ ] **Step 7: Update `fiche.serializer.ts`**

`SerializedFiche` expose `fields` + `statut` + `mode` (au lieu de `source`/`enrichment`) ; `serializeFiche` construit `fields` via `serializeTransaction(record).fields` et `mode` via `deriveFicheMode(record.statut)`.

- [ ] **Step 8: Run test to verify it passes**

Run: `cd app && npm test -- tests/server/transaction.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add app/src/serializers app/src/repositories/transaction.repository.ts app/src/repositories/fiche.repository.ts app/src/repositories/fiche-layout.repository.ts app/tests/server/transaction.test.ts
git commit -m "refactor(repo): repositories et sérialiseurs sur transaction/valeur_champ"
```

---

### Task 8: Repositories filtres / champs / enrichissement / actes

**Files:**
- Modify: `app/src/repositories/filters.repository.ts`, `app/src/repositories/champs.repository.ts`, `app/src/repositories/enrichment.repository.ts`, `app/src/repositories/actes.repository.ts`
- Test: `app/tests/server/filters.test.ts`

**Interfaces:**
- Produces: `findDistinctFieldValues(organisationId, codeMachine): Promise<string[]>` (fusion de `findDistinctEnrichmentValues` + `findDistinctSourceValues`) ; `findFiltersByOrganisation` inclut `champ` ; `CreateFilterRepositoryInput { champId }` ; `createChamp`/`updateChamp` gèrent `estLectureSeule` ; `listChampsByOrganisation` renvoie les trois natures ; `findTransactionByNumeroInscription(orgId, numeroInscription)`.
- Consumes: `IMPORTED_FIELD_BY_CODE` (Task 1).

- [ ] **Step 1: Write the failing test**

```ts
// tests/server/filters.test.ts  (remplacer le contenu existant)
import { describe, it, expect, beforeAll, afterAll } from "vitest"
import { prisma } from "@/lib/prisma"
import { findFiltersByOrganisation } from "@/repositories/filters.repository"
import { withRenteLots } from "@/repositories/transaction.repository"

describe("findFiltersByOrganisation", () => {
  let orgId: string
  beforeAll(async () => {
    const org = await prisma.organisation.create({ data: { nom: "Test Filters Org" } })
    orgId = org.id
    const mrcChamp = await prisma.champ.create({ data: { organisationId: orgId, codeMachine: "mrc", nomAffichage: "MRC", typeDonnees: "TEXTE", nature: "IMPORTE", estLectureSeule: true } })
    await prisma.filtreRecherche.create({ data: { organisationId: orgId, nomFiltre: "MRC", typeFiltre: "LISTE", champId: mrcChamp.id, ordreAffichage: 0 } })
    const t1 = await prisma.transaction.create({ data: { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", valeurs: { create: [{ champId: mrcChamp.id, valeurTexte: "Drummond" }] } } })
    await prisma.transaction.create({ data: { organisationId: orgId, systemeSource: "EXISTANT_EVAGRI", valeurs: { create: [{ champId: mrcChamp.id, valeurTexte: "Arthabaska" }] } } })
    void t1
  })
  afterAll(async () => {
    await prisma.filtreRecherche.deleteMany({ where: { organisationId: orgId } })
    await prisma.valeurChamp.deleteMany({ where: { transaction: { organisationId: orgId } } })
    await prisma.transaction.deleteMany({ where: { organisationId: orgId } })
    await prisma.champ.deleteMany({ where: { organisationId: orgId } })
    await prisma.organisation.delete({ where: { id: orgId } })
  })

  it("hydrates the filter's champ and its distinct values", async () => {
    const filters = await findFiltersByOrganisation(orgId)
    expect(filters).toHaveLength(1)
    expect(filters[0].champ?.codeMachine).toBe("mrc")
    expect(filters[0].optionsListe).toEqual(["Arthabaska", "Drummond"])
  })
})

describe("withRenteLots", () => {
  it("adds the duplicated-lot constraint on the multiple-value column, preserving existing AND", () => {
    const where = { organisationId: "org", AND: [{ statut: "ANALYSEE" }] }
    expect(withRenteLots(where as never, ["L1", "L2"])).toEqual({
      organisationId: "org",
      AND: [
        { statut: "ANALYSEE" },
        { valeurs: { some: { champ: { codeMachine: "lots_cadastraux" }, valeurTexteMultiple: { hasSome: ["L1", "L2"] } } } },
      ],
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npm test -- tests/server/filters.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update `filters.repository.ts`**

- Fusionner `findDistinctEnrichmentValues` et `findDistinctSourceValues` en :

```ts
export async function findDistinctFieldValues(organisationId: string, codeMachine: string): Promise<string[]> {
  const rows = await prisma.valeurChamp.findMany({
    where: { transaction: { organisationId }, champ: { codeMachine } },
    select: { valeurTexte: true, valeurTexteMultiple: true },
  })
  const values = new Set<string>()
  for (const r of rows) {
    if (r.valeurTexte) values.add(r.valeurTexte)
    for (const v of r.valeurTexteMultiple) values.add(v)
  }
  return Array.from(values).sort((a, b) => a.localeCompare(b, "fr"))
}
```

- `findFiltersByOrganisation` : `include: { champ: true }` ; hydrater `optionsListe` de façon paresseuse côté appelant (le test l'attend hydraté : lire les valeurs distinctes ici via `findDistinctFieldValues` quand `typeFiltre` est LISTE/MULTI_SELECT/NUMERO_LOT).
- `findFilterByChampEnrichissableId` → `findFilterByChampId(champId)`.
- `CreateFilterRepositoryInput` : `champId` (au lieu de `champEnrichissableId`) + `codeMachine` pour les virtuels.

- [ ] **Step 4: Update `champs.repository.ts`**

- `toConfig` : `estLectureSeule: row.estLectureSeule`, `typeFiltreRecommande: row.typeFiltreRecommande`.
- `listChampsByOrganisation` (ou `listChampsEnrichissablesByOrganisation`) : inclure toutes les natures ; renommer `findChampForOrganisation` reste identique.
- `createChampEnrichissable(orgId, input & { estLectureSeule })`, `updateChampEnrichissable`, `setChampActif` : `prisma.champ`.
- `findChampByOrganisationAndCode` : `prisma.champ`.

- [ ] **Step 5: Update `enrichment.repository.ts`**

- `ensureChampByCodeMachine` / `findChampByCodeMachine` : `prisma.champ`.
- `EnrichmentField` inchangé.
- `findEnrichmentFieldsByOrganisation` : ne renvoyer que `nature` `SAISISSABLE`/`CALCULE` (les champs importés ne sont pas des champs d'enrichissement à mapper depuis les colonnes non reconnues).

- [ ] **Step 6: Update `actes.repository.ts`**

- `findTransactionSourceByNumeroInscription` → `findTransactionByNumeroInscription` :

```ts
export async function findTransactionByNumeroInscription(organisationId: string, numeroInscription: string) {
  return prisma.transaction.findFirst({
    where: { organisationId, valeurs: { some: { champ: { codeMachine: "numero_inscription" }, valeurTexte: numeroInscription } } },
    orderBy: { createdAt: "desc" },
  })
}
```

- `findDocumentActeByFileName(transactionId, nomFichier)`, `createDocumentActe`, `updateDocumentActePath` : `prisma.documentActe` avec `transactionId`.

- [ ] **Step 7: Run test to verify it passes**

Run: `cd app && npm test -- tests/server/filters.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add app/src/repositories app/tests/server/filters.test.ts
git commit -m "refactor(repo): filtres/champs/enrichissement/actes sur le modèle unifié"
```

---

### Task 9: Service d'import + parseur + validators

**Files:**
- Modify: `app/src/types/import.ts`, `app/src/services/import.service.ts`, `app/src/parsers/excel.parser.ts`, `app/src/validators/filter.validator.ts`
- Test: `app/tests/services/import.test.ts`, `app/tests/lib/excel-parser.test.ts`, `app/tests/lib/filter-validator.test.ts`

**Interfaces:**
- Produces: `ParsedRow` à clés snake_case (`code_machine`) ; `SHEET_MAPPING`/`SOURCE_COLUMNS` remplacés par une résolution d'en-tête via `IMPORTED_FIELDS[].entetesImport` ; `parseFieldValue(champ, rawValue)` → `Omit<EnrichmentValueInput, "champId">` avec `valeurTexteMultiple`/`valeurDate` ; `SORTABLE_FIELDS` dérivé de `IMPORTED_FIELDS`.
- Consumes: `IMPORTED_FIELDS` (Task 1), `createImportedTransaction` (Task 7).

- [ ] **Step 1: Update types + tests**

`src/types/import.ts` :

```ts
export interface ParsedRow {
  numero_inscription?: string
  date_vente?: string
  vendeur?: string
  acheteur?: string
  lots_cadastraux?: string[]
  prix_vente?: number
  mrc?: string
  municipalite?: string
  adresse?: string
  superficie_totale_hectare?: number
  latitude?: number
  longitude?: number
}

export interface EnrichmentValueInput {
  champId: string
  valeurNombre?: Decimal | null
  valeurTexte?: string | null
  valeurTexteMultiple?: string[]
  valeurBooleen?: boolean | null
  valeurDate?: Date | null
}

export interface CreateImportedTransactionInput {
  organisationId: string
  importationId?: string
  systemeSource: string
  statut: string
  enrichmentValues: EnrichmentValueInput[]
  typologieValue?: { champId: string; valeurTexte: string } | null
}
```

Dans `tests/services/import.test.ts`, remplacer le test de `parseEnrichmentValue` par `parseFieldValue` produisant le quintuplet (dont `valeurTexteMultiple` pour `TEXTE_MULTIPLE`, `valeurDate` pour `DATE`). Dans `tests/lib/excel-parser.test.ts`, remplacer les attendus `rowToSourceFields` à clés camelCase par les clés snake_case (`numero_inscription`, `date_vente`, `lots_cadastraux`, …). Dans `tests/lib/filter-validator.test.ts`, remplacer `sortField: "prixVente"` par `"prix_vente"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- tests/services/import.test.ts tests/lib/excel-parser.test.ts tests/lib/filter-validator.test.ts`
Expected: FAIL.

- [ ] **Step 3: Update the parser**

Dans `excel.parser.ts`, `rowToSourceFields` mappe chaque en-tête reconnu vers le `code_machine` du champ importé correspondant, en résolvant via `IMPORTED_FIELDS[].entetesImport[systemeSource]` au lieu du dictionnaire `SOURCE_COLUMNS`. Renommer `SOURCE_COLUMNS` → `IMPORTED_HEADER_TO_CODE: Record<string, string>` construit depuis `IMPORTED_FIELDS`. `SOURCE_HEADER_SET`/`isSourceHeader` deviennent `IMPORTED_HEADER_SET`/`isImportedHeader`.

- [ ] **Step 4: Update the import service**

- Supprimer le `SOURCE_FIELDS` local ; itérer `IMPORTED_FIELDS`.
- `parseEnrichmentValue` → `parseFieldValue(champ, rawValue)` : selon `typeDonnees`, produire `valeurNombre`/`valeurTexte`/`valeurTexteMultiple`/`valeurBooleen`/`valeurDate`.
- `importSheet` : construire `enrichmentValues` avec `champId` (résolu par `code_machine` via `ensureChampByCodeMachine`/`findChampByCodeMachine` sur les champs importés amorcés) ; `statut` = `"NON_ANALYSEE"` ou `"ANALYSEE"` ; retirer la création à la volée des champs latitude/longitude (ils sont désormais `IMPORTE` amorcés) ; écrire `latitude`/`longitude` géocodées comme valeurs des champs importés.
- `resolveCoordinates` : inchangé dans son calcul, mais l'écriture des valeurs passe par le champ importé `latitude`/`longitude`.
- Déduplication : `findExistingTransaction` (Task 7).

- [ ] **Step 5: Update the validator**

`src/validators/filter.validator.ts` : `SORTABLE_FIELDS = IMPORTED_FIELDS.filter((f) => f.display.sortable).map((f) => f.code)`.

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd app && npm test -- tests/services/import.test.ts tests/lib/excel-parser.test.ts tests/lib/filter-validator.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/src/types/import.ts app/src/services app/src/parsers app/src/validators app/tests/services app/tests/lib/excel-parser.test.ts app/tests/lib/filter-validator.test.ts
git commit -m "refactor(import): mapper les en-têtes via les champs importés, statut enum"
```

---

### Task 10: Server actions

**Files:**
- Modify: `app/src/server/actions/champs.ts`, `app/src/server/actions/fiche.ts`, `app/src/server/actions/filters.ts`, `app/src/server/actions/actes.ts`, `app/src/server/actions/import.ts`, `app/src/server/actions/sections.ts`

**Interfaces:**
- Produces: actions alignées sur `champ`/`valeurChamp`/`transaction`, `champId`, statut enum ; `buildKnownFieldCodes` union `IMPORTED_FIELD_BY_CODE` + codes des `Champ` de l'org.
- Consumes: repositories (Tasks 7-8), `lib/fiche` (Task 5), `lib/filters` (Task 6).

- [ ] **Step 1: Update `champs.ts`**

- `buildKnownFieldCodes` : `new Set([...Object.keys(IMPORTED_FIELD_BY_CODE), ...listChampCodesByOrganisation(orgId)])` (au lieu de `SOURCE_FIELD_CODES`).
- Remplacer `deriveEstModifiable(nature)` par `deriveEstLectureSeule(nature)` (import depuis `lib/champs`).
- `champInputSchema` : `nature` enum 3 valeurs ; `estModifiable` retiré.
- `createChamp`/`updateChamp` : passer `estLectureSeule: deriveEstLectureSeule(nature)`.

- [ ] **Step 2: Update `fiche.ts`**

- `saveFiche` : `record = await findTransactionFiche(id)` ; construire `fields` = `serializeTransaction(record).fields` ; `validateFiche({ champs, sections, valeurs, fields, typeCode, dateVente })` ; `saveFicheValues(record.id, buildStorageEntries(champs, valeurs, typeCode))`.
- `setFicheStatut(id, statut)` : comparer `statut === "ANALYSEE"` ; `updateFicheStatut(record.id, statut, new Date())` ; recalculer les indicateurs via `withRecomputedIndicateurs(champs, fields)`.
- `uploadDocument`/`deleteDocument` : `transactionId`.

- [ ] **Step 3: Update `filters.ts`**

- `createFilterSchema` : `champId` (au lieu de `champEnrichissableId`) + `codeMachine` (virtuels).
- `createFilter` : `findChampForOrganisation(champId)` + `findFilterByChampId(champId)`.
- `listFilters` : renvoyer `champ` + `optionsListe` via `findDistinctFieldValues`.

- [ ] **Step 4: Update `actes.ts` et `import.ts`**

- `actes.ts` : `findTransactionByNumeroInscription(...)` ; retourner `transactionId`.
- `import.ts` : `importExcel`/`retryImport` : `parseWorkbook` → `rowToSourceFields` (snake_case) → `ensureEnrichmentChamps` → `importSheet`. Retourner `{ ok, error }` (jamais de throw, cf. mémoire).

- [ ] **Step 5: Update `sections.ts`**

- `getFicheLayout`/`saveFicheLayout` : inchangés (VueFicheEvaluation) ; vérifier que `sectionSchema.champs` accepte des ids de champs importés.

- [ ] **Step 6: Run typecheck ciblé**

Run: `cd app && npx tsc --noEmit 2>&1 | sed -n '1,40p'`
Expected: plus d'erreurs sur `src/server/actions` (les erreurs restantes, s'il en reste, sont dans `src/components`).

- [ ] **Step 7: Commit**

```bash
git add app/src/server/actions
git commit -m "refactor(actions): server actions sur le modèle unifié"
```

---

### Task 11: Composants

**Files:**
- Modify: `app/src/components/transaction-table.tsx`, `app/src/components/transactions-page-client.tsx`, `app/src/components/transaction-filters.tsx`, `app/src/components/filters-admin-form.tsx`, `app/src/components/champs-admin.tsx`, `app/src/components/champs-page-client.tsx`, `app/src/components/sections-editor.tsx`, `app/src/components/filter-icons.ts`
- Modify: `app/src/components/fiche/fiche-transaction.tsx`, `app/src/components/fiche/field-control.tsx`, `app/src/components/fiche/fiche-header.tsx`
- Delete: `app/src/components/fiche/source-data-panel.tsx`
- Modify: `app/src/app/(app)/transactions/page.tsx`, `app/src/app/(app)/transactions/[id]/page.tsx`
- Test: `app/tests/components/fiche-transaction.test.tsx`, `app/tests/components/field-control.test.tsx`, `app/tests/components/transaction-filters.test.tsx`

**Interfaces:**
- Produces: composants lisant `fields` (plus `source`/`enrichment`) ; colonnes construites depuis `IMPORTED_FIELDS.display` + champs `Champ` ; badge statut comparant `ANALYSEE`.
- Consumes: `IMPORTED_FIELDS` (Task 1), `SerializedTransaction` (Task 7).

- [ ] **Step 1: Update the fixtures/tests**

- `tests/components/fiche-transaction.test.tsx` : fixture `fiche` avec `fields` + `statut: "NON_ANALYSEE"` (plus d'`enrichment`/`enrichie`).
- `tests/components/field-control.test.tsx` : `estLectureSeule: false` (au lieu de `estModifiable: false`).
- `tests/components/transaction-filters.test.tsx` : filtres avec `champ` (au lieu de `champEnrichissable`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npm test -- tests/components/fiche-transaction.test.tsx tests/components/field-control.test.tsx tests/components/transaction-filters.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Update the fiche + table**

- `fiche-transaction.tsx` : `fiche.transaction.fields` remplace `source`/`enrichment` ; `withRecomputedIndicateurs(fiche.champs, fiche.transaction.fields)` ; `setFicheStatut(fiche.transaction.id, "ANALYSEE")`. Supprimer l'usage de `SourceDataPanel` (les champs importés s'affichent dans les sections, grisés si `estLectureSeule`).
- `field-control.tsx` : `readOnly = disabled || champ.estLectureSeule`.
- `fiche-header.tsx` : `statut === "ANALYSEE"`.
- `source-data-panel.tsx` : supprimé (fusionné dans les sections).
- `transaction-table.tsx` : `useTableColumns(importedFields, champs)` construit les colonnes depuis `IMPORTED_FIELDS.display` (clé = `code`) + les champs `Champ` non importés ; `computeTauxGlobal(row) = row.fields.prix_vente / row.fields.superficie_totale_hectare` (valeurs numériques de `fields`).
- `transactions-page-client.tsx` : props `importedFields` + `champs`.
- `app/(app)/transactions/page.tsx` : passer `importedFields={IMPORTED_FIELDS}`, `champs={listChampsByOrganisation(orgId)}`.
- `app/(app)/transactions/[id]/page.tsx` : `statut = record.statut` ; `FicheTransactionClient key={statut}`.

- [ ] **Step 4: Update the filters + admin**

- `transaction-filters.tsx` : `isVirtual = !!f.codeMachine && !f.champ` ; options de liste lues au niveau supérieur (`f.optionsListe`) ; `VIRTUAL_FILTER_OPTIONS.statut = ["Analysée", "Non analysée"]` (libellés) mappés vers `ANALYSEE`/`NON_ANALYSEE`.
- `filters-admin-form.tsx` : supprimer `__SOURCE_` ; champs de toute nature proviennent des `Champ` (`champId`) ; seul `__VIRTUAL_statut` subsiste avec `codeMachine`.
- `champs-admin.tsx` : `NATURE_LABELS = { IMPORTE: "Importé", SAISISSABLE: "Saisissable", CALCULE: "Calculé" }` ; les champs `IMPORTE` ne sont ni créables ni supprimables (éditables : libellé, affichage, lecture seule, section) ; `TYPE_DONNEES_LABELS` gagne `TEXTE_MULTIPLE`.
- `champs-page-client.tsx` : `saisissablesAffiches = champs.filter((c) => c.nature !== "CALCULE" && c.actif && c.estAffiche)` (inclut les importés).
- `sections-editor.tsx` : accepter les champs importés (plus de filtre `nature === "SAISISSABLE"`).
- `filter-icons.ts` : clés en `code_machine` uniquement (retirer les clés camelCase).

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npm test -- tests/components`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components app/src/app/\(app\)/transactions app/tests/components
git commit -m "refactor(ui): composants sur la carte fields et les champs unifiés"
```

---

### Task 12: Scripts, nettoyage et vérification globale

**Files:**
- Modify: `app/scripts/truncate-transactions.ts`, `app/scripts/reset-database.ts`, `app/scripts/reset-database.mjs`
- Delete: `app/src/lib/transaction-source-fields.ts`, `app/tests/lib/transaction-source-fields.test.ts`, `app/scripts/backfill-champ-types.ts`, `app/scripts/backfill-champ-units.ts`, `app/scripts/backfill-cptaq.ts`, `app/scripts/backfill-recommended-filter-types.ts`, `app/scripts/check-type.ts`

**Interfaces:**
- Produces: scripts ciblant `valeur_champ`/`transaction`/`champ` ; plus aucun consommateur de `SOURCE_FIELDS`/`TRANSACTION_SOURCE_FIELDS`.

- [ ] **Step 1: Update the scripts**

- `truncate-transactions.ts` : `valeurChamp.deleteMany({})`, `transaction.deleteMany({})`, `documentActe.deleteMany({})`, `importation.deleteMany({})` (retirer `transactionEnrichie`).
- `reset-database.ts`/`.mjs` : cibler les nouvelles tables ; `champ` au lieu de `champ_enrichissable`, `valeur_champ` au lieu de `valeur_enrichissement`.

- [ ] **Step 2: Delete the obsolete files**

```bash
git rm app/src/lib/transaction-source-fields.ts app/tests/lib/transaction-source-fields.test.ts \
  app/scripts/backfill-champ-types.ts app/scripts/backfill-champ-units.ts app/scripts/backfill-cptaq.ts \
  app/scripts/backfill-recommended-filter-types.ts app/scripts/check-type.ts
```

- [ ] **Step 3: Verify no consumer of the old catalogue remains**

Run: `cd app && rg -n "transaction-source-fields|SOURCE_FIELDS|TRANSACTION_SOURCE_FIELDS|isSourceFieldCode|sourceColumnOf" src tests scripts`
Expected: aucune sortie.

- [ ] **Step 4: Verify the old model names are gone**

Run: `cd app && rg -n "transactionSource|transactionEnrichie|valeurEnrichissement|champEnrichissable|estModifiable|\"Analysée\"|A analyser" src tests scripts prisma`
Expected: aucune sortie (hors libellés d'affichage « Analysée »/« Non analysée » dans les maps d'options de filtre, qui sont volontaires).

- [ ] **Step 5: Full verification**

Run: `cd app && npm run typecheck && npm run lint && npm test -- --run`
Expected: typecheck sans erreur, lint sans erreur, tous les tests PASS.

- [ ] **Step 6: Reseed the local DB and smoke-test the app**

Run: `cd app && npm run db:migrate && npm run dev`
Expected: migration + seed OK ; l'écran Transactions liste les colonnes importées, la fiche affiche les données de l'acte dans la zone principale. Arrêter le dev server.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: nettoyer les scripts et supprimer l'ancien catalogue source"
```

---

## Self-Review

**Spec coverage** (chaque section de la spec → tâche) :
- §6.4–6.8 (schéma Transaction/Champ/ValeurChamp, enums, FK renommées) → Task 3.
- §6.5 catalogue importé + en-têtes → Task 1, amorçage Task 3.
- §6.5 seed (champs importés, section par défaut) → Task 3.
- §7.1.3 doublons via ValeurChamp → Task 7 (`findExistingTransaction`), Task 9.
- §7.1.4 déduction mrc + géocodage sur champs importés → Task 9.
- §7.3.2 code_machine canonique → Global Constraints + Tasks 1, 4, 5, 6, 9.
- §7.5.3 TYPE_TRANSACTION → Tasks 5, 6, 10, 11.
- §7.8.3 validation sur champs modifiables → Task 5.
- Option 1 (carte plate `fields`) → Task 7 (sérialiseur), toutes les couches consommatrices.
- Reset + reseed → Task 3, Task 12.
- Tests listés §Tests → Tasks 1–12 (fichiers ciblés).

**Placeholder scan :** aucun TBD/TODO ; chaque étape de code a son bloc. Les étapes purement mécaniques (renommages) donnent la chaîne exacte avant→après.

**Type consistency :** `fields: Record<string, SerializedValue>` (Task 7) ↔ `buildNumericFields`/`withRecomputedIndicateurs` (Task 5) ↔ lectures composants (Task 11). `champId` (Tasks 5, 7, 8, 9) ↔ `StorageValueEntry.champId` (Task 7) ↔ `buildStorageEntries` (Task 5). `deriveEstLectureSeule` (Task 2) ↔ `estLectureSeule` schéma (Task 3) ↔ composants (Task 11). `findDistinctFieldValues` (Task 8) ↔ `optionsListe` (Task 6 test, Task 10). `findTransactionByNumeroInscription` (Task 8) ↔ `actes.ts` (Task 10). `IMPORTED_FIELD_BY_CODE` (Task 1) ↔ `buildKnownFieldCodes` (Task 10) ↔ `SORTABLE_FIELDS` (Task 9).

**Review Focus :** chaque ligne a son test propriétaire — (1) Task 7 `findExistingTransaction`/serializer + Task 11 `field-control` ; (2) Task 6 `NUMERO_LOT` ; (3) Task 6 `BOOLEEN` ; (4) Task 5 `deriveFicheMode` + Task 11 header/badge ; (5) Task 7 `findExistingTransaction` null-date + Task 9 import.
