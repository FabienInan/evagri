# EVAGRI — Beta : Fiches transaction, champs enrichissables, dossiers/paniers et exports

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter la fiche transaction avec ses zones saisissables et indicateurs calculés, l'administration unifiée des champs enrichissables avec sections drag-and-drop, la typologie hiérarchique, la structure Dossier/Panier, les contrôles de qualité bloquants et les exports Excel/PNG.

**Architecture:** Extension du projet Alpha. Les champs enrichissables et les sections de la fiche sont stockés en base et configurables par l'administrateur. Le moteur de calcul arithmétique évalue les règles côté serveur. Les exports utilisent `xlsx` pour Excel et `html-to-image`/canvas côté client pour le PNG statique.

**Tech Stack:** Next.js 15, Prisma, shadcn/ui, xlsx, html-to-image, Decimal.js, Vitest.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/calculator.ts` | Évaluation des règles de calcul arithmétiques sur les champs source et enrichis. |
| `src/lib/validation.ts` | Règles de validation bloquantes V-001 à V-007. |
| `src/lib/sections.ts` | Gestion de la structure drag-and-drop des sections de la fiche. |
| `src/server/actions/champs.ts` | CRUD champs enrichissables. |
| `src/server/actions/fiche.ts` | Lecture/sauvegarde d'une fiche transaction et recalcul des indicateurs. |
| `src/server/actions/typologie.ts` | CRUD typologie hiérarchique. |
| `src/server/actions/dossier.ts` | CRUD Dossiers, Paniers et ajout/retrait de transactions. |
| `src/server/actions/export.ts` | Export Excel et données carte PNG. |
| `src/app/admin/champs/page.tsx` | Administration des champs enrichissables. |
| `src/app/admin/typologie/page.tsx` | Administration des types/sous-types. |
| `src/app/admin/dossiers/page.tsx` | Liste des dossiers. |
| `src/app/dossiers/[id]/page.tsx` | Détail d'un dossier avec ses paniers. |
| `src/app/paniers/[id]/page.tsx` | Vue synthétique d'un panier. |
| `src/app/transactions/[id]/page.tsx` | Fiche transaction détaillée. |
| `src/components/fiche-transaction.tsx` | Affichage des deux zones de la fiche. |
| `src/components/champs-admin.tsx` | CRUD champs et règles. |
| `src/components/sections-editor.tsx` | Drag-and-drop des sections et champs. |
| `src/components/dossier-form.tsx` | Création de dossier. |
| `src/components/panier-form.tsx` | Création de panier. |
| `src/components/export-excel-form.tsx` | Génération Excel. |
| `src/components/export-map-png.tsx` | Génération PNG de la carte. |
| `tests/lib/calculator.test.ts` | Tests du moteur de calcul. |
| `tests/lib/validation.test.ts` | Tests des règles de validation. |

---

## Database Schema (reprise de l'Alpha)

Le schéma Prisma est déjà en place. En Beta on exploite pleinement :
- `ChampEnrichissable` : champs saisissables et calculés.
- `ValeurEnrichissement` : valeurs saisies/calculées.
- `VueFicheEvaluation` : sections drag-and-drop.
- `Typologie` : types/sous-types auto-référencés.
- `Dossier`, `Panier`, `PanierTransaction`, `AnalyseDossier`, `ParametresAnalyseTransaction`, `IndicateursAjustes`.

---

## Task 1: Calculation engine for enrichment rules

**Files:**
- Create: `src/lib/calculator.ts`
- Create: `tests/lib/calculator.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Decimal.js**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install decimal.js
```

- [ ] **Step 2: Write the calculator**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/calculator.ts`:
```ts
import Decimal from 'decimal.js'

export interface CalculationContext {
  source: Record<string, number | null>
  enrichi: Record<string, number | null>
}

const OPERATORS: Record<string, { precedence: number; assoc: 'left' | 'right' }> = {
  '+': { precedence: 1, assoc: 'left' },
  '-': { precedence: 1, assoc: 'left' },
  '*': { precedence: 2, assoc: 'left' },
  '/': { precedence: 2, assoc: 'left' },
}

function tokenize(rule: string): string[] {
  return rule
    .replace(/\s+/g, '')
    .split(/(\d+\.?\d*|[a-zA-Z_][a-zA-Z0-9_]*|[+\-*/()])/)
    .filter(Boolean)
}

function toRPN(tokens: string[]): string[] {
  const output: string[] = []
  const stack: string[] = []

  for (const token of tokens) {
    if (/^\d+\.?\d*$/.test(token) || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      output.push(token)
    } else if (token in OPERATORS) {
      const op = OPERATORS[token]
      while (
        stack.length > 0 &&
        stack[stack.length - 1] !== '(' &&
        stack[stack.length - 1] in OPERATORS &&
        ((op.assoc === 'left' && OPERATORS[stack[stack.length - 1]].precedence >= op.precedence) ||
          (op.assoc === 'right' && OPERATORS[stack[stack.length - 1]].precedence > op.precedence))
      ) {
        output.push(stack.pop() as string)
      }
      stack.push(token)
    } else if (token === '(') {
      stack.push(token)
    } else if (token === ')') {
      while (stack.length > 0 && stack[stack.length - 1] !== '(') {
        output.push(stack.pop() as string)
      }
      if (stack.length === 0) throw new Error('Parenthèses déséquilibrées')
      stack.pop()
    } else {
      throw new Error(`Token invalide: ${token}`)
    }
  }

  while (stack.length > 0) {
    const op = stack.pop() as string
    if (op === '(') throw new Error('Parenthèses déséquilibrées')
    output.push(op)
  }

  return output
}

export function evaluateRule(rule: string, context: CalculationContext): number | null {
  if (!rule.trim()) return null

  const tokens = tokenize(rule)
  const rpn = toRPN(tokens)
  const stack: Decimal[] = []

  for (const token of rpn) {
    if (/^\d+\.?\d*$/.test(token)) {
      stack.push(new Decimal(token))
    } else if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(token)) {
      const value = context.enrichi[token] ?? context.source[token] ?? null
      if (value === null || isNaN(value)) return null
      stack.push(new Decimal(value))
    } else {
      if (stack.length < 2) return null
      const b = stack.pop() as Decimal
      const a = stack.pop() as Decimal
      let res: Decimal
      switch (token) {
        case '+':
          res = a.plus(b)
          break
        case '-':
          res = a.minus(b)
          break
        case '*':
          res = a.times(b)
          break
        case '/':
          if (b.isZero()) return null
          res = a.dividedBy(b)
          break
        default:
          return null
      }
      stack.push(res)
    }
  }

  if (stack.length !== 1) return null
  return stack[0].toNumber()
}

export function roundToInteger(value: number | null): number | null {
  if (value === null) return null
  return Math.round(value)
}
```

- [ ] **Step 3: Write calculator tests**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/tests/lib/calculator.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { evaluateRule, roundToInteger } from '@/lib/calculator'

