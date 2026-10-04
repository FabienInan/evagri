# Fiche transaction (édition et consultation) — plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Livrer la fiche transaction `/transactions/[id]` (édition si `"A analyser"`, consultation si `"Analysée"`) qui respecte la disposition enregistrée dans l'admin des champs enrichissables, avec recalcul des indicateurs, validation bloquante, type de transaction et documents PDF.

**Architecture:** Toute la logique de composition/filtrage/validation vit dans des fonctions pures de `src/lib/fiche.ts` (testables sans React ni Prisma). Une page serveur charge les données via les repositories et les passe à un composant client qui détient l'état, recalcule les indicateurs et appelle des server actions qui renvoient `{ ok, error }`. Les composants de rendu sont réutilisables (un contrôle par `typeDonnees`, une carte de section partagée).

**Tech Stack:** Next.js 16 (App Router, `"use server"`), React 19, TypeScript strict, Tailwind 4, Prisma 6, Zod 4, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-22-fiche-transaction-design.md`

## Global Constraints

- **Exécuter les tests depuis `app/`** : `cd app && npx vitest run` (vitest 3.2.6, alias `@` → `./src`). Ne jamais lancer vitest depuis la racine du dépôt.
- **Les server actions ne lèvent jamais d'exception** : toute action renvoie `{ ok: true } | { ok: false; error: string }` (Next masque le message d'une action qui `throw` en production — cf. `src/server/actions/champs.ts`).
- **Langue** : libellés, messages d'erreur et commentaires en français ; identifiants de code en anglais.
- **Codes machine snake_case** (§7.3.2) pour les champs source et les règles de calcul ; les clés Prisma restent en camelCase (`numeroInscription`, `superficieTotaleHectare`).
- **Seuls les champs placés dans une section enregistrée** (`VueFicheEvaluation.contenu.sections`) s'affichent. Aucun repli « non classés ».
- **Aucun badge de provenance** sur la fiche (§7.5.2).
- **Indicateurs ajustés non affichés** (§7.5.1, §7.5.6) — ne jamais lire `IndicateursAjustes`.
- **Statuts** : exactement `"A analyser"` et `"Analysée"`.
- **Arrondi entier** des champs `CALCULE` au stockage (§7.5.4, §7.8.1).
- **Hors périmètre** : Précédent/Suivant, ajout au panier, contributeur, réouverture, import masse des PDF.
- **Ne pas modifier** `lib/validation.ts`, `lib/calculator.ts`, `lib/file-storage.ts` (déjà en place, réutilisés tels quels).
- **Vérification globale en fin de tâche** : `npm run typecheck`, `npm run lint`, et `npx vitest run` depuis `app/`.

---

## Structure des fichiers

| Fichier | Responsabilité |
|---|---|
| `app/src/lib/fiche.ts` | **Créer.** Logique pure : composition de la vue, applicabilité, calcul, valeurs, validation, formatage. |
| `app/src/serializers/fiche.serializer.ts` | **Créer.** Type `SerializedFiche` + `serializeDocument`. |
| `app/src/repositories/fiche.repository.ts` | **Créer.** Lecture/écriture fiche + documents. |
| `app/src/server/actions/fiche.ts` | **Créer.** Actions `saveFiche`, `setFicheStatut`, `uploadDocument`, `deleteDocument`. |
| `app/src/components/fiche/field-value.tsx` | **Créer.** Rendu lecture seule d'une valeur (par `typeDonnees`). |
| `app/src/components/fiche/field-control.tsx` | **Créer.** Contrôle éditable d'un champ (par `typeDonnees`). |
| `app/src/components/fiche/section-card.tsx` | **Créer.** Carte réutilisable titre + contenu. |
| `app/src/components/fiche/indicateurs-panel.tsx` | **Créer.** Zone latérale « Indicateurs ». |
| `app/src/components/fiche/source-data-panel.tsx` | **Créer.** Section « Données sources » (consultation). |
| `app/src/components/fiche/documents-panel.tsx` | **Créer.** Liste + upload + suppression PDF. |
| `app/src/components/fiche/fiche-header.tsx` | **Créer.** En-tête : identifiants, type de transaction, statut, actions. |
| `app/src/components/fiche/fiche-transaction.tsx` | **Créer.** Orchestrateur client. |
| `app/src/app/(app)/transactions/[id]/page.tsx` | **Créer.** Route serveur. |
| `app/src/components/transaction-table.tsx` | **Modifier.** Câbler les boutons Analyser/Voir vers la route. |
| `app/tests/lib/fiche.test.ts` | **Créer.** Tests des fonctions pures. |

---

### Task 1: `lib/fiche.ts` — composition de la vue

**Files:**
- Create: `app/src/lib/fiche.ts`
- Test: `app/tests/lib/fiche.test.ts`

**Interfaces:**
- Consumes: `ChampEnrichissableConfig`, `FicheSection`, `TypeDonneesChamp` (`@/types/champ`).
- Produces:
  - `type FicheMode = "edition" | "consultation"`
  - `type FicheValeur = string | number | boolean | null`
  - `const TYPE_TRANSACTION_CODE = "typeTransaction"`
  - `interface FicheChamp { config: ChampEnrichissableConfig; valeur: FicheValeur }`
  - `interface FicheSectionChamps { section: FicheSection; champs: FicheChamp[] }`
  - `interface FicheViewModel { mainSections: FicheSectionChamps[]; indicateurs: FicheChamp[] }`
  - `deriveFicheMode(statut: string | null | undefined): FicheMode`
  - `isChampApplicable(champ: { applicableATypes: string[] }, typeCode: string | null): boolean`
  - `buildFicheViewModel(input: { sections: FicheSection[]; champs: ChampEnrichissableConfig[]; valeurs: Record<string, FicheValeur>; typeCode: string | null }): FicheViewModel`
  - `formatFicheValue(typeDonnees: TypeDonneesChamp, valeur: FicheValeur): string`
  - `formatSourceFieldValue(field: { column: string; typeDonnees: TypeDonneesChamp; array?: boolean }, transaction: Record<string, unknown>): string`

- [ ] **Step 1: Write the failing test**

Create `app/tests/lib/fiche.test.ts`:

```ts
import { describe, it, expect } from "vitest"
import {
  TYPE_TRANSACTION_CODE,
  buildFicheViewModel,
  deriveFicheMode,
  formatFicheValue,
  formatSourceFieldValue,
  isChampApplicable,
} from "@/lib/fiche"
import type { ChampEnrichissableConfig } from "@/types/champ"

function champ(overrides: Partial<ChampEnrichissableConfig>): ChampEnrichissableConfig {
  return {
    id: "c1",
    codeMachine: "superficie_cultivee",
    nomAffichage: "Superficie cultivée",
    typeDonnees: "DECIMAL",
    nature: "SAISISSABLE",
    unite: "ha",
    plageMin: null,
    plageMax: null,
    optionsListe: null,
    regleCalcul: null,
    applicableATypes: [],
    ordreAffichage: 0,
    estAffiche: true,
    estObligatoire: false,
    estModifiable: true,
    actif: true,
    ...overrides,
  }
}

describe("deriveFicheMode", () => {
  it("is consultation when the transaction is analysed", () => {
    expect(deriveFicheMode("Analysée")).toBe("consultation")
  })
  it("is edition otherwise", () => {
    expect(deriveFicheMode("A analyser")).toBe("edition")
    expect(deriveFicheMode(null)).toBe("edition")
  })
})

describe("isChampApplicable", () => {
  it("applies when no type is configured", () => {
    expect(isChampApplicable({ applicableATypes: [] }, "CULTIVEE")).toBe(true)
  })
  it("applies when the type is unknown (no type selected yet)", () => {
    expect(isChampApplicable({ applicableATypes: ["BOISEE"] }, null)).toBe(true)
  })
  it("applies when the type matches", () => {
    expect(isChampApplicable({ applicableATypes: ["BOISEE"] }, "BOISEE")).toBe(true)
  })
  it("does not apply when the type differs", () => {
    expect(isChampApplicable({ applicableATypes: ["BOISEE"] }, "CULTIVEE")).toBe(false)
  })
})