describe('calculator', () => {
  it('evaluates simple source rule', () => {
    const ctx = { source: { prix_vente: 100000, superficie_totale_hectare: 50 }, enrichi: {} }
    expect(evaluateRule('prix_vente / superficie_totale_hectare', ctx)).toBe(2000)
  })

  it('evaluates compound rule', () => {
    const ctx = { source: { a: 10, b: 20 }, enrichi: { c: 30 } }
    expect(evaluateRule('(a + b) * c / 100', ctx)).toBe(9)
  })

  it('returns null on missing value', () => {
    const ctx = { source: { prix_vente: 100000 }, enrichi: {} }
    expect(evaluateRule('prix_vente / superficie_totale_hectare', ctx)).toBeNull()
  })

  it('rounds to integer', () => {
    expect(roundToInteger(1234.56)).toBe(1235)
    expect(roundToInteger(null)).toBeNull()
  })
})
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm run test
```

- [ ] **Step 5: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(calc): add arithmetic calculation engine for enrichment rules"
```

---

## Task 2: Blocking validation rules

**Files:**
- Create: `src/lib/validation.ts`
- Create: `tests/lib/validation.test.ts`

- [ ] **Step 1: Write validation helper**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/validation.ts`:
```ts
export interface ValidationInput {
  superficieTotaleHectare?: number | null
  superficieCultivee?: number | null
  superficieBoisee?: number | null
  superficieConstructible?: number | null
  superficieDrainee?: number | null
  superficieAcéricole?: number | null
  champsPourcentage?: Record<string, number | null>
  valeursNumeriques?: Record<string, number | null>
  plages?: Record<string, { min?: number | null; max?: number | null; value: number | null }>
}

export interface ValidationError {
  code: string
  message: string
}

export function validateEnrichment(input: ValidationInput): ValidationError[] {
  const errors: ValidationError[] = []

  const total = input.superficieTotaleHectare ?? 0
  const cultivee = input.superficieCultivee ?? 0
  const boisee = input.superficieBoisee ?? 0
  const constructible = input.superficieConstructible ?? 0

  if (cultivee + boisee + constructible > total + 1e-9) {
    errors.push({
      code: 'V-001',
      message: 'Superficie cultivée + boisée + constructible doit être ≤ superficie totale.',
    })
  }

  if ((input.superficieDrainee ?? 0) > cultivee + 1e-9) {
    errors.push({ code: 'V-002', message: 'Superficie drainée doit être ≤ superficie cultivée.' })
  }

  for (const [nom, valeur] of Object.entries(input.champsPourcentage || {})) {
    if (valeur !== null && valeur > 100 + 1e-9) {
      errors.push({ code: 'V-003', message: `Le champ ${nom} ne peut excéder 100 %.` })
    }
  }

  if ((input.superficieAcéricole ?? 0) > boisee + 1e-9) {
    errors.push({ code: 'V-005', message: 'Superficie acéricole doit être ≤ superficie boisée.' })
  }

  for (const [nom, valeur] of Object.entries(input.valeursNumeriques || {})) {
    if (valeur !== null && valeur < 0) {
      errors.push({ code: 'V-006', message: `Le champ ${nom} ne peut être négatif.` })
    }
  }

  for (const [nom, config] of Object.entries(input.plages || {})) {
    if (config.value === null) continue
    if (config.min !== undefined && config.min !== null && config.value < config.min - 1e-9) {
      errors.push({ code: 'V-007', message: `${nom} doit être ≥ ${config.min}.` })
    }
    if (config.max !== undefined && config.max !== null && config.value > config.max + 1e-9) {
      errors.push({ code: 'V-007', message: `${nom} doit être ≤ ${config.max}.` })
    }
  }

  return errors
}

export function validateSaleDate(dateVente: Date): ValidationError[] {
  const errors: ValidationError[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  if (dateVente > today) {
    errors.push({ code: 'V-004', message: 'La date de vente ne peut être postérieure à aujourd\'hui.' })
  }
  return errors
}
```

- [ ] **Step 2: Write validation tests**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/tests/lib/validation.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { validateEnrichment } from '@/lib/validation'

describe('validation', () => {
  it('detects V-001', () => {
    const errors = validateEnrichment({
      superficieTotaleHectare: 100,
      superficieCultivee: 60,
      superficieBoisee: 50,
    })
    expect(errors.some((e) => e.code === 'V-001')).toBe(true)
  })

  it('detects V-002', () => {
    const errors = validateEnrichment({ superficieCultivee: 50, superficieDrainee: 60 })
    expect(errors.some((e) => e.code === 'V-002')).toBe(true)
  })

  it('detects V-003', () => {
    const errors = validateEnrichment({ champsPourcentage: { taux: 110 } })
    expect(errors.some((e) => e.code === 'V-003')).toBe(true)
  })

  it('detects V-006', () => {
    const errors = validateEnrichment({ valeursNumeriques: { prix: -100 } })
    expect(errors.some((e) => e.code === 'V-006')).toBe(true)
  })
})
```

- [ ] **Step 3: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(validation): add blocking enrichment validation rules"
```

---

## Task 3: Enrichissable fields admin (CRUD + sections)

**Files:**
- Create: `src/server/actions/champs.ts`
- Create: `src/server/actions/sections.ts`
- Create: `src/app/admin/champs/page.tsx`
- Create: `src/components/champs-admin.tsx`
- Create: `src/components/sections-editor.tsx`

- [ ] **Step 1: Create champs Server Actions**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/champs.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export async function listChamps() {
  return prisma.champEnrichissable.findMany({
    where: { organisationId: DEFAULT_ORG_ID, actif: true },
    orderBy: { ordreAffichage: 'asc' },
  })
}

export async function createChamp(formData: FormData) {
  const nature = formData.get('nature') as string
  const codeMachine = formData.get('codeMachine') as string
  const nomAffichage = formData.get('nomAffichage') as string
  const typeDonnees = formData.get('typeDonnees') as string
  const unite = formData.get('unite') as string
  const regleCalcul = (formData.get('regleCalcul') as string) || null
  const estModifiable = nature === 'SAISISSABLE'
  const estObligatoire = nature === 'SAISISSABLE' && formData.get('estObligatoire') === 'on'
  const plageMin = formData.get('plageMin') ? Number(formData.get('plageMin')) : null
  const plageMax = formData.get('plageMax') ? Number(formData.get('plageMax')) : null
  const optionsListe = formData.get('optionsListe')
    ? JSON.parse(formData.get('optionsListe') as string)
    : null

  await prisma.champEnrichissable.create({
    data: {
      organisationId: DEFAULT_ORG_ID,
      codeMachine,
      nomAffichage,
      typeDonnees,
      nature,
      unite: typeDonnees === 'DECIMAL' || typeDonnees === 'ENTIER' ? unite : 'N/A',
      plageMin,
      plageMax,
      optionsListe,
      regleCalcul,
      estModifiable,
      estObligatoire,
      applicableATypes: JSON.parse((formData.get('applicableATypes') as string) || '[]'),
    },
  })

  revalidatePath('/admin/champs')
}

export async function updateChamp(id: string, formData: FormData) {
  await prisma.champEnrichissable.update({
    where: { id },
    data: {
      nomAffichage: formData.get('nomAffichage') as string,
      typeDonnees: formData.get('typeDonnees') as string,
      unite: formData.get('unite') as string,
      regleCalcul: (formData.get('regleCalcul') as string) || null,
      estObligatoire: formData.get('estObligatoire') === 'on',
      estAffiche: formData.get('estAffiche') === 'on',
      actif: formData.get('actif') === 'on',
      applicableATypes: JSON.parse((formData.get('applicableATypes') as string) || '[]'),
    },
  })
  revalidatePath('/admin/champs')
}

export async function deleteChamp(id: string) {
  await prisma.champEnrichissable.update({ where: { id }, data: { actif: false } })
  revalidatePath('/admin/champs')
}
```

- [ ] **Step 2: Create sections Server Action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/sections.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export async function getFicheLayout() {
  const layout = await prisma.vueFicheEvaluation.findFirst({
    where: { organisationId: DEFAULT_ORG_ID, typeVue: 'FICHE_TRANSACTION' },
  })
  return layout?.contenu as { sections: { id: string; nom: string; ordre: number; champs: string[] }[] } | null
}

export async function saveFicheLayout(sections: { id: string; nom: string; ordre: number; champs: string[] }[]) {
  await prisma.vueFicheEvaluation.upsert({
    where: {
      id: (await prisma.vueFicheEvaluation.findFirst({
        where: { organisationId: DEFAULT_ORG_ID, typeVue: 'FICHE_TRANSACTION' },
      }))?.id || '',
    },
    update: { contenu: { sections } },
    create: {
      organisationId: DEFAULT_ORG_ID,
      typeVue: 'FICHE_TRANSACTION',
      contenu: { sections },
    },
  })
  revalidatePath('/admin/champs')
}
```

- [ ] **Step 3: Create champs admin UI**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/champs-admin.tsx`:
```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createChamp, updateChamp, deleteChamp } from '@/server/actions/champs'

type Champ = {
  id: string
  codeMachine: string
  nomAffichage: string
  nature: string
  typeDonnees: string
  unite: string
  regleCalcul: string | null
  estObligatoire: boolean
  estAffiche: boolean
  actif: boolean
}

export function ChampsAdmin({ champs, typologies }: { champs: Champ[]; typologies: any[] }) {
  return (
    <div className="space-y-8">
      <form
        action={async (formData) => {
          await createChamp(formData)
          window.location.reload()
        }}
        className="grid grid-cols-2 gap-4 border p-4 rounded"
      >
        <h2 className="col-span-2 font-bold">Nouveau champ</h2>
        <div>
          <Label>Code machine</Label>
          <Input name="codeMachine" required placeholder="superficie_cultivee" />
        </div>
        <div>
          <Label>Nom affiché</Label>
          <Input name="nomAffichage" required />
        </div>
        <div>
          <Label>Nature</Label>
          <select name="nature" className="w-full border rounded p-2" required>
            <option value="SAISISSABLE">Saisissable</option>
            <option value="CALCULE">Calculé</option>
          </select>
        </div>
        <div>
          <Label>Type de données</Label>
          <select name="typeDonnees" className="w-full border rounded p-2" required>
            <option value="DECIMAL">Décimal</option>
            <option value="ENTIER">Entier</option>
            <option value="TEXTE">Texte</option>
            <option value="LISTE">Liste</option>
            <option value="BOOLEAN">Booléen</option>
            <option value="DATE">Date</option>
          </select>
        </div>
        <div>
          <Label>Unité (si numérique)</Label>
          <Input name="unite" placeholder="ha" />
        </div>
        <div>
          <Label>Règle de calcul</Label>
          <Input name="regleCalcul" placeholder="prix_vente / superficie_totale_hectare" />
        </div>
        <div className="col-span-2 flex gap-4">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="estObligatoire" /> Obligatoire (saisissable)
          </label>
        </div>
        <input type="hidden" name="applicableATypes" value={JSON.stringify(typologies.map((t) => t.id))} />
        <Button type="submit" className="col-span-2">Créer</Button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Code</th>
            <th className="text-left p-2">Nom</th>
            <th className="text-left p-2">Nature</th>
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">Affiché</th>
            <th className="text-left p-2"></th>
          </tr>
        </thead>
        <tbody>
          {champs.map((c) => (
            <form
              key={c.id}
              action={async (formData) => {
                await updateChamp(c.id, formData)
                window.location.reload()
              }}
              className="contents"
            >
              <tr className="border-b">
                <td className="p-2">{c.codeMachine}</td>
                <td className="p-2"><Input name="nomAffichage" defaultValue={c.nomAffichage} /></td>
                <td className="p-2">{c.nature}</td>
                <td className="p-2">
                  <select name="typeDonnees" defaultValue={c.typeDonnees} className="border rounded p-1">
                    <option value="DECIMAL">Décimal</option>
                    <option value="ENTIER">Entier</option>
                    <option value="TEXTE">Texte</option>
                    <option value="LISTE">Liste</option>
                    <option value="BOOLEAN">Booléen</option>
                    <option value="DATE">Date</option>
                  </select>
                </td>
                <td className="p-2">
                  <input type="checkbox" name="estAffiche" defaultChecked={c.estAffiche} />
                </td>
                <td className="p-2 flex gap-2">
                  <Button type="submit" size="sm">Enregistrer</Button>
                  <Button variant="destructive" size="sm" onClick={async () => { await deleteChamp(c.id); window.location.reload() }}>
                    Supprimer
                  </Button>
                </td>
              </tr>
            </form>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 4: Create sections drag-and-drop editor**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/sections-editor.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveFicheLayout } from '@/server/actions/sections'

export function SectionsEditor({
  layout,
  champs,
}: {
  layout: { sections: { id: string; nom: string; ordre: number; champs: string[] }[] } | null
  champs: { id: string; codeMachine: string; nomAffichage: string; nature: string }[]
}) {
  const saisissables = champs.filter((c) => c.nature === 'SAISISSABLE')
  const [sections, setSections] = useState(
    layout?.sections || [{ id: 'default', nom: 'Général', ordre: 0, champs: saisissables.map((c) => c.id) }]
  )

  function moveChamp(champId: string, fromSectionId: string, toSectionId: string) {
    setSections((prev) => {
      const next = prev.map((s) => ({ ...s, champs: [...s.champs] }))
      const from = next.find((s) => s.id === fromSectionId)
      const to = next.find((s) => s.id === toSectionId)
      if (!from || !to) return prev
      from.champs = from.champs.filter((id) => id !== champId)
      if (!to.champs.includes(champId)) to.champs.push(champId)
      return next
    })
  }

  async function handleSave() {
    await saveFicheLayout(sections.map((s, i) => ({ ...s, ordre: i })))
  }

  return (
    <div className="space-y-4">
      {sections.map((section) => (
        <div key={section.id} className="border rounded p-4">
          <Label>Nom de la section</Label>
          <Input
            value={section.nom}
            onChange={(e) =>
              setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, nom: e.target.value } : s)))
            }
            className="mb-2"
          />
          <div className="space-y-1">
            {section.champs.map((champId) => {
              const champ = saisissables.find((c) => c.id === champId)
              if (!champ) return null
              return (
                <div key={champId} className="flex justify-between items-center bg-stone-100 p-2 rounded">
                  <span>{champ.nomAffichage}</span>
                  <select
                    className="text-sm border rounded p-1"
                    onChange={(e) => moveChamp(champId, section.id, e.target.value)}
                    value={section.id}
                  >
                    {sections.map((s) => (
                      <option key={s.id} value={s.id}>Déplacer vers {s.nom}</option>
                    ))}
                  </select>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          onClick={() =>
            setSections((prev) => [
              ...prev,
              { id: crypto.randomUUID(), nom: 'Nouvelle section', ordre: prev.length, champs: [] },
            ])
          }
        >
          Ajouter une section
        </Button>
        <Button onClick={handleSave}>Enregistrer la disposition</Button>
      </div>
    </div>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/champs/page.tsx`:
```tsx
import { listChamps } from '@/server/actions/champs'
import { getFicheLayout } from '@/server/actions/sections'
import { ChampsAdmin } from '@/components/champs-admin'
import { SectionsEditor } from '@/components/sections-editor'
import { prisma } from '@/lib/prisma'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export default async function ChampsPage() {
  const [champs, layout, typologies] = await Promise.all([
    listChamps(),
    getFicheLayout(),
    prisma.typologie.findMany({ where: { organisationId: DEFAULT_ORG_ID, actif: true } }),
  ])

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Configuration des champs enrichissables</h1>
      <ChampsAdmin champs={champs} typologies={typologies} />
      <h2 className="text-xl font-bold mt-8 mb-4">Disposition de la fiche (drag-and-drop)</h2>
      <SectionsEditor layout={layout} champs={champs} />
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(champs): add enrichissable fields CRUD and fiche layout editor"
```

---

## Task 4: Transaction detail page (two zones)

**Files:**
- Create: `src/server/actions/fiche.ts`
- Create: `src/app/transactions/[id]/page.tsx`
- Create: `src/components/fiche-transaction.tsx`

- [ ] **Step 1: Create fiche Server Action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/fiche.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { evaluateRule, roundToInteger } from '@/lib/calculator'
import { validateEnrichment } from '@/lib/validation'
import { revalidatePath } from 'next/cache'
import Decimal from 'decimal.js'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export async function getFiche(transactionId: string) {
  const tx = await prisma.transactionSource.findUnique({
    where: { id: transactionId },
    include: {
      enrichie: { include: { valeurs: { include: { champEnrichissable: true } } } },
    },
  })

  if (!tx || tx.organisationId !== DEFAULT_ORG_ID) throw new Error('Transaction inconnue')

  const champs = await prisma.champEnrichissable.findMany({
    where: { organisationId: DEFAULT_ORG_ID, actif: true },
  })

  const layout = await prisma.vueFicheEvaluation.findFirst({
    where: { organisationId: DEFAULT_ORG_ID, typeVue: 'FICHE_TRANSACTION' },
  })

  return { tx, champs, layout: layout?.contenu as any }
}

export async function saveValeurs(transactionId: string, valeurs: Record<string, any>) {
  const tx = await prisma.transactionSource.findUnique({
    where: { id: transactionId },
    include: { enrichie: true },
  })
  if (!tx || tx.organisationId !== DEFAULT_ORG_ID) throw new Error('Transaction inconnue')

  const champs = await prisma.champEnrichissable.findMany({
    where: { organisationId: DEFAULT_ORG_ID, actif: true },
  })

  const enrichie = tx.enrichie || (await prisma.transactionEnrichie.create({
    data: { organisationId: DEFAULT_ORG_ID, transactionSourceId: tx.id, statut: 'NON_ANALYSEE' },
  }))

  const sourceContext: Record<string, number | null> = {
    prix_vente: tx.prixVente ? Number(tx.prixVente) : null,
    superficie_totale_hectare: tx.superficieTotaleHectare ? Number(tx.superficieTotaleHectare) : null,
  }

  const enrichiContext: Record<string, number | null> = {}

  for (const [champId, rawValue] of Object.entries(valeurs)) {
    const champ = champs.find((c) => c.id === champId)
    if (!champ || champ.nature !== 'SAISISSABLE' || !champ.estModifiable) continue

    let value: number | string | boolean | null = null
    if (champ.typeDonnees === 'BOOLEAN') value = Boolean(rawValue)
    else if (champ.typeDonnees === 'TEXTE' || champ.typeDonnees === 'LISTE') value = String(rawValue)
    else if (rawValue !== '' && rawValue !== null && rawValue !== undefined) value = Number(rawValue)

    await prisma.valeurEnrichissement.upsert({
      where: {
        transactionEnrichieId_champEnrichissableId: {
          transactionEnrichieId: enrichie.id,
          champEnrichissableId: champ.id,
        },
      },
      update: {
        valeurNombre: typeof value === 'number' ? new Decimal(value) : null,
        valeurTexte: typeof value === 'string' ? value : null,
        valeurBooleen: typeof value === 'boolean' ? value : null,
        dateModification: new Date(),
      },
      create: {
        transactionEnrichieId: enrichie.id,
        champEnrichissableId: champ.id,
        valeurNombre: typeof value === 'number' ? new Decimal(value) : null,
        valeurTexte: typeof value === 'string' ? value : null,
        valeurBooleen: typeof value === 'boolean' ? value : null,
      },
    })

    if (typeof value === 'number') enrichiContext[champ.codeMachine] = value
  }

  const updatedValeurs = await prisma.valeurEnrichissement.findMany({
    where: { transactionEnrichieId: enrichie.id },
    include: { champEnrichissable: true },
  })

  for (const v of updatedValeurs) {
    if (v.valeurNombre !== null) enrichiContext[v.champEnrichissable.codeMachine] = Number(v.valeurNombre)
  }

  for (const champ of champs.filter((c) => c.nature === 'CALCULE' && c.regleCalcul)) {
    const result = evaluateRule(champ.regleCalcul, { source: sourceContext, enrichi: enrichiContext })
    const rounded = roundToInteger(result)
    await prisma.valeurEnrichissement.upsert({
      where: {
        transactionEnrichieId_champEnrichissableId: {
          transactionEnrichieId: enrichie.id,
          champEnrichissableId: champ.id,
        },
      },
      update: { valeurNombre: rounded !== null ? new Decimal(rounded) : null, dateModification: new Date() },
      create: {
        transactionEnrichieId: enrichie.id,
        champEnrichissableId: champ.id,
        valeurNombre: rounded !== null ? new Decimal(rounded) : null,
      },
    })
  }

  revalidatePath(`/transactions/${transactionId}`)
}

export async function toggleAnalyse(transactionId: string) {
  const tx = await prisma.transactionSource.findUnique({
    where: { id: transactionId },
    include: { enrichie: true },
  })
  if (!tx || !tx.enrichie) throw new Error('Transaction non enrichie')

  const nextStatut = tx.enrichie.statut === 'ANALYSEE' ? 'NON_ANALYSEE' : 'ANALYSEE'

  await prisma.transactionEnrichie.update({
    where: { id: tx.enrichie.id },
    data: {
      statut: nextStatut,
      dateStatut: new Date(),
    },
  })

  revalidatePath(`/transactions/${transactionId}`)
}
```

- [ ] **Step 2: Create fiche transaction UI**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/fiche-transaction.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveValeurs, toggleAnalyse } from '@/server/actions/fiche'

export function FicheTransaction({
  tx,
  champs,
  layout,
}: {
  tx: any
  champs: any[]
  layout: { sections: { id: string; nom: string; champs: string[] }[] } | null
})
{
  const saisissables = champs.filter((c) => c.nature === 'SAISISSABLE' &> c.estAffiche)
  const calcules = champs.filter((c) => c.nature === 'CALCULE' &> c.estAffiche)
  const [form, setForm] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {}
    for (const v of tx.enrichie?.valeurs || []) {
      init[v.champEnrichissableId] =
        v.valeurTexte ?? v.valeurBooleen ?? (v.valeurNombre !== null ? Number(v.valeurNombre) : '')
    }
    for (const c of saisissables) {
      if (!(c.id in init)) init[c.id] = ''
    }
    return init
  })

  const sections = layout?.sections || [
    { id: 'default', nom: 'Général', champs: saisissables.map((c) => c.id) },
  ]

  async function handleSave() {
    await saveValeurs(tx.id, form)
  }

  async function handleToggleAnalyse() {
    await toggleAnalyse(tx.id)
  }

  function renderField(champ: any) {
    const value = form[champ.id] ?? ''
    if (champ.typeDonnees === 'BOOLEAN') {
      return (
        <input
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => setForm((prev) => ({ ...prev, [champ.id]: e.target.checked }))}
        />
      )
    }
    if (champ.typeDonnees === 'LISTE') {
      return (
        <select
          value={value}
          onChange={(e) => setForm((prev) => ({ ...prev, [champ.id]: e.target.value }))}
          className="w-full border rounded p-2"
        >
          <option value="">--</option>
          {((champ.optionsListe as string[]) || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )
    }
    return (
      <Input
        type={champ.typeDonnees === 'DATE' ? 'date' : 'text'}
        value={value}
        onChange={(e) => setForm((prev) => ({ ...prev, [champ.id]: e.target.value }))}
        onBlur={handleSave}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-xl font-bold">{tx.numeroInscription} — Lot {tx.numeroLot}</h2>
          <p className="text-sm text-stone-600">{tx.municipalite}, {tx.mrc}</p>
        </div>

        {sections.map((section) => (
          <div key={section.id} className="border rounded p-4">
            <h3 className="font-bold mb-3">{section.nom}</h3>
            <div className="grid grid-cols-2 gap-4">
              {section.champs
                .map((id) => saisissables.find((c) => c.id === id))
                .filter(Boolean)
                .map((champ) => (
                  <div key={champ.id}>
                    <Label>{champ.nomAffichage} {champ.estObligatoire && '*'}</Label>
                    {renderField(champ)}
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      <aside className="border rounded p-4 h-fit sticky top-4">
        <h3 className="font-bold mb-4">Indicateurs</h3>
        <div className="space-y-3">
          {calcules.map((c) => {
            const valeur = tx.enrichie?.valeurs.find((v: any) => v.champEnrichissableId === c.id)
            return (
              <div key={c.id} className="flex justify-between">
                <span className="text-sm">{c.nomAffichage}</span>
                <span className="font-medium">
                  {valeur?.valeurNombre !== null ? Number(valeur.valeurNombre) : '-'}
                </span>
              </div>
            )
          })}
        </div>
        <div className="mt-6 space-y-2">
          <Button onClick={handleSave} className="w-full">Enregistrer</Button>
          <Button onClick={handleToggleAnalyse} variant={tx.enrichie?.statut === 'ANALYSEE' ? 'secondary' : 'default'} className="w-full">
            {tx.enrichie?.statut === 'ANALYSEE' ? 'Réouvrir' : 'Marquer comme analysée'}
          </Button>
        </div>
      </aside>
    </div>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/transactions/[id]/page.tsx`:
```tsx
import { getFiche } from '@/server/actions/fiche'
import { FicheTransaction } from '@/components/fiche-transaction'

export default async function FichePage({ params }: { params: { id: string } }) {
  const { tx, champs, layout } = await getFiche(params.id)

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Fiche transaction</h1>
      <FicheTransaction tx={tx} champs={champs} layout={layout} />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(fiche): add transaction detail page with two zones and recalculation"
```

---

## Task 5: Hierarchical typology

**Files:**
- Create: `src/server/actions/typologie.ts`
- Create: `src/app/admin/typologie/page.tsx`
- Create: `src/components/typologie-admin.tsx`

- [ ] **Step 1: Create typologie Server Actions**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/typologie.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export async function listTypologies() {
  return prisma.typologie.findMany({
    where: { organisationId: DEFAULT_ORG_ID, actif: true },
    include: { enfants: true },
    orderBy: { ordre: 'asc' },
  })
}

export async function createTypologie(formData: FormData) {
  await prisma.typologie.create({
    data: {
      organisationId: DEFAULT_ORG_ID,
      code: formData.get('code') as string,
      nom: formData.get('nom') as string,
      parentId: (formData.get('parentId') as string) || null,
      estTypeMere: formData.get('estTypeMere') === 'on',
      estFeuille: formData.get('estFeuille') === 'on',
      ordre: Number(formData.get('ordre') || 0),
    },
  })
  revalidatePath('/admin/typologie')
}
```

- [ ] **Step 2: Create typologie admin UI**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/typologie-admin.tsx`:
```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createTypologie } from '@/server/actions/typologie'

export function TypologieAdmin({ typologies }: { typologies: any[] }) {
  return (
    <div className="space-y-6">
      <form
        action={async (formData) => {
          await createTypologie(formData)
          window.location.reload()
        }}
        className="grid grid-cols-3 gap-4 border p-4 rounded"
      >
        <div>
          <Label>Code</Label>
          <Input name="code" required />
        </div>
        <div>
          <Label>Nom</Label>
          <Input name="nom" required />
        </div>
        <div>
          <Label>Parent</Label>
          <select name="parentId" className="w-full border rounded p-2">
            <option value="">Aucun</option>
            {typologies.map((t) => (
              <option key={t.id} value={t.id}>{t.nom}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>Ordre</Label>
          <Input name="ordre" type="number" defaultValue={0} />
        </div>
        <div className="flex gap-4 items-end">
          <label><input type="checkbox" name="estFeuille" defaultChecked /> Feuille</label>
          <label><input type="checkbox" name="estTypeMere" /> Type mère</label>
        </div>
        <Button type="submit">Ajouter</Button>
      </form>

      <ul className="space-y-1">
        {typologies.map((t) => (
          <li key={t.id} className="border rounded p-2">
            {t.nom} ({t.code}) {t.estFeuille && '— feuille'}
            {t.enfants?.length > 0 && (
              <ul className="ml-4 mt-1">
                {t.enfants.map((e: any) => (
                  <li key={e.id}>{e.nom} ({e.code})</li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/typologie/page.tsx`:
```tsx
import { listTypologies } from '@/server/actions/typologie'
import { TypologieAdmin } from '@/components/typologie-admin'

export default async function TypologiePage() {
  const typologies = await listTypologies()
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Typologie des transactions</h1>
      <TypologieAdmin typologies={typologies} />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(typologie): add hierarchical transaction type admin"
```

---

## Task 6: Dossiers and Paniers

**Files:**
- Create: `src/server/actions/dossier.ts`
- Create: `src/app/admin/dossiers/page.tsx`
- Create: `src/app/dossiers/[id]/page.tsx`
- Create: `src/app/paniers/[id]/page.tsx`
- Create: `src/components/dossier-form.tsx`
- Create: `src/components/panier-form.tsx`

- [ ] **Step 1: Create dossier/panier Server Actions**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/dossier.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''
const DOSSIER_REGEX = /^[0-9]{2}-[A-Z]{2}-[0-9]{3}$/

export async function listDossiers() {
  return prisma.dossier.findMany({
    where: { organisationId: DEFAULT_ORG_ID, actif: true },
    include: { paniers: true },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createDossier(formData: FormData) {
  const numeroDossier = formData.get('numeroDossier') as string
  if (!DOSSIER_REGEX.test(numeroDossier)) {
    throw new Error('Format invalide. Attendu: AA-RR-DDD')
  }

  await prisma.dossier.create({
    data: {
      organisationId: DEFAULT_ORG_ID,
      numeroDossier,
      nom: formData.get('nom') as string,
    },
  })
  revalidatePath('/admin/dossiers')
}

export async function getDossier(dossierId: string) {
  return prisma.dossier.findUnique({
    where: { id: dossierId },
    include: {
      paniers: { include: { typeTransaction: true } },
    },
  })
}

export async function createPanier(dossierId: string, formData: FormData) {
  await prisma.panier.create({
    data: {
      organisationId: DEFAULT_ORG_ID,
      dossierId,
      nom: formData.get('nom') as string,
      typeTransactionId: (formData.get('typeTransactionId') as string) || null,
    },
  })
  revalidatePath(`/dossiers/${dossierId}`)
}

export async function getPanier(panierId: string) {
  return prisma.panier.findUnique({
    where: { id: panierId },
    include: {
      transactions: { include: { transactionEnrichie: { include: { transactionSource: true, valeurs: { include: { champEnrichissable: true } } } } } },
      typeTransaction: true,
      dossier: true,
    },
  })
}

export async function addTransactionToPanier(panierId: string, transactionEnrichieId: string) {
  const enrichie = await prisma.transactionEnrichie.findUnique({ where: { id: transactionEnrichieId } })
  if (!enrichie || enrichie.statut !== 'ANALYSEE') {
    throw new Error('Seules les transactions analysées peuvent être ajoutées')
  }

  await prisma.panierTransaction.create({
    data: { panierId, transactionEnrichieId },
  })
  revalidatePath(`/paniers/${panierId}`)
}

export async function removeTransactionFromPanier(panierId: string, transactionEnrichieId: string) {
  await prisma.panierTransaction.delete({
    where: { id_panier_transactionEnrichieId: { panierId, transactionEnrichieId } },
  })
  revalidatePath(`/paniers/${panierId}`)
}
```

- [ ] **Step 2: Create dossier list and detail pages**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/dossier-form.tsx`:
```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createDossier } from '@/server/actions/dossier'

export function DossierForm() {
  return (
    <form
      action={async (formData) => {
        await createDossier(formData)
        window.location.reload()
      }}
      className="grid grid-cols-3 gap-4 items-end border p-4 rounded mb-6"
    >
      <div>
        <Label>Numéro (AA-RR-DDD)</Label>
        <Input name="numeroDossier" placeholder="26-AB-001" required pattern="[0-9]{2}-[A-Z]{2}-[0-9]{3}" />
      </div>
      <div>
        <Label>Nom</Label>
        <Input name="nom" />
      </div>
      <Button type="submit">Créer</Button>
    </form>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/dossiers/page.tsx`:
```tsx
import { listDossiers } from '@/server/actions/dossier'
import { DossierForm } from '@/components/dossier-form'
import Link from 'next/link'

export default async function DossiersPage() {
  const dossiers = await listDossiers()

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dossiers de comparables</h1>
      <DossierForm />
      <div className="space-y-2">
        {dossiers.map((d) => (
          <Link key={d.id} href={`/dossiers/${d.id}`} className="block border rounded p-4 hover:bg-stone-50">
            <strong>{d.numeroDossier}</strong> {d.nom && `— ${d.nom}`}
            <span className="text-sm text-stone-500 ml-2">({d.paniers.length} panier(s))</span>
          </Link>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Create panier form and dossier detail**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/panier-form.tsx`:
```tsx
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createPanier } from '@/server/actions/dossier'

export function PanierForm({ dossierId, typologies }: { dossierId: string; typologies: any[] }) {
  return (
    <form
      action={async (formData) => {
        await createPanier(dossierId, formData)
        window.location.reload()
      }}
      className="grid grid-cols-3 gap-4 items-end border p-4 rounded mb-4"
    >
      <div>
        <Label>Nom</Label>
        <Input name="nom" required />
      </div>
      <div>
        <Label>Type optionnel</Label>
        <select name="typeTransactionId" className="w-full border rounded p-2">
          <option value="">Aucun</option>
          {typologies.map((t) => (
            <option key={t.id} value={t.id}>{t.nom}</option>
          ))}
        </select>
      </div>
      <Button type="submit">Créer un panier</Button>
    </form>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/dossiers/[id]/page.tsx`:
```tsx
import { getDossier } from '@/server/actions/dossier'
import { PanierForm } from '@/components/panier-form'
import { listTypologies } from '@/server/actions/typologie'
import Link from 'next/link'

export default async function DossierDetailPage({ params }: { params: { id: string } }) {
  const dossier = await getDossier(params.id)
  if (!dossier) return <p>Dossier introuvable</p>

  const typologies = await listTypologies()

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Dossier {dossier.numeroDossier}</h1>
      <PanierForm dossierId={dossier.id} typologies={typologies} />
      <div className="space-y-2">
        {dossier.paniers.map((p) => (
          <Link key={p.id} href={`/paniers/${p.id}`} className="block border rounded p-4 hover:bg-stone-50">
            <strong>{p.nom}</strong> {p.typeTransaction && `— ${p.typeTransaction.nom}`}
          </Link>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Create panier detail page**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/paniers/[id]/page.tsx`:
```tsx
import { getPanier, removeTransactionFromPanier } from '@/server/actions/dossier'
import { Button } from '@/components/ui/button'

export default async function PanierDetailPage({ params }: { params: { id: string } }) {
  const panier = await getPanier(params.id)
  if (!panier) return <p>Panier introuvable</p>

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Panier : {panier.nom}</h1>
      <p className="text-stone-600 mb-4">Dossier {panier.dossier.numeroDossier}</p>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">N° d'inscription</th>
            <th className="text-left p-2">Date</th>
            <th className="text-left p-2">Prix</th>
            <th className="text-left p-2"></th>
          </tr>
        </thead>
        <tbody>
          {panier.transactions.map(({ transactionEnrichie }) => (
            <tr key={transactionEnrichie.id} className="border-b">
              <td className="p-2">{transactionEnrichie.transactionSource.numeroInscription}</td>
              <td className="p-2">{new Date(transactionEnrichie.transactionSource.dateVente).toLocaleDateString('fr-CA')}</td>
              <td className="p-2">{transactionEnrichie.transactionSource.prixVente?.toString() ?? '-'}</td>
              <td className="p-2">
                <form action={async () => { 'use server'; await removeTransactionFromPanier(panier.id, transactionEnrichie.id) }}>
                  <Button type="submit" variant="destructive" size="sm">Retirer</Button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(dossiers): add dossier, panier and comparable basket management"
```

---

## Task 7: Polygon selection on map

**Files:**
- Create: `src/components/map-polygon-selector.tsx`
- Create: `src/app/transactions/map/page.tsx` (modify)
- Create: `src/server/actions/polygon-selection.ts`
- Create: `src/components/add-to-panier-dialog.tsx`

- [ ] **Step 1: Install Leaflet Draw**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install leaflet-draw
npm install -D @types/leaflet-draw
```

Add `leaflet-draw/dist/leaflet.draw.css` import in the map component.

- [ ] **Step 2: Create polygon selection Server Action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/polygon-selection.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/session'

type Point = { lat: number; lng: number }

function pointInPolygon(point: Point, polygon: Point[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng
    const xj = polygon[j].lat, yj = polygon[j].lng
    const intersect =
      yi > point.lng !== yj > point.lng &&
      point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi
    if (intersect) inside = !inside
  }
  return inside
}

export async function findTransactionsInPolygon(polygon: Point[]) {
  const { organisationId } = await requireAuth()

  const transactions = await prisma.transactionSource.findMany({
    where: {
      organisationId,
      latitude: { not: null },
      longitude: { not: null },
      enrichie: { statut: 'ANALYSEE' },
    },
    include: { enrichie: true },
  })

  return transactions.filter((t) =>
    t.latitude && t.longitude &&
    pointInPolygon(
      { lat: Number(t.latitude), lng: Number(t.longitude) },
      polygon
    )
  )
}

export async function addTransactionsToPanier(panierId: string, transactionEnrichieIds: string[]) {
  const { organisationId } = await requireAuth()

  const panier = await prisma.panier.findUnique({ where: { id: panierId } })
  if (!panier || panier.organisationId !== organisationId) {
    throw new Error('Panier introuvable')
  }

  const data = transactionEnrichieIds.map((id) => ({ panierId, transactionEnrichieId: id }))
  await prisma.panierTransaction.createMany({
    data,
    skipDuplicates: true,
  })
}

export async function listPaniersForSelect() {
  const { organisationId } = await requireAuth()
  return prisma.panier.findMany({
    where: { organisationId },
    include: { dossier: true },
    orderBy: { createdAt: 'desc' },
  })
}
```

- [ ] **Step 3: Create polygon selector component**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/map-polygon-selector.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet-draw/dist/leaflet.draw.css'
import 'leaflet-draw'
import { Button } from '@/components/ui/button'
import { findTransactionsInPolygon, addTransactionsToPanier, listPaniersForSelect } from '@/server/actions/polygon-selection'

const pinIcon = new L.Icon({ iconUrl: '/pin.svg', iconSize: [24, 36], iconAnchor: [12, 36] })

type Transaction = {
  id: string
  numeroInscription: string
  latitude: number
  longitude: number
  enrichie: { id: string } | null
}

function DrawControl({ onPolygonCreated }: { onPolygonCreated: (polygon: L.Polygon) => void }) {
  const map = useMap()

  useEffect(() => {
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new (L as any).Control.Draw({
      draw: {
        polygon: { allowIntersection: false, showArea: true },
        polyline: false,
        rectangle: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
      edit: { featureGroup: drawnItems },
    })
    map.addControl(drawControl)

    const handleCreated = (e: any) => {
      const layer = e.layer
      drawnItems.addLayer(layer)
      onPolygonCreated(layer)
    }

    map.on((L as any).Draw.Event.CREATED, handleCreated)

    return () => {
      map.off((L as any).Draw.Event.CREATED, handleCreated)
      map.removeControl(drawControl)
      map.removeLayer(drawnItems)
    }
  }, [map, onPolygonCreated])

  return null
}

export function MapPolygonSelector({ initialTransactions }: { initialTransactions: Transaction[] }) {
  const [transactions] = useState(initialTransactions)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [paniers, setPaniers] = useState<any[]>([])
  const [selectedPanier, setSelectedPanier] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    listPaniersForSelect().then(setPaniers)
  }, [])

  async function handlePolygonCreated(polygon: L.Polygon) {
    const latlngs = polygon.getLatLngs()[0] as L.LatLng[]
    const points = latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }))
    const inside = await findTransactionsInPolygon(points)
    setSelectedIds(inside.map((t) => t.enrichie?.id).filter(Boolean) as string[])
    setMessage(`${inside.length} transaction(s) dans le polygone`)
  }

  async function handleAddToPanier() {
    if (!selectedPanier || selectedIds.length === 0) return
    await addTransactionsToPanier(selectedPanier, selectedIds)
    setMessage(`${selectedIds.length} transaction(s) ajoutée(s) au panier`)
    setSelectedIds([])
  }

  return (
    <div className="space-y-4">
      <MapContainer center={[52.0, -72.0]} zoom={6} style={{ height: '70vh', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <DrawControl onPolygonCreated={handlePolygonCreated} />
        {transactions.map((t) => (
          <Marker key={t.id} position={[t.latitude, t.longitude]} icon={pinIcon}>
            <Popup>{t.numeroInscription}</Popup>
          </Marker>
        ))}
      </MapContainer>

      {message && <p className="text-sm">{message}</p>}

      {selectedIds.length > 0 && (
        <div className="flex gap-2 items-center">
          <select
            className="border rounded p-2"
            value={selectedPanier}
            onChange={(e) => setSelectedPanier(e.target.value)}
          >
            <option value="">Choisir un panier...</option>
            {paniers.map((p) => (
              <option key={p.id} value={p.id}>{p.dossier.numeroDossier} / {p.nom}</option>
            ))}
          </select>
          <Button onClick={handleAddToPanier} disabled={!selectedPanier}>Ajouter au panier</Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Update map page to enable polygon selection**

Modify `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/transactions/map/page.tsx`:
```tsx
import dynamic from 'next/dynamic'
import { prisma } from '@/lib/prisma'

const MapPolygonSelector = dynamic(() => import('@/components/map-polygon-selector').then((m) => m.MapPolygonSelector), { ssr: false })

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export default async function MapPage() {
  const transactions = await prisma.transactionSource.findMany({
    where: { organisationId: DEFAULT_ORG_ID, latitude: { not: null }, longitude: { not: null } },
    include: { enrichie: true },
  })

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Carte des transactions</h1>
      <p className="text-sm text-stone-600 mb-4">Tracez un polygone pour sélectionner des transactions analysées et les ajouter à un panier.</p>
      <MapPolygonSelector initialTransactions={transactions} />
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(map): add polygon selection and add-to-panier flow"
```

---

## Task 8: Excel export

**Files:**
- Create: `src/server/actions/export.ts`
- Create: `src/components/export-excel-form.tsx`
- Create: `src/app/admin/export/page.tsx`

- [ ] **Step 1: Install xlsx**

Already installed from Alpha.

- [ ] **Step 2: Create export Server Action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/export.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export async function exportExcel(panierId: string, selectedColumns: string[]) {
  const panier = await prisma.panier.findUnique({
    where: { id: panierId },
    include: {
      transactions: {
        include: {
          transactionEnrichie: {
            include: { transactionSource: true, valeurs: { include: { champEnrichissable: true } } },
          },
        },
      },
    },
  })

  if (!panier) throw new Error('Panier introuvable')

  const rows = panier.transactions.map(({ transactionEnrichie }) => {
    const source = transactionEnrichie.transactionSource
    const row: Record<string, any> = {}

    for (const col of selectedColumns) {
      if (col.startsWith('source:')) {
        const field = col.replace('source:', '')
        row[field] = (source as any)[field] ?? ''
      } else {
        const valeur = transactionEnrichie.valeurs.find((v) => v.champEnrichissableId === col)
        const champ = valeur?.champEnrichissable
        if (!champ) continue
        row[champ.codeMachine] =
          valeur.valeurTexte ?? valeur.valeurBooleen ?? (valeur.valeurNombre !== null ? Number(valeur.valeurNombre) : '')
      }
    }

    return row
  })

  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })

  return Buffer.from(buffer).toString('base64')
}
```

- [ ] **Step 3: Create export UI**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/export-excel-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { exportExcel } from '@/server/actions/export'

export function ExportExcelForm({ panierId, champs }: { panierId: string; champs: any[] }) {
  const [selected, setSelected] = useState<string[]>([])

  async function handleExport() {
    const b64 = await exportExcel(panierId, selected)
    const blob = new Blob([Buffer.from(b64, 'base64')], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `export_${panierId}.xlsx`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sourceFields = [
    { id: 'source:numeroInscription', label: "N° d'inscription" },
    { id: 'source:numeroLot', label: 'Lot' },
    { id: 'source:dateVente', label: 'Date de vente' },
    { id: 'source:prixVente', label: 'Prix de vente' },
    { id: 'source:mrc', label: 'MRC' },
    { id: 'source:municipalite', label: 'Municipalité' },
    { id: 'source:superficieTotaleHectare', label: 'Superficie totale (ha)' },
  ]

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  return (
    <div className="space-y-4">
      <p className="font-medium">Colonnes à exporter</p>
      <div className="grid grid-cols-2 gap-2">
        {sourceFields.map((f) => (
          <label key={f.id} className="flex items-center gap-2">
            <input type="checkbox" checked={selected.includes(f.id)} onChange={() => toggle(f.id)} /> {f.label}
          </label>
        ))}
        {champs.map((c) => (
          <label key={c.id} className="flex items-center gap-2">
            <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggle(c.id)} /> {c.nomAffichage}
          </label>
        ))}
      </div>
      <Button onClick={handleExport}>Exporter en Excel</Button>
    </div>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/export/page.tsx`:
```tsx
import { listDossiers } from '@/server/actions/dossier'
import { listChamps } from '@/server/actions/champs'
import { ExportExcelForm } from '@/components/export-excel-form'

export default async function ExportPage() {
  const dossiers = await listDossiers()
  const champs = await listChamps()

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Export Excel</h1>
      <div className="space-y-6">
        {dossiers.map((d) => (
          <div key={d.id} className="border rounded p-4">
            <h2 className="font-bold">{d.numeroDossier} {d.nom && `— ${d.nom}`}</h2>
            <div className="grid grid-cols-2 gap-4 mt-2">
              {d.paniers.map((p) => (
                <div key={p.id} className="border rounded p-3">
                  <p className="font-medium">{p.nom}</p>
                  <ExportExcelForm panierId={p.id} champs={champs} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(export): add Excel export for comparable baskets"
```

---

## Task 9: Static map PNG export

**Files:**
- Create: `src/components/export-map-png.tsx`
- Create: `src/app/admin/export-map/page.tsx`

- [ ] **Step 1: Install html-to-image**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install html-to-image
```

- [ ] **Step 2: Create PNG export component**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/export-map-png.tsx`:
```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import * as htmlToImage from 'html-to-image'
import { Button } from '@/components/ui/button'

const pinIcon = new L.Icon({ iconUrl: '/pin.svg', iconSize: [24, 36], iconAnchor: [12, 36] })

export function ExportMapPng({ transactions }: { transactions: any[] }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), 2000)
    return () => clearTimeout(timer)
  }, [])

  async function handleExport() {
    if (!mapRef.current) return
    const dataUrl = await htmlToImage.toPng(mapRef.current, { pixelRatio: 2 })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = 'carte_transactions.png'
    a.click()
  }

  return (
    <div className="space-y-4">
      <div ref={mapRef} style={{ height: '600px', width: '800px' }}>
        <MapContainer center={[52.0, -72.0]} zoom={6} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {transactions.map((t) => (
            <Marker key={t.id} position={[Number(t.latitude), Number(t.longitude)]} icon={pinIcon}>
              <Popup>{t.numeroInscription}</Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      <Button onClick={handleExport} disabled={!ready}>Exporter la carte en PNG</Button>
    </div>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/export-map/page.tsx`:
```tsx
import { prisma } from '@/lib/prisma'
import dynamic from 'next/dynamic'

const ExportMapPng = dynamic(() => import('@/components/export-map-png').then((m) => m.ExportMapPng), { ssr: false })

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export default async function ExportMapPage() {
  const transactions = await prisma.transactionSource.findMany({
    where: { organisationId: DEFAULT_ORG_ID, latitude: { not: null }, longitude: { not: null } },
    select: { id: true, numeroInscription: true, latitude: true, longitude: true },
  })

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Export carte PNG</h1>
      <ExportMapPng transactions={transactions} />
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(export): add static PNG map export"
```

---

## Task 10: Self-review and gap fix

- [ ] **Step 1: Spec coverage check**

| Cahier Beta | Tâche |
|---|---|
| Fiche transaction 2 zones | Task 4 |
| Champs enrichissables admin unifié + drag-drop | Task 3 |
| Typologie transactionnelle | Task 5 |
| Dossiers/Paniers | Task 6 |
| Sélection polygone sur carte | Task 7 |
| Contrôles qualité bloquants | Task 2 |
| Export Excel | Task 8 |
| Export carte PNG | Task 9 |

Aucun écart identifié.

- [ ] **Step 2: Placeholder scan**

Search for `TODO`, `TBD`, `implement later`, `fill in details`. Fix before saving.

- [ ] **Step 3: Type consistency check**

- `ChampEnrichissable.nature` values are `SAISISSABLE` and `CALCULE`.
- `TransactionEnrichie.statut` values are `NON_ANALYSEE` and `ANALYSEE`.
- `evaluateRule` returns `number | null` and is rounded with `roundToInteger`.

- [ ] **Step 4: Final commit of plan**

```bash
cd /Users/fabien/Documents/projets/Evagri
git add docs/superpowers/plans/2026-06-17-beta-fiches-champs-dossiers-paniers-exports.md
git commit -m "docs(plan): add Beta implementation plan"
```

---

## Execution Handoff

**Plan Beta complet et sauvegardé dans `docs/superpowers/plans/2026-06-17-beta-fiches-champs-dossiers-paniers-exports.md`.**

Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — un sous-agent par tâche, revue entre chaque tâche.
2. **Inline Execution** — exécution directe dans cette session avec `superpowers:executing-plans`.

**Quelle approche ?**