describe("buildFicheViewModel", () => {
  it("renders only champs placed in a saved section", () => {
    const placed = champ({ id: "a", codeMachine: "a" })
    const orphan = champ({ id: "b", codeMachine: "b" })
    const vm = buildFicheViewModel({
      sections: [{ id: "s1", nom: "Un", ordre: 0, champs: ["a"] }],
      champs: [placed, orphan],
      valeurs: {},
      typeCode: null,
    })
    expect(vm.mainSections).toHaveLength(1)
    expect(vm.mainSections[0].champs.map((c) => c.config.id)).toEqual(["a"])
  })

  it("splits SAISISSABLE into sections and CALCULE into indicateurs", () => {
    const saisi = champ({ id: "a", codeMachine: "a" })
    const calcule = champ({ id: "k", codeMachine: "k", nature: "CALCULE", regleCalcul: "a * 1", estModifiable: false })
    const vm = buildFicheViewModel({
      sections: [{ id: "s1", nom: "Un", ordre: 0, champs: ["a", "k"] }],
      champs: [saisi, calcule],
      valeurs: {},
      typeCode: null,
    })
    expect(vm.mainSections[0].champs.map((c) => c.config.id)).toEqual(["a"])
    expect(vm.indicateurs.map((c) => c.config.id)).toEqual(["k"])
  })

  it("excludes a champ hidden by estAffiche or applicableATypes", () => {
    const hidden = champ({ id: "a", codeMachine: "a", estAffiche: false })
    const scoped = champ({ id: "b", codeMachine: "b", applicableATypes: ["BOISEE"] })
    const vm = buildFicheViewModel({
      sections: [{ id: "s1", nom: "Un", ordre: 0, champs: ["a", "b"] }],
      champs: [hidden, scoped],
      valeurs: {},
      typeCode: "CULTIVEE",
    })
    expect(vm.mainSections).toHaveLength(0)
  })

  it("omits a section emptied by filtering but keeps section order", () => {
    const x = champ({ id: "x", codeMachine: "x", applicableATypes: ["BOISEE"] })
    const y = champ({ id: "y", codeMachine: "y" })
    const vm = buildFicheViewModel({
      sections: [
        { id: "s2", nom: "Deux", ordre: 1, champs: ["x"] },
        { id: "s1", nom: "Un", ordre: 0, champs: ["y"] },
      ],
      champs: [x, y],
      valeurs: {},
      typeCode: "CULTIVEE",
    })
    expect(vm.mainSections.map((s) => s.section.id)).toEqual(["s1"])
  })

  it("keeps the type de transaction out of the main sections (rendered in the header)", () => {
    const type = champ({ id: "t", codeMachine: TYPE_TRANSACTION_CODE, typeDonnees: "LISTE" })
    const vm = buildFicheViewModel({
      sections: [{ id: "s1", nom: "Un", ordre: 0, champs: ["t"] }],
      champs: [type],
      valeurs: {},
      typeCode: null,
    })
    expect(vm.mainSections).toHaveLength(0)
  })
})

describe("formatFicheValue", () => {
  it("formats per type and shows an em dash for empty values", () => {
    expect(formatFicheValue("DECIMAL", 12.5)).toBe("12,5")
    expect(formatFicheValue("BOOLEAN", true)).toBe("Oui")
    expect(formatFicheValue("TEXTE", null)).toBe("—")
    expect(formatFicheValue("TEXTE", "")).toBe("—")
  })
})

describe("formatSourceFieldValue", () => {
  it("joins array columns and maps the column name", () => {
    expect(formatSourceFieldValue({ column: "lotsCadastraux", typeDonnees: "TEXTE", array: true }, { lotsCadastraux: ["1", "2"] })).toBe("1, 2")
    expect(formatSourceFieldValue({ column: "mrc", typeDonnees: "TEXTE" }, { mrc: "Drummond" })).toBe("Drummond")
    expect(formatSourceFieldValue({ column: "mrc", typeDonnees: "TEXTE" }, {})).toBe("—")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/fiche.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/fiche"`.

- [ ] **Step 3: Write minimal implementation**

Create `app/src/lib/fiche.ts`:

```ts
import type { ChampEnrichissableConfig, FicheSection, TypeDonneesChamp } from "@/types/champ"

export type FicheMode = "edition" | "consultation"
export type FicheValeur = string | number | boolean | null

/** codeMachine of the champ that carries the transaction type (§7.5.3). Rendered in the header, not in a section. */
export const TYPE_TRANSACTION_CODE = "typeTransaction"

export interface FicheChamp {
  config: ChampEnrichissableConfig
  valeur: FicheValeur
}

export interface FicheSectionChamps {
  section: FicheSection
  champs: FicheChamp[]
}

export interface FicheViewModel {
  mainSections: FicheSectionChamps[]
  indicateurs: FicheChamp[]
}

export function deriveFicheMode(statut: string | null | undefined): FicheMode {
  return statut === "Analysée" ? "consultation" : "edition"
}

/** An empty applicableATypes means the champ applies everywhere; an unset transaction type disables filtering
 *  so the user can still fill the form (including the mandatory type). */
export function isChampApplicable(champ: { applicableATypes: string[] }, typeCode: string | null): boolean {
  if (!champ.applicableATypes || champ.applicableATypes.length === 0) return true
  if (!typeCode) return true
  return champ.applicableATypes.includes(typeCode)
}

export function buildFicheViewModel(input: {
  sections: FicheSection[]
  champs: ChampEnrichissableConfig[]
  valeurs: Record<string, FicheValeur>
  typeCode: string | null
}): FicheViewModel {
  const byId = new Map(input.champs.map((c) => [c.id, c]))

  const mainSections: FicheSectionChamps[] = []
  for (const section of [...input.sections].sort((a, b) => a.ordre - b.ordre)) {
    const champs: FicheChamp[] = []
    for (const id of section.champs) {
      const config = byId.get(id)
      if (!config) continue
      if (config.nature !== "SAISISSABLE") continue
      if (config.codeMachine === TYPE_TRANSACTION_CODE) continue
      if (!config.actif || !config.estAffiche) continue
      if (!isChampApplicable(config, input.typeCode)) continue
      champs.push({ config, valeur: input.valeurs[config.codeMachine] ?? null })
    }
    if (champs.length > 0) mainSections.push({ section, champs })
  }

  const indicateurs: FicheChamp[] = input.champs
    .filter((c) => c.nature === "CALCULE" && c.actif && c.estAffiche && isChampApplicable(c, input.typeCode))
    .sort((a, b) => a.ordreAffichage - b.ordreAffichage)
    .map((config) => ({ config, valeur: input.valeurs[config.codeMachine] ?? null }))

  return { mainSections, indicateurs }
}

export function formatFicheValue(typeDonnees: TypeDonneesChamp, valeur: FicheValeur): string {
  if (valeur === null || valeur === undefined || valeur === "") return "—"
  switch (typeDonnees) {
    case "BOOLEAN":
      return valeur ? "Oui" : "Non"
    case "DATE":
      return new Date(String(valeur)).toLocaleDateString("fr-CA")
    case "DECIMAL":
      return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 2 }).format(Number(valeur))
    case "ENTIER":
      return new Intl.NumberFormat("fr-CA", { maximumFractionDigits: 0 }).format(Number(valeur))
    default:
      return String(valeur)
  }
}

export function formatSourceFieldValue(
  field: { column: string; typeDonnees: TypeDonneesChamp; array?: boolean },
  transaction: Record<string, unknown>
): string {
  const raw = transaction[field.column]
  if (field.array) {
    const list = Array.isArray(raw) ? raw : []
    return list.length > 0 ? list.join(", ") : "—"
  }
  if (raw === null || raw === undefined || raw === "") return "—"
  return formatFicheValue(field.typeDonnees, raw as FicheValeur)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/fiche.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/fiche.ts app/tests/lib/fiche.test.ts
git commit -m "feat(fiche): composition pure de la vue fiche transaction"
```

---

### Task 2: `lib/fiche.ts` — calcul, valeurs et type de transaction

**Files:**
- Modify: `app/src/lib/fiche.ts`
- Test: `app/tests/lib/fiche.test.ts`

**Interfaces:**
- Consumes: `SOURCE_FIELDS` (`@/lib/transaction-source-fields`), `evaluateRule`, `roundToInteger`, `CalculationContext` (`@/lib/calculator`), `TypologieOption` (`@/repositories/typologie.repository`).
- Produces:
  - `buildSourceNumbers(transaction: Record<string, unknown>): Record<string, number | null>`
  - `buildCalculationContext(transaction: Record<string, unknown>, enrichiValues: Record<string, number | null>): CalculationContext`
  - `toNumericValues(valeurs: Record<string, FicheValeur>): Record<string, number | null>`
  - `recomputeIndicateurs(champs: ChampEnrichissableConfig[], context: CalculationContext): Record<string, number | null>`
  - `toStorageValue(typeDonnees: TypeDonneesChamp, valeur: FicheValeur): { valeurNombre: number | null; valeurTexte: string | null; valeurBooleen: boolean | null }`
  - `resolveTypeTransaction(valeur: FicheValeur, typologies: TypologieOption[]): TypologieOption | null`

- [ ] **Step 1: Write the failing test**

Append to `app/tests/lib/fiche.test.ts` (add the new imports to the existing import block):

```ts
import {
  buildCalculationContext,
  buildSourceNumbers,
  recomputeIndicateurs,
  resolveTypeTransaction,
  toNumericValues,
  toStorageValue,
} from "@/lib/fiche"
```

```ts
describe("buildSourceNumbers", () => {
  it("maps source columns to their snake_case codes and ignores non-numeric columns", () => {
    const source = buildSourceNumbers({ prixVente: 120000, superficieTotaleHectare: 40, mrc: "Drummond" })
    expect(source.prix_vente).toBe(120000)
    expect(source.superficie_totale_hectare).toBe(40)
    expect(source.mrc).toBeNull()
  })
})

describe("buildCalculationContext and recomputeIndicateurs", () => {
  it("evaluates the rule and rounds the result to an integer", () => {
    const context = buildCalculationContext({ prixVente: 100000, superficieTotaleHectare: 30 }, {})
    const result = recomputeIndicateurs(
      [champ({ id: "k", codeMachine: "taux_global", nature: "CALCULE", regleCalcul: "prix_vente / superficie_totale_hectare" })],
      context
    )
    expect(result.taux_global).toBe(3333)
  })

  it("leaves the indicator null on a division by zero", () => {
    const context = buildCalculationContext({ prixVente: 1000, superficieTotaleHectare: 0 }, {})
    const result = recomputeIndicateurs(
      [champ({ id: "k", codeMachine: "taux_global", nature: "CALCULE", regleCalcul: "prix_vente / superficie_totale_hectare" })],
      context
    )
    expect(result.taux_global).toBeNull()
  })
})

describe("toNumericValues", () => {
  it("keeps numbers, parses numeric strings and drops the rest", () => {
    expect(toNumericValues({ a: 1, b: "2.5", c: "", d: null, e: "x" })).toEqual({ a: 1, b: 2.5 })
  })
})

describe("toStorageValue", () => {
  it("routes decimals to valeurNombre", () => {
    expect(toStorageValue("DECIMAL", 4.2)).toEqual({ valeurNombre: 4.2, valeurTexte: null, valeurBooleen: null })
  })
  it("routes booleans to valeurBooleen", () => {
    expect(toStorageValue("BOOLEAN", false)).toEqual({ valeurNombre: null, valeurTexte: null, valeurBooleen: false })
  })
  it("routes text and list to valeurTexte", () => {
    expect(toStorageValue("LISTE", "CULTIVEE")).toEqual({ valeurNombre: null, valeurTexte: "CULTIVEE", valeurBooleen: null })
  })
  it("returns all-null for an empty value", () => {
    expect(toStorageValue("TEXTE", "")).toEqual({ valeurNombre: null, valeurTexte: null, valeurBooleen: null })
    expect(toStorageValue("DECIMAL", null)).toEqual({ valeurNombre: null, valeurTexte: null, valeurBooleen: null })
  })
})

describe("resolveTypeTransaction", () => {
  const typologies = [{ id: "t1", code: "CULTIVEE", nom: "Cultivée", parentId: null }]
  it("resolves by code", () => {
    expect(resolveTypeTransaction("CULTIVEE", typologies)?.id).toBe("t1")
  })
  it("falls back to the display name (importer writes the name)", () => {
    expect(resolveTypeTransaction("Cultivée", typologies)?.id).toBe("t1")
  })
  it("returns null for an unknown value", () => {
    expect(resolveTypeTransaction("NOPE", typologies)).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/fiche.test.ts`
Expected: FAIL — `buildSourceNumbers is not a function` / export not found.

- [ ] **Step 3: Write minimal implementation**

Append to `app/src/lib/fiche.ts` (add the imports at the top):

```ts
import { SOURCE_FIELDS } from "@/lib/transaction-source-fields"
import { evaluateRule, roundToInteger, type CalculationContext } from "@/lib/calculator"
import type { TypologieOption } from "@/repositories/typologie.repository"
```

```ts
/** Only numeric source columns feed the calculation/validation context; text/date/array columns yield null. */
export function buildSourceNumbers(transaction: Record<string, unknown>): Record<string, number | null> {
  const source: Record<string, number | null> = {}
  for (const field of SOURCE_FIELDS) {
    if (field.array) continue
    const raw = transaction[field.column]
    source[field.code] = typeof raw === "number" ? raw : null
  }
  return source
}

export function buildCalculationContext(
  transaction: Record<string, unknown>,
  enrichiValues: Record<string, number | null>
): CalculationContext {
  return { source: buildSourceNumbers(transaction), enrichi: enrichiValues }
}

export function toNumericValues(valeurs: Record<string, FicheValeur>): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const [code, valeur] of Object.entries(valeurs)) {
    if (typeof valeur === "number") {
      result[code] = valeur
    } else if (typeof valeur === "string" && valeur.trim() !== "") {
      const n = Number(valeur)
      if (!Number.isNaN(n)) result[code] = n
    }
  }
  return result
}

export function recomputeIndicateurs(
  champs: ChampEnrichissableConfig[],
  context: CalculationContext
): Record<string, number | null> {
  const result: Record<string, number | null> = {}
  for (const champ of champs) {
    if (champ.nature !== "CALCULE" || !champ.regleCalcul) continue
    result[champ.codeMachine] = roundToInteger(evaluateRule(champ.regleCalcul, context))
  }
  return result
}

export function toStorageValue(
  typeDonnees: TypeDonneesChamp,
  valeur: FicheValeur
): { valeurNombre: number | null; valeurTexte: string | null; valeurBooleen: boolean | null } {
  const empty = { valeurNombre: null, valeurTexte: null, valeurBooleen: null }
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
    default:
      return { ...empty, valeurTexte: String(valeur) }
  }
}

/** Resolves the stored type value (canonical code, or a legacy display name written by the importer). */
export function resolveTypeTransaction(
  valeur: FicheValeur,
  typologies: TypologieOption[]
): TypologieOption | null {
  if (typeof valeur !== "string" || valeur === "") return null
  return typologies.find((t) => t.code === valeur) ?? typologies.find((t) => t.nom === valeur) ?? null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/fiche.test.ts`
Expected: PASS, 27 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/fiche.ts app/tests/lib/fiche.test.ts
git commit -m "feat(fiche): calcul des indicateurs, conversion des valeurs et résolution du type"
```

---

### Task 3: `lib/fiche.ts` — validation bloquante

**Files:**
- Modify: `app/src/lib/fiche.ts`
- Test: `app/tests/lib/fiche.test.ts`

**Interfaces:**
- Consumes: `validateEnrichment`, `validateSaleDate`, `RangeCheck` (`@/lib/validation`).
- Produces:
  - `interface FicheValidationError { code: string; message: string }`
  - `validateFiche(input: { champs: ChampEnrichissableConfig[]; valeurs: Record<string, FicheValeur>; source: Record<string, number | null>; typeCode: string | null; dateVente: string | null }): FicheValidationError[]`

- [ ] **Step 1: Write the failing test**

Append to `app/tests/lib/fiche.test.ts`:

```ts
import { validateFiche } from "@/lib/fiche"
```

```ts
describe("validateFiche", () => {
  const superficieTotale = champ({ id: "tot", codeMachine: "superficie_totale_hectare", unite: "ha" })
  const cultivee = champ({ id: "cult", codeMachine: "superficie_cultivee", unite: "ha" })
  const boisee = champ({ id: "bois", codeMachine: "superficie_boisee", unite: "ha" })
  const pourcent = champ({ id: "pct", codeMachine: "peuplement_feuillu", unite: "%" })

  const base = {
    champs: [superficieTotale, cultivee, boisee, pourcent],
    source: { superficie_totale_hectare: 40 },
    typeCode: "CULTIVEE" as string | null,
    dateVente: null as string | null,
  }

  it("passes a coherent fiche", () => {
    expect(validateFiche({ ...base, valeurs: { superficie_cultivee: 10, superficie_boisee: 20 } })).toEqual([])
  })

  it("blocks when the type is missing", () => {
    const errors = validateFiche({ ...base, typeCode: null, valeurs: {} })
    expect(errors.some((e) => e.message.includes("type de transaction"))).toBe(true)
  })

  it("blocks a mandatory field left empty", () => {
    const required = champ({ id: "r", codeMachine: "note", estObligatoire: true })
    const errors = validateFiche({ ...base, champs: [...base.champs, required], valeurs: {} })
    expect(errors.some((e) => e.code === "V-OBLIG")).toBe(true)
  })

  it("applies V-001 (components exceed the total)", () => {
    const errors = validateFiche({ ...base, valeurs: { superficie_cultivee: 30, superficie_boisee: 20 } })
    expect(errors.some((e) => e.code === "V-001")).toBe(true)
  })

  it("applies V-003 (percentage over 100)", () => {
    const errors = validateFiche({ ...base, valeurs: { peuplement_feuillu: 120 } })
    expect(errors.some((e) => e.code === "V-003")).toBe(true)
  })

  it("applies V-006 (negative value)", () => {
    const errors = validateFiche({ ...base, valeurs: { superficie_cultivee: -1 } })
    expect(errors.some((e) => e.code === "V-006")).toBe(true)
  })

  it("applies V-007 (out of the configured range)", () => {
    const ranged = champ({ id: "g", codeMachine: "pente", plageMin: 0, plageMax: 20 })
    const errors = validateFiche({ ...base, champs: [...base.champs, ranged], valeurs: { pente: 45 } })
    expect(errors.some((e) => e.code === "V-007")).toBe(true)
  })

  it("applies V-004 (future sale date)", () => {
    const future = new Date()
    future.setDate(future.getDate() + 5)
    const errors = validateFiche({ ...base, dateVente: future.toISOString(), valeurs: {} })
    expect(errors.some((e) => e.code === "V-004")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/fiche.test.ts`
Expected: FAIL — `validateFiche is not a function`.

- [ ] **Step 3: Write minimal implementation**

Append to `app/src/lib/fiche.ts` (add the import at the top):

```ts
import { validateEnrichment, validateSaleDate, type RangeCheck } from "@/lib/validation"
```

```ts
export interface FicheValidationError {
  code: string
  message: string
}

/** Enrichi codeMachine aliases for the superficie slots used by V-001/V-002/V-005. Accent-free variants cover
 *  the codes produced by the importer's buildCodeMachine (accents stripped). */
const SUPERFICIE_ALIASES = {
  superficieCultivee: ["superficie_cultivee"],
  superficieBoisee: ["superficie_boisee"],
  superficieConstructible: ["superficie_constructible"],
  superficieDrainee: ["superficie_drainee"],
  superficieAcericole: ["superficie_acericole", "superficie_acéricole"],
} as const

function pickNumber(valeurs: Record<string, FicheValeur>, aliases: readonly string[]): number | null {
  for (const code of aliases) {
    const v = valeurs[code]
    if (typeof v === "number") return v
    if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v)
      if (!Number.isNaN(n)) return n
    }
  }
  return null
}

/** Blocking rules (§7.8.3): V-001..V-007, mandatory sale type (§7.5.3) and est_obligatoire fields. */
export function validateFiche(input: {
  champs: ChampEnrichissableConfig[]
  valeurs: Record<string, FicheValeur>
  source: Record<string, number | null>
  typeCode: string | null
  dateVente: string | null
}): FicheValidationError[] {
  const errors: FicheValidationError[] = []

  if (!input.typeCode) {
    errors.push({ code: "V-TYPE", message: "Le type de transaction est obligatoire." })
  }

  for (const champ of input.champs) {
    if (champ.nature !== "SAISISSABLE" || !champ.estObligatoire) continue
    const v = input.valeurs[champ.codeMachine]
    if (v === null || v === undefined || v === "") {
      errors.push({ code: "V-OBLIG", message: `${champ.nomAffichage} est obligatoire.` })
    }
  }

  if (input.dateVente) {
    errors.push(...validateSaleDate(new Date(input.dateVente)))
  }

  const valeursNumeriques: Record<string, number | null> = {}
  const champsPourcentage: Record<string, number | null> = {}
  const plages: Record<string, RangeCheck> = {}

  for (const champ of input.champs) {
    if (champ.nature !== "SAISISSABLE") continue
    const value = pickNumber(input.valeurs, [champ.codeMachine])

    if (value !== null && champ.typeDonnees !== "TEXTE" && champ.typeDonnees !== "LISTE" && champ.typeDonnees !== "DATE" && champ.typeDonnees !== "BOOLEAN") {
      if (champ.codeMachine !== "longitude") valeursNumeriques[champ.codeMachine] = value
    }
    if (value !== null && champ.unite === "%") champsPourcentage[champ.codeMachine] = value
    if (champ.plageMin !== null || champ.plageMax !== null) {
      plages[champ.codeMachine] = { min: champ.plageMin, max: champ.plageMax, valeur: value }
    }
  }

  const surfaceErrors = validateEnrichment({
    superficieTotaleHectare: input.source["superficie_totale_hectare"] ?? null,
    superficieCultivee: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieCultivee),
    superficieBoisee: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieBoisee),
    superficieConstructible: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieConstructible),
    superficieDrainee: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieDrainee),
    superficieAcericole: pickNumber(input.valeurs, SUPERFICIE_ALIASES.superficieAcericole),
    champsPourcentage,
    valeursNumeriques,
    plages,
  })

  errors.push(...surfaceErrors)
  return errors
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/fiche.test.ts`
Expected: PASS, 35 tests.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/fiche.ts app/tests/lib/fiche.test.ts
git commit -m "feat(fiche): validation bloquante de la fiche"
```

---

### Task 4: `fiche.repository.ts` + `fiche.serializer.ts`

**Files:**
- Create: `app/src/repositories/fiche.repository.ts`
- Create: `app/src/serializers/fiche.serializer.ts`

**Interfaces:**
- Consumes: `prisma` (`@/lib/prisma`), `ChampEnrichissableConfig`, `FicheSection`, `TypologieOption`, `SerializedTransaction`, `FicheMode` (`@/lib/fiche`).
- Produces:
  - `ficheInclude` + `type FicheTransactionRecord`
  - `findTransactionFiche(organisationId: string, id: string): Promise<FicheTransactionRecord | null>`
  - `saveFicheValues(transactionEnrichieId: string, entries: StorageValueEntry[]): Promise<void>`
  - `updateFicheStatut(transactionEnrichieId: string, statut: string, dateStatut: Date | null): Promise<void>`
  - `listDocuments(transactionSourceId: string): Promise<DocumentRecord[]>`
  - `createDocument(data: { transactionSourceId: string; nomFichier: string; cheminStockage: string }): Promise<void>`
  - `deleteDocument(id: string): Promise<void>`
  - `interface StorageValueEntry { champEnrichissableId: string; valeurNombre: number | null; valeurTexte: string | null; valeurBooleen: boolean | null }`
  - `interface SerializedFicheDocument { id: string; nomFichier: string; dateUpload: string }`
  - `interface SerializedFiche { transaction: SerializedTransaction; champs: ChampEnrichissableConfig[]; sections: FicheSection[]; typologies: TypologieOption[]; documents: SerializedFicheDocument[]; statut: string; mode: FicheMode }`
  - `serializeDocument(doc: { id: string; nomFichier: string; dateUpload: Date }): SerializedFicheDocument`

- [ ] **Step 1: Write the repository**

Create `app/src/repositories/fiche.repository.ts`:

```ts
import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { TRANSACTION_INCLUDE } from "@/repositories/transaction.repository"

export { TRANSACTION_INCLUDE }

const ficheInclude = {
  enrichie: { include: { valeurs: { include: { champEnrichissable: true } } } },
} satisfies Prisma.TransactionSourceInclude

export type FicheTransactionRecord = Prisma.TransactionSourceGetPayload<{ include: typeof ficheInclude }>

export async function findTransactionFiche(
  organisationId: string,
  id: string
): Promise<FicheTransactionRecord | null> {
  return prisma.transactionSource.findFirst({
    where: { id, organisationId },
    include: ficheInclude,
  })
}

export interface StorageValueEntry {
  champEnrichissableId: string
  valeurNombre: number | null
  valeurTexte: string | null
  valeurBooleen: boolean | null
}

/** Replaces every value of the transaction in one shot: simpler than upserts and keeps the unique
 *  [transactionEnrichieId, champEnrichissableId] constraint trivially satisfied. */
export async function saveFicheValues(
  transactionEnrichieId: string,
  entries: StorageValueEntry[]
): Promise<void> {
  await prisma.$transaction([
    prisma.valeurEnrichissement.deleteMany({ where: { transactionEnrichieId } }),
    prisma.valeurEnrichissement.createMany({
      data: entries.map((e) => ({ transactionEnrichieId, ...e })),
    }),
  ])
}

export async function updateFicheStatut(
  transactionEnrichieId: string,
  statut: string,
  dateStatut: Date | null
): Promise<void> {
  await prisma.transactionEnrichie.update({
    where: { id: transactionEnrichieId },
    data: { statut, dateStatut },
  })
}

export interface DocumentRecord {
  id: string
  nomFichier: string
  dateUpload: Date
}

export async function listDocuments(transactionSourceId: string): Promise<DocumentRecord[]> {
  return prisma.documentActe.findMany({
    where: { transactionSourceId },
    orderBy: { dateUpload: "desc" },
    select: { id: true, nomFichier: true, dateUpload: true },
  })
}

export async function createDocument(data: {
  transactionSourceId: string
  nomFichier: string
  cheminStockage: string
}): Promise<void> {
  await prisma.documentActe.create({ data })
}

export async function deleteDocument(id: string): Promise<void> {
  await prisma.documentActe.delete({ where: { id } })
}
```

Note: `TRANSACTION_INCLUDE` is re-exported only because `ficheInclude` mirrors its inner shape; if the linter flags an unused re-export, remove the `export { TRANSACTION_INCLUDE }` line and the import.

- [ ] **Step 2: Write the serializer**

Create `app/src/serializers/fiche.serializer.ts`:

```ts
import type { ChampEnrichissableConfig, FicheSection } from "@/types/champ"
import type { TypologieOption } from "@/repositories/typologie.repository"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"
import type { FicheMode } from "@/lib/fiche"

export interface SerializedFicheDocument {
  id: string
  nomFichier: string
  dateUpload: string
}

export interface SerializedFiche {
  transaction: SerializedTransaction
  champs: ChampEnrichissableConfig[]
  sections: FicheSection[]
  typologies: TypologieOption[]
  documents: SerializedFicheDocument[]
  statut: string
  mode: FicheMode
}

export function serializeDocument(doc: {
  id: string
  nomFichier: string
  dateUpload: Date
}): SerializedFicheDocument {
  return {
    id: doc.id,
    nomFichier: doc.nomFichier,
    dateUpload: doc.dateUpload.toISOString(),
  }
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd app && npm run typecheck`
Expected: PASS, no errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/repositories/fiche.repository.ts app/src/serializers/fiche.serializer.ts
git commit -m "feat(fiche): repository et sérialiseur de la fiche"
```

---

### Task 5: `server/actions/fiche.ts`

**Files:**
- Create: `app/src/server/actions/fiche.ts`
- Modify: `app/src/lib/fiche.ts` (add the `typeTransaction` storage helper described below)

**Interfaces:**
- Consumes: `getCurrentOrganisationId`, `findTransactionFiche`/`saveFicheValues`/`updateFicheStatut`/`createDocument`/`deleteDocument`, `listChampsEnrichissablesByOrganisation` (`@/repositories/champs.repository`), `listTypologiesByOrganisation`, `serializeTransaction`, `toStorageValue`/`validateFiche`/`buildSourceNumbers`/`TYPE_TRANSACTION_CODE`, `saveActePDF` (`@/lib/file-storage`).
- Produces:
  - `type FicheActionResult = { ok: true } | { ok: false; error: string }`
  - `saveFiche(input: { id: string; typeTransactionCode: string | null; valeurs: Record<string, string | number | boolean | null> }): Promise<FicheActionResult>`
  - `setFicheStatut(id: string, statut: string): Promise<FicheActionResult>`
  - `uploadDocument(transactionSourceId: string, formData: FormData): Promise<FicheActionResult>`
  - `deleteDocument(documentId: string): Promise<FicheActionResult>`

- [ ] **Step 1: Add a pure helper to `lib/fiche.ts` for the type value**

Modify `app/src/lib/fiche.ts` — append:

```ts
/** Entries persisted for a save: enrichment champs plus the header's type de transaction. */
export function buildStorageEntries(
  champs: ChampEnrichissableConfig[],
  valeurs: Record<string, FicheValeur>,
  typeTransactionCode: string | null
): { champEnrichissableId: string; valeurNombre: number | null; valeurTexte: string | null; valeurBooleen: boolean | null }[] {
  const entries: { champEnrichissableId: string; valeurNombre: number | null; valeurTexte: string | null; valeurBooleen: boolean | null }[] = []

  for (const champ of champs) {
    if (champ.codeMachine === TYPE_TRANSACTION_CODE) continue
    const raw = valeurs[champ.codeMachine]
    if (raw === undefined) continue
    const stored = toStorageValue(champ.typeDonnees, raw)
    if (stored.valeurNombre === null && stored.valeurTexte === null && stored.valeurBooleen === null) continue
    entries.push({ champEnrichissableId: champ.id, ...stored })
  }

  if (typeTransactionCode) {
    const typeChamp = champs.find((c) => c.codeMachine === TYPE_TRANSACTION_CODE)
    if (typeChamp) {
      entries.push({
        champEnrichissableId: typeChamp.id,
        valeurNombre: null,
        valeurTexte: typeTransactionCode,
        valeurBooleen: null,
      })
    }
  }

  return entries
}
```

Add a test for it in `app/tests/lib/fiche.test.ts`:

```ts
import { buildStorageEntries } from "@/lib/fiche"

describe("buildStorageEntries", () => {
  it("persists filled champs and the type de transaction, dropping empty ones", () => {
    const a = champ({ id: "a", codeMachine: "a", typeDonnees: "DECIMAL" })
    const t = champ({ id: "t", codeMachine: TYPE_TRANSACTION_CODE, typeDonnees: "LISTE" })
    const entries = buildStorageEntries([a, t], { a: 5, b: null }, "CULTIVEE")
    expect(entries).toEqual([
      { champEnrichissableId: "a", valeurNombre: 5, valeurTexte: null, valeurBooleen: null },
      { champEnrichissableId: "t", valeurNombre: null, valeurTexte: "CULTIVEE", valeurBooleen: null },
    ])
  })
})
```

Run: `cd app && npx vitest run tests/lib/fiche.test.ts` → Expected: PASS, 36 tests.

- [ ] **Step 2: Write the actions**

Create `app/src/server/actions/fiche.ts`:

```ts
"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import {
  createDocument,
  deleteDocument as deleteDocumentRepo,
  findTransactionFiche,
  saveFicheValues,
  updateFicheStatut,
} from "@/repositories/fiche.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { buildSourceNumbers, buildStorageEntries, validateFiche } from "@/lib/fiche"
import { saveActePDF } from "@/lib/file-storage"

export type FicheActionResult = { ok: true } | { ok: false; error: string }

const valeurSchema = z.union([z.string(), z.number(), z.boolean(), z.null()])

const saveFicheSchema = z.object({
  id: z.string().min(1),
  typeTransactionCode: z.string().nullable(),
  valeurs: z.record(z.string(), valeurSchema),
})

export async function saveFiche(input: unknown): Promise<FicheActionResult> {
  const organisationId = getCurrentOrganisationId()
  const parsed = saveFicheSchema.safeParse(input)
  if (!parsed.success) return { ok: false, error: "Données invalides." }

  const record = await findTransactionFiche(organisationId, parsed.data.id)
  if (!record || !record.enrichie) return { ok: false, error: "Transaction introuvable." }

  const champs = await listChampsEnrichissablesByOrganisation(organisationId)
  const transaction = serializeTransaction(record)
  const valeurs = parsed.data.valeurs

  const errors = validateFiche({
    champs,
    valeurs,
    source: buildSourceNumbers(transaction),
    typeCode: parsed.data.typeTransactionCode,
    dateVente: transaction.dateVente,
  })
  if (errors.length > 0) return { ok: false, error: errors[0].message }

  await saveFicheValues(
    record.enrichie.id,
    buildStorageEntries(champs, valeurs, parsed.data.typeTransactionCode)
  )

  revalidatePath(`/transactions/${record.id}`)
  revalidatePath("/transactions")
  return { ok: true }
}

export async function setFicheStatut(id: string, statut: string): Promise<FicheActionResult> {
  const organisationId = getCurrentOrganisationId()
  const record = await findTransactionFiche(organisationId, id)
  if (!record || !record.enrichie) return { ok: false, error: "Transaction introuvable." }

  if (statut === "Analysée") {
    const champs = await listChampsEnrichissablesByOrganisation(organisationId)
    const transaction = serializeTransaction(record)
    const valeurs = transaction.enrichment
    const typeChamp = champs.find((c) => c.codeMachine === "typeTransaction")
    const storedType = typeChamp ? valeurs[typeChamp.codeMachine] : null

    const errors = validateFiche({
      champs,
      valeurs,
      source: buildSourceNumbers(transaction),
      typeCode: typeof storedType === "string" ? storedType : null,
      dateVente: transaction.dateVente,
    })
    if (errors.length > 0) return { ok: false, error: errors[0].message }
  }

  await updateFicheStatut(record.enrichie.id, statut, statut === "Analysée" ? new Date() : record.enrichie.dateStatut ?? null)

  revalidatePath(`/transactions/${id}`)
  revalidatePath("/transactions")
  return { ok: true }
}

export async function uploadDocument(
  transactionSourceId: string,
  formData: FormData
): Promise<FicheActionResult> {
  const organisationId = getCurrentOrganisationId()
  const file = formData.get("file")
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Aucun fichier sélectionné." }
  }
  if (file.type !== "application/pdf") {
    return { ok: false, error: "Seuls les fichiers PDF sont acceptés." }
  }

  const stored = await saveActePDF(file, organisationId, transactionSourceId)
  await createDocument({
    transactionSourceId,
    nomFichier: stored.nomFichier,
    cheminStockage: stored.cheminStockage,
  })

  revalidatePath(`/transactions/${transactionSourceId}`)
  return { ok: true }
}

export async function deleteDocument(documentId: string): Promise<FicheActionResult> {
  await deleteDocumentRepo(documentId)
  revalidatePath("/transactions")
  return { ok: true }
}
```

- [ ] **Step 3: Verify types and lint**

Run: `cd app && npm run typecheck && npm run lint`
Expected: PASS. `record.enrichie.dateStatut` exists because the include returns all `TransactionEnrichie` scalar fields.

- [ ] **Step 4: Commit**

```bash
git add app/src/server/actions/fiche.ts app/src/lib/fiche.ts app/tests/lib/fiche.test.ts
git commit -m "feat(fiche): server actions de sauvegarde, statut et documents"
```

---

### Task 6: Composants de champ réutilisables

**Files:**
- Create: `app/src/components/fiche/field-value.tsx`
- Create: `app/src/components/fiche/field-control.tsx`

**Interfaces:**
- Consumes: `formatFicheValue`, `FicheValeur` (`@/lib/fiche`), `ChampEnrichissableConfig`, `TypeDonneesChamp` (`@/types/champ`), `Input`, `Label`, `Switch`, `Select*`.
- Produces:
  - `FieldValue({ typeDonnees, valeur }: { typeDonnees: TypeDonneesChamp; valeur: FicheValeur })`
  - `FieldControl({ champ, valeur, onChange, onBlur, disabled }: { champ: ChampEnrichissableConfig; valeur: FicheValeur; onChange: (valeur: FicheValeur) => void; onBlur?: () => void; disabled?: boolean })`

- [ ] **Step 1: Write `field-value.tsx`**

Create `app/src/components/fiche/field-value.tsx`:

```tsx
"use client"

import { formatFicheValue, type FicheValeur } from "@/lib/fiche"
import type { TypeDonneesChamp } from "@/types/champ"

export function FieldValue({
  typeDonnees,
  valeur,
}: {
  typeDonnees: TypeDonneesChamp
  valeur: FicheValeur
}) {
  return <span className="text-sm text-foreground">{formatFicheValue(typeDonnees, valeur)}</span>
}
```

- [ ] **Step 2: Write `field-control.tsx`**

Create `app/src/components/fiche/field-control.tsx`:

```tsx
"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { FicheValeur } from "@/lib/fiche"
import type { ChampEnrichissableConfig } from "@/types/champ"

function toInputValue(valeur: FicheValeur): string {
  if (valeur === null || valeur === undefined) return ""
  return String(valeur)
}

export function FieldControl({
  champ,
  valeur,
  onChange,
  onBlur,
  disabled,
}: {
  champ: ChampEnrichissableConfig
  valeur: FicheValeur
  onChange: (valeur: FicheValeur) => void
  onBlur?: () => void
  disabled?: boolean
}) {
  const readOnly = disabled || !champ.estModifiable
  const label = `${champ.nomAffichage}${champ.estObligatoire ? " *" : ""}${champ.unite !== "N/A" ? ` (${champ.unite})` : ""}`

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>

      {champ.typeDonnees === "BOOLEAN" ? (
        <div className="h-10 flex items-center">
          <Switch
            checked={Boolean(valeur)}
            disabled={readOnly}
            onCheckedChange={(checked) => {
              onChange(checked)
              onBlur?.()
            }}
          />
        </div>
      ) : champ.typeDonnees === "LISTE" ? (
        <Select
          value={toInputValue(valeur)}
          disabled={readOnly}
          onValueChange={(v) => {
            onChange(v)
            onBlur?.()
          }}
        >
          <SelectTrigger className="h-10 w-full rounded-lg">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent>
            {(champ.optionsListe ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : champ.typeDonnees === "DATE" ? (
        <Input
          type="date"
          className="h-10"
          value={toInputValue(valeur)}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          onBlur={onBlur}
        />
      ) : (
        <Input
          type={champ.typeDonnees === "DECIMAL" || champ.typeDonnees === "ENTIER" ? "number" : "text"}
          step={champ.typeDonnees === "DECIMAL" ? "any" : undefined}
          className="h-10"
          value={toInputValue(valeur)}
          disabled={readOnly}
          onChange={(e) => {
            if (e.target.value === "") {
              onChange(null)
            } else if (champ.typeDonnees === "DECIMAL" || champ.typeDonnees === "ENTIER") {
              const n = Number(e.target.value)
              onChange(Number.isNaN(n) ? null : n)
            } else {
              onChange(e.target.value)
            }
          }}
          onBlur={onBlur}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify types and lint**

Run: `cd app && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/fiche/field-value.tsx app/src/components/fiche/field-control.tsx
git commit -m "feat(fiche): composants de champ réutilisables (valeur et contrôle)"
```

---

### Task 7: Composants de panneau

**Files:**
- Create: `app/src/components/fiche/section-card.tsx`
- Create: `app/src/components/fiche/indicateurs-panel.tsx`
- Create: `app/src/components/fiche/source-data-panel.tsx`
- Create: `app/src/components/fiche/documents-panel.tsx`

**Interfaces:**
- Consumes: `Card*`, `Button`, `FieldValue`, `SectionCard`, `formatSourceFieldValue`, `FicheChamp` (`@/lib/fiche`), `SOURCE_FIELDS` (`@/lib/transaction-source-fields`), `uploadDocument`/`deleteDocument` (`@/server/actions/fiche`), `SerializedTransaction`, `SerializedFicheDocument`.
- Produces:
  - `SectionCard({ title, children }: { title: string; children: React.ReactNode })`
  - `IndicateursPanel({ indicateurs }: { indicateurs: FicheChamp[] })`
  - `SourceDataPanel({ transaction }: { transaction: SerializedTransaction })`
  - `DocumentsPanel({ transactionSourceId, documents, readOnly }: { transactionSourceId: string; documents: SerializedFicheDocument[]; readOnly: boolean })`

- [ ] **Step 1: Write `section-card.tsx`**

Create `app/src/components/fiche/section-card.tsx`:

```tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Write `indicateurs-panel.tsx`**

Create `app/src/components/fiche/indicateurs-panel.tsx`:

```tsx
"use client"

import { SectionCard } from "@/components/fiche/section-card"
import { FieldValue } from "@/components/fiche/field-value"
import type { FicheChamp } from "@/lib/fiche"

export function IndicateursPanel({ indicateurs }: { indicateurs: FicheChamp[] }) {
  return (
    <SectionCard title="Indicateurs">
      {indicateurs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun indicateur.</p>
      ) : (
        <dl className="space-y-2">
          {indicateurs.map(({ config, valeur }) => (
            <div key={config.id} className="flex items-center justify-between gap-3">
              <dt className="text-sm text-muted-foreground">
                {config.nomAffichage}
                {config.unite !== "N/A" ? ` (${config.unite})` : ""}
              </dt>
              <dd>
                <FieldValue typeDonnees={config.typeDonnees} valeur={valeur} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </SectionCard>
  )
}
```

- [ ] **Step 3: Write `source-data-panel.tsx`**

Create `app/src/components/fiche/source-data-panel.tsx`:

```tsx
"use client"

import { SectionCard } from "@/components/fiche/section-card"
import { formatSourceFieldValue } from "@/lib/fiche"
import { SOURCE_FIELDS } from "@/lib/transaction-source-fields"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"

export function SourceDataPanel({ transaction }: { transaction: SerializedTransaction }) {
  return (
    <SectionCard title="Données sources">
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SOURCE_FIELDS.map((field) => (
          <div key={field.code}>
            <dt className="text-xs text-muted-foreground">{field.label}</dt>
            <dd className="text-sm text-foreground">
              {formatSourceFieldValue(field, transaction as unknown as Record<string, unknown>)}
            </dd>
          </div>
        ))}
      </dl>
    </SectionCard>
  )
}
```

- [ ] **Step 4: Write `documents-panel.tsx`**

Create `app/src/components/fiche/documents-panel.tsx`:

```tsx
"use client"

import { useRef, useState, useTransition } from "react"
import { FileText, Trash2, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SectionCard } from "@/components/fiche/section-card"
import { deleteDocument, uploadDocument } from "@/server/actions/fiche"
import type { SerializedFicheDocument } from "@/serializers/fiche.serializer"

export function DocumentsPanel({
  transactionSourceId,
  documents,
  readOnly,
}: {
  transactionSourceId: string
  documents: SerializedFicheDocument[]
  readOnly: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleUpload(file: File) {
    setError(null)
    const formData = new FormData()
    formData.append("file", file)
    startTransition(async () => {
      const res = await uploadDocument(transactionSourceId, formData)
      if (!res.ok) setError(res.error)
    })
  }

  function handleDelete(documentId: string) {
    setError(null)
    startTransition(async () => {
      const res = await deleteDocument(documentId)
      if (!res.ok) setError(res.error)
    })
  }

  return (
    <SectionCard title="Documents">
      <div className="space-y-3">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun document.</p>
        ) : (
          <ul className="space-y-1">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-sm text-foreground">
                  <FileText className="h-4 w-4" />
                  {doc.nomFichier}
                </span>
                {!readOnly && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    title="Supprimer"
                    disabled={pending}
                    onClick={() => handleDelete(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleUpload(file)
                e.target.value = ""
              }}
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-2 w-fit"
              disabled={pending}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" />
              Ajouter un PDF
            </Button>
          </>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    </SectionCard>
  )
}
```

- [ ] **Step 5: Verify types and lint**

Run: `cd app && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/fiche/section-card.tsx app/src/components/fiche/indicateurs-panel.tsx app/src/components/fiche/source-data-panel.tsx app/src/components/fiche/documents-panel.tsx
git commit -m "feat(fiche): panneaux section, indicateurs, sources et documents"
```

---

### Task 8: En-tête, orchestrateur et route

**Files:**
- Create: `app/src/components/fiche/fiche-header.tsx`
- Create: `app/src/components/fiche/fiche-transaction.tsx`
- Create: `app/src/app/(app)/transactions/[id]/page.tsx`

**Interfaces:**
- Consumes: `SerializedFiche`, `SectionCard`, `FieldControl`, `IndicateursPanel`, `SourceDataPanel`, `DocumentsPanel`, `buildFicheViewModel`/`deriveFicheMode`/`resolveTypeTransaction`/`buildCalculationContext`/`recomputeIndicateurs`/`toNumericValues`/`TYPE_TRANSACTION_CODE`/`FicheValeur` (`@/lib/fiche`), `saveFiche`/`setFicheStatut` (`@/server/actions/fiche`), `findTransactionFiche`/`listDocuments` (`@/repositories/fiche.repository`), `listChampsEnrichissablesByOrganisation`, `findFicheLayout`, `listTypologiesByOrganisation`, `serializeTransaction`, `serializeDocument`, `getCurrentOrganisationId`, `notFound`.
- Produces:
  - `FicheHeader({ transaction, mode, typologies, typeCode, statut, saving, error, onTypeChange, onSave, onAnalyse }: {...})`
  - `FicheTransactionClient({ fiche }: { fiche: SerializedFiche })`
  - Default export route `FicheTransactionPage`.

- [ ] **Step 1: Write `fiche-header.tsx`**

Create `app/src/components/fiche/fiche-header.tsx`:

```tsx
"use client"

import { Check, Save } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { SerializedTransaction } from "@/serializers/transaction.serializer"
import type { TypologieOption } from "@/repositories/typologie.repository"
import type { FicheMode } from "@/lib/fiche"

export function FicheHeader({
  transaction,
  mode,
  typologies,
  typeCode,
  statut,
  saving,
  error,
  onTypeChange,
  onSave,
  onAnalyse,
}: {
  transaction: SerializedTransaction
  mode: FicheMode
  typologies: TypologieOption[]
  typeCode: string | null
  statut: string
  saving: boolean
  error: string | null
  onTypeChange: (code: string | null) => void
  onSave: () => void
  onAnalyse: () => void
}) {
  const isEdition = mode === "edition"

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <p className="text-xs text-muted-foreground">N° d&apos;inscription</p>
            <p className="text-sm font-medium text-foreground">{transaction.numeroInscription ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">N° de lot</p>
            <p className="text-sm font-medium text-foreground">
              {transaction.lotsCadastraux.length > 0 ? transaction.lotsCadastraux.join(", ") : "—"}
            </p>
          </div>
          <Badge variant={statut === "Analysée" ? "default" : "warning"}>{statut}</Badge>
        </div>

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
      </div>

      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-foreground">Type de transaction *</span>
        <Select
          value={typeCode ?? ""}
          disabled={!isEdition}
          onValueChange={(v) => onTypeChange(v || null)}
        >
          <SelectTrigger className="h-9 w-64 rounded-lg">
            <SelectValue placeholder="Sélectionner..." />
          </SelectTrigger>
          <SelectContent>
            {typologies.map((t) => (
              <SelectItem key={t.id} value={t.code}>
                {t.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
```

- [ ] **Step 2: Write `fiche-transaction.tsx`**

Create `app/src/components/fiche/fiche-transaction.tsx`:

```tsx
"use client"

import { useState } from "react"
import { FicheHeader } from "@/components/fiche/fiche-header"
import { SectionCard } from "@/components/fiche/section-card"
import { FieldControl } from "@/components/fiche/field-control"
import { IndicateursPanel } from "@/components/fiche/indicateurs-panel"
import { SourceDataPanel } from "@/components/fiche/source-data-panel"
import { DocumentsPanel } from "@/components/fiche/documents-panel"
import { saveFiche, setFicheStatut } from "@/server/actions/fiche"
import {
  TYPE_TRANSACTION_CODE,
  buildCalculationContext,
  buildFicheViewModel,
  resolveTypeTransaction,
  recomputeIndicateurs,
  toNumericValues,
  type FicheValeur,
} from "@/lib/fiche"
import type { SerializedFiche } from "@/serializers/fiche.serializer"

export function FicheTransactionClient({ fiche }: { fiche: SerializedFiche }) {
  const mode = fiche.mode
  const isEdition = mode === "edition"

  const [valeurs, setValeurs] = useState<Record<string, FicheValeur>>(() => ({
    ...fiche.transaction.enrichment,
  }))
  const [typeCode, setTypeCode] = useState<string | null>(() => {
    const current = resolveTypeTransaction(fiche.transaction.enrichment[TYPE_TRANSACTION_CODE], fiche.typologies)
    return current?.code ?? null
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const viewModel = buildFicheViewModel({
    sections: fiche.sections,
    champs: fiche.champs,
    valeurs,
    typeCode,
  })

  function recompute(nextValeurs: Record<string, FicheValeur>) {
    const context = buildCalculationContext(
      fiche.transaction as unknown as Record<string, unknown>,
      toNumericValues(nextValeurs)
    )
    return { ...nextValeurs, ...recomputeIndicateurs(fiche.champs, context) }
  }

  function handleFieldChange(codeMachine: string, valeur: FicheValeur) {
    setValeurs((prev) => ({ ...prev, [codeMachine]: valeur }))
  }

  function handleFieldBlur() {
    setValeurs((prev) => recompute(prev))
  }

  async function persist(): Promise<boolean> {
    setSaving(true)
    setError(null)
    const res = await saveFiche({ id: fiche.transaction.id, typeTransactionCode: typeCode, valeurs })
    setSaving(false)
    if (!res.ok) {
      setError(res.error)
      return false
    }
    return true
  }

  async function handleSave() {
    await persist()
  }

  async function handleAnalyse() {
    const saved = await persist()
    if (!saved) return
    setSaving(true)
    const res = await setFicheStatut(fiche.transaction.id, "Analysée")
    setSaving(false)
    if (!res.ok) setError(res.error)
  }

  return (
    <div className="space-y-4">
      <FicheHeader
        transaction={fiche.transaction}
        mode={mode}
        typologies={fiche.typologies}
        typeCode={typeCode}
        statut={fiche.statut}
        saving={saving}
        error={error}
        onTypeChange={setTypeCode}
        onSave={handleSave}
        onAnalyse={handleAnalyse}
      />

      {mode === "consultation" && <SourceDataPanel transaction={fiche.transaction} />}

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {viewModel.mainSections.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aucune section configurée. Configurez la disposition dans Admin → Champs enrichissables.
            </p>
          ) : (
            viewModel.mainSections.map(({ section, champs }) => (
              <SectionCard key={section.id} title={section.nom}>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {champs.map(({ config, valeur }) =>
                    isEdition ? (
                      <FieldControl
                        key={config.id}
                        champ={config}
                        valeur={valeur}
                        onChange={(v) => handleFieldChange(config.codeMachine, v)}
                        onBlur={handleFieldBlur}
                        disabled={saving}
                      />
                    ) : (
                      <div key={config.id} className="space-y-1.5">
                        <p className="text-sm font-medium">
                          {config.nomAffichage}
                          {config.unite !== "N/A" ? ` (${config.unite})` : ""}
                        </p>
                        <p className="text-sm text-foreground">
                          {String(valeur ?? "—") === "" ? "—" : String(valeur)}
                        </p>
                      </div>
                    )
                  )}
                </div>
              </SectionCard>
            ))
          )}
        </div>

        <div className="lg:sticky lg:top-4">
          <IndicateursPanel indicateurs={viewModel.indicateurs} />
        </div>
      </div>

      <DocumentsPanel
        transactionSourceId={fiche.transaction.id}
        documents={fiche.documents}
        readOnly={!isEdition}
      />
    </div>
  )
}
```

Note: in consultation mode the read-only render inlines a `<p>` per field rather than `FieldValue` because the value formatting differs per type; use `FieldValue` instead for correctness:

Replace the consultation branch's two `<p>` lines with:

```tsx
                      <div key={config.id} className="space-y-1.5">
                        <p className="text-sm font-medium">
                          {config.nomAffichage}
                          {config.unite !== "N/A" ? ` (${config.unite})` : ""}
                        </p>
                        <FieldValue typeDonnees={config.typeDonnees} valeur={valeur} />
                      </div>
```

and import `FieldValue` from `@/components/fiche/field-value`.

- [ ] **Step 3: Write the route**

Create `app/src/app/(app)/transactions/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation"
import { getCurrentOrganisationId } from "@/repositories/organisation.repository"
import { listChampsEnrichissablesByOrganisation } from "@/repositories/champs.repository"
import { findFicheLayout } from "@/repositories/fiche-layout.repository"
import { listTypologiesByOrganisation } from "@/repositories/typologie.repository"
import { findTransactionFiche, listDocuments } from "@/repositories/fiche.repository"
import { serializeTransaction } from "@/serializers/transaction.serializer"
import { serializeDocument, type SerializedFiche } from "@/serializers/fiche.serializer"
import { deriveFicheMode } from "@/lib/fiche"
import { FicheTransactionClient } from "@/components/fiche/fiche-transaction"

export const dynamic = "force-dynamic"

export default async function FicheTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const organisationId = getCurrentOrganisationId()

  const record = await findTransactionFiche(organisationId, id)
  if (!record) notFound()

  const [champs, sections, typologies, documents] = await Promise.all([
    listChampsEnrichissablesByOrganisation(organisationId),
    findFicheLayout(organisationId),
    listTypologiesByOrganisation(organisationId),
    listDocuments(id),
  ])

  const statut = record.enrichie?.statut ?? "A analyser"
  const fiche: SerializedFiche = {
    transaction: serializeTransaction(record),
    champs,
    sections,
    typologies,
    documents: documents.map(serializeDocument),
    statut,
    mode: deriveFicheMode(statut),
  }

  return <FicheTransactionClient key={statut} fiche={fiche} />
}
```

- [ ] **Step 4: Verify types, lint and tests**

Run: `cd app && npm run typecheck && npm run lint && npx vitest run`
Expected: PASS (all lib tests green).

- [ ] **Step 5: Manual verification**

Run: `cd app && npm run dev`, open `/transactions`, click a row's pencil (Analyser). Confirm: only configured sections render, indicators show computed values, `onBlur` updates indicators, saving an out-of-range value is blocked with a message, and the type de transaction select is mandatory. Then mark a transaction « Analysée » and reopen it: the « Données sources » panel appears at the top and fields are read-only.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/fiche/fiche-header.tsx app/src/components/fiche/fiche-transaction.tsx "app/src/app/(app)/transactions/[id]/page.tsx"
git commit -m "feat(fiche): en-tête, orchestrateur client et route /transactions/[id]"
```

---

### Task 9: Câblage de la navigation du tableau

**Files:**
- Modify: `app/src/components/transaction-table.tsx` (the `Actions` component and its render site)

**Interfaces:**
- Consumes: `useRouter` (`next/navigation`).
- Produces: nothing new — `Actions` navigates to `/transactions/[id]`.

- [ ] **Step 1: Add the router and wire the buttons**

In `app/src/components/transaction-table.tsx`, add the import:

```tsx
import { useRouter } from "next/navigation"
```

Replace the `Actions` component (currently lines 60-83) with:

```tsx
function Actions({ id, statut }: { id: string; statut: string | null | undefined }) {
  const router = useRouter()
  const value = statut ?? "A analyser"
  const isAnalysee = value === "Analysée"

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
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Ajouter au panier">
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

Update the `actions` column render (currently line 163) to pass the row id:

```tsx
        render: (row) => <Actions id={row.id} statut={row.enrichie?.statut} />,
```

- [ ] **Step 2: Verify types, lint and tests**

Run: `cd app && npm run typecheck && npm run lint && npx vitest run`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Run: `cd app && npm run dev`, open `/transactions`. Clicking the pencil on a non-analysed row opens its fiche in edition mode; clicking the eye on an analysed row opens it in consultation mode. Clicking the action buttons does not toggle the row selection.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/transaction-table.tsx
git commit -m "feat(fiche): câbler les boutons Analyser/Voir vers la fiche transaction"
```

---

## Self-Review

**1. Spec coverage**

| Spec § | Task |
|---|---|
| Route unique, mode déduit du statut | Task 1 (`deriveFicheMode`), Task 8 (page + `key={statut}`) |
| Disposition admin, seuls champs placés | Task 1 (`buildFicheViewModel`) + test « renders only champs placed in a saved section » |
| Zones principale / Indicateurs | Task 1 (split), Task 7 (`IndicateursPanel`), Task 8 (grid) |
| Données sources en consultation | Task 7 (`SourceDataPanel`), Task 8 (`mode === "consultation"`) |
| Filtrage `applicableATypes` | Task 1 (`isChampApplicable`) |
| Recalcul instantané + arrondi | Task 2 (`recomputeIndicateurs`), Task 8 (`handleFieldBlur`) |
| Validation bloquante §7.8.3 | Task 3 (`validateFiche`), Task 5 (`saveFiche` / `setFicheStatut`) |
| Type de transaction (une feuille, obligatoire) | Task 2 (`resolveTypeTransaction`), Task 3 (`V-TYPE`), Task 5 (`buildStorageEntries`), Task 8 (header select) |
| Documents PDF §7.5.8 | Task 4 (repo), Task 5 (`uploadDocument`/`deleteDocument`), Task 7 (`DocumentsPanel`) |
| En-tête N° inscription / N° lot | Task 8 (`FicheHeader`) |
| Aucun badge de provenance | Task 8 (aucun badge de provenance rendu) |
| Indicateurs ajustés non affichés | Aucune tâche ne lit `IndicateursAjustes` (Global Constraints) |
| Statuts conservés | Task 1 (`deriveFicheMode`), Task 5, Task 8 |
| Composants réutilisables | Tasks 6-7 |

Non-objectifs (Précédent/Suivant, panier, contributeur, réouverture, import masse PDF) : aucune tâche ne les implémente. ✓

**2. Placeholder scan** — aucun « TBD », « TODO », ni « gérer les cas limites » sans code. Chaque étape de code contient le code complet. ✓

**3. Type consistency** — `FicheValeur`, `FicheViewModel`, `FicheSectionChamps`, `FicheChamp`, `FicheMode`, `SerializedFiche`, `SerializedFicheDocument`, `FicheActionResult`, `StorageValueEntry` sont définis une seule fois (Tasks 1/2/4/5) et consommés sous le même nom ensuite. `buildFicheViewModel`, `recomputeIndicateurs`, `buildCalculationContext`, `buildStorageEntries`, `validateFiche`, `resolveTypeTransaction`, `formatFicheValue`, `formatSourceFieldValue` conservent leur signature entre définition et usage. ✓

**Gap trouvé et corrigé :** la spec mentionnait `fromStorageValue` ; il est inutile car `serializeTransaction` fournit déjà `enrichment` normalisé — seule la conversion aller (`toStorageValue`) est nécessaire. Le plan reflète ce choix.

---

## Execution Handoff

Plan complet et enregistré dans `docs/superpowers/plans/2026-09-22-fiche-transaction.md`. Deux options d'exécution :

**1. Subagent-Driven (recommandé)** — je lance un sous-agent frais par tâche, avec revue entre les tâches, itération rapide.

**2. Inline Execution** — j'exécute les tâches dans cette session avec des points de contrôle.

Laquelle ?
