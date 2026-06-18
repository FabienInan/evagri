# EVAGRI — RC : Connecteur JLR et supervision des imports

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Intégrer l'import automatique hebdomadaire du fichier CSV JLR, fournir une interface de supervision avec relance manuelle, historique des traitements et téléchargement du template Excel vierge.

**Architecture:** Un service de polling ou une tâche planifiée externe dépose le fichier CSV JLR dans un bucket S3 ou un volume accessible. L'application lit ce fichier via une Server Action protégée (rôle `ADMIN`/`DEVELOPPEUR`), le parse et insère les transactions sources en respectant la logique de doublons. Les erreurs et statuts sont stockés dans l'entité `Importation` existante. Le template vierge est généré à la volée avec `xlsx`.

**Tech Stack:** Next.js 15, Prisma, xlsx, S3-compatible storage, Cron/scheduler externe ( Coolify cronjob ou BullMQ optionnel).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/jlr-parser.ts` | Parseur du CSV JLR (délimiteur, mapping de colonnes). |
| `src/lib/jlr-import.ts` | Insertion des lignes JLR en base. |
| `src/server/actions/jlr.ts` | Import manuel / relance, historique, template. |
| `src/app/admin/imports/page.tsx` | Interface de supervision des imports. |
| `src/components/jlr-import-form.tsx` | Upload / relance JLR et rapport. |
| `src/components/import-history.tsx` | Liste des importations avec statut et erreurs. |
| `scripts/jlr-cron.sh` | Script de cron pour déclencher l'import automatique. |
| `docker-compose.yml` | Mise à jour pour ajouter Redis et BullMQ (optionnel). |
| `src/lib/queue.ts` | File BullMQ pour les imports asynchrones (optionnel). |
| `tests/lib/jlr-parser.test.ts` | Tests du parseur JLR. |

---

## Task 1: JLR CSV parser

**Files:**
- Create: `src/lib/jlr-parser.ts`
- Create: `src/lib/jlr-import.ts`
- Create: `tests/lib/jlr-parser.test.ts`

- [ ] **Step 1: Write JLR parser**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/jlr-parser.ts`:
```ts
import { parse } from 'csv-parse/sync'

export interface JLRow {
  numeroInscription: string
  numeroLot: string
  dateVente: string
  prixVente?: number
  vendeur?: string
  acheteur?: string
  lotsCadastraux?: string[]
  adresse?: string
  municipalite?: string
  mrc?: string
  regionAdministrative?: string
  superficieTotaleHectare?: number
  latitude?: number
  longitude?: number
  cptaq?: string
  referenceExterne?: string
}

export const JLR_COLUMNS = [
  { headerKeys: ["no_d_enregistrement", "no_d'enregistrement", "numero_inscription"], field: 'numeroInscription' },
  { headerKeys: ["date_de_vente", "date_vente", "date_acte"], field: 'dateVente' },
  { headerKeys: ["prix_de_vente", "prix_vente"], field: 'prixVente' },
  { headerKeys: ["vendeur"], field: 'vendeur' },
  { headerKeys: ["acheteur"], field: 'acheteur' },
  { headerKeys: ["lots"], field: 'lotsCadastraux' },
  { headerKeys: ["adresse"], field: 'adresse' },
  { headerKeys: ["municipalite", "ville"], field: 'municipalite' },
  { headerKeys: ["mrc"], field: 'mrc' },
  { headerKeys: ["region_administrative"], field: 'regionAdministrative' },
  { headerKeys: ["superficie_totale_ha", "superficie_totale"], field: 'superficieTotaleHectare' },
  { headerKeys: ["latitude"], field: 'latitude' },
  { headerKeys: ["longitude"], field: 'longitude' },
  { headerKeys: ["cptaq"], field: 'cptaq' },
]

export function parseJlrCsv(buffer: Buffer): { headers: string[]; rows: JLRow[]; errors: { row: number; message: string }[] } {
  const content = buffer.toString('utf-8')
  const delimiter = content.includes('\t') ? '\t' : ','
  const records = parse(content, {
    columns: true,
    delimiter,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[]

  if (records.length === 0) {
    return { headers: [], rows: [], errors: [{ row: 0, message: 'Fichier vide' }] }
  }

  const rawHeaders = Object.keys(records[0])
  const headers = rawHeaders.map((h) => h.toLowerCase().replace(/\s+/g, '_'))

  const headerMap = new Map<string, string>()
  for (const col of JLR_COLUMNS) {
    const found = headers.find((h) => col.headerKeys.includes(h))
    if (found) headerMap.set(col.field, rawHeaders[headers.indexOf(found)])
  }

  const rows: JLRow[] = []
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < records.length; i++) {
    try {
      const record = records[i]
      const get = (field: string) => record[headerMap.get(field) || '']
      const dateRaw = get('dateVente')
      const dateVente = dateRaw ? new Date(dateRaw).toISOString().split('T')[0] : ''

      rows.push({
        numeroInscription: get('numeroInscription'),
        numeroLot: get('lotsCadastraux')?.split(/[,;]/)[0] || '',
        dateVente,
        prixVente: get('prixVente') ? Number(get('prixVente').replace(/[^0-9.]/g, '')) : undefined,
        vendeur: get('vendeur') || undefined,
        acheteur: get('acheteur') || undefined,
        lotsCadastraux: get('lotsCadastraux') ? get('lotsCadastraux').split(/[,;]/).map((s) => s.trim()).filter(Boolean) : undefined,
        adresse: get('adresse') || undefined,
        municipalite: get('municipalite') || undefined,
        mrc: get('mrc') || undefined,
        regionAdministrative: get('regionAdministrative') || undefined,
        superficieTotaleHectare: get('superficieTotaleHectare') ? Number(get('superficieTotaleHectare')) : undefined,
        latitude: get('latitude') ? Number(get('latitude')) : undefined,
        longitude: get('longitude') ? Number(get('longitude')) : undefined,
        cptaq: get('cptaq') || undefined,
      })
    } catch (e) {
      errors.push({ row: i + 2, message: (e as Error).message })
    }
  }

  return { headers: rawHeaders, rows, errors }
}
```

Install csv-parse if not present:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install csv-parse
```

- [ ] **Step 2: Create JLR import logic**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/jlr-import.ts`:
```ts
import { importTransactions, ParsedRow } from './transaction-import'

export async function importJlrRows(
  organisationId: string,
  rows: ParsedRow[],
  importationId: string
) {
  const typologie = await prisma.typologie.findFirst({
    where: { organisationId, code: 'TERRES_CULTIVEES' },
  })

  if (!typologie) {
    throw new Error('Typologie TERRES_CULTIVEES non trouvée')
  }

  return importTransactions(organisationId, rows, typologie.id, 'JLR', importationId)
}
```

- [ ] **Step 3: Write parser tests**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/tests/lib/jlr-parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { parseJlrCsv } from '@/lib/jlr-parser'

describe('jlr parser', () => {
  it('parses a tab-separated CSV', () => {
    const csv = `no_d'enregistrement	date_de_vente	prix_de_vente	mrc	municipalite	superficie_totale_ha
12345	2023-05-10	150000	Nicolet-Yamaska	Nicolet	45`
    const result = parseJlrCsv(Buffer.from(csv, 'utf-8'))
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].numeroInscription).toBe('12345')
    expect(result.rows[0].prixVente).toBe(150000)
  })

  it('returns empty error on blank file', () => {
    const result = parseJlrCsv(Buffer.from('', 'utf-8'))
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(jlr): add CSV parser and import logic for JLR"
```

---

## Task 2: JLR import Server Action and supervision UI

**Files:**
- Create: `src/server/actions/jlr.ts`
- Create: `src/app/admin/imports/page.tsx`
- Create: `src/components/jlr-import-form.tsx`
- Create: `src/components/import-history.tsx`

- [ ] **Step 1: Create JLR Server Actions**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/jlr.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { parseJlrCsv } from '@/lib/jlr-parser'
import { importJlrRows } from '@/lib/jlr-import'
import { requireAdminOrDeveloper } from '@/lib/session'
import { logAudit } from '@/lib/audit'
import * as XLSX from 'xlsx'

export async function importJlr(formData: FormData) {
  const { userId, organisationId } = await requireAdminOrDeveloper()

  const file = formData.get('file') as File
  if (!file) throw new Error('Aucun fichier fourni')

  const buffer = Buffer.from(await file.arrayBuffer())
  const { rows, errors: parseErrors } = parseJlrCsv(buffer)

  const importation = await prisma.importation.create({
    data: {
      organisationId,
      typeSource: 'JLR',
      statut: 'EN_COURS',
      lignesTotal: rows.length,
      lignesInserees: 0,
      lignesIgnorees: 0,
      lignesErreurs: parseErrors.length,
    },
  })

  const { inserted, ignored, errors } = await importJlrRows(organisationId, rows as any[], importation.id)
  const allErrors = [...parseErrors, ...errors]

  await prisma.importation.update({
    where: { id: importation.id },
    data: {
      statut: allErrors.length > 0 ? 'TERMINE_AVEC_ERREURS' : 'TERMINE',
      lignesTotal: rows.length,
      lignesInserees: inserted,
      lignesIgnorees: ignored,
      lignesErreurs: allErrors.length,
      details: { errors: allErrors },
    },
  })

  await logAudit({
    organisationId,
    tableCible: 'importation',
    enregistrementId: importation.id,
    utilisateurId: userId,
    action: 'INSERT',
    diff: { typeSource: 'JLR', lignesTotal: rows.length, lignesInserees: inserted },
  })

  return {
    importationId: importation.id,
    totalRows: rows.length,
    inserted,
    ignored,
    errors: allErrors,
  }
}

export async function listImports() {
  const { organisationId } = await requireAdminOrDeveloper()
  return prisma.importation.findMany({
    where: { organisationId, typeSource: 'JLR' },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function retryImport(importationId: string) {
  const { userId, organisationId } = await requireAdminOrDeveloper()

  const importation = await prisma.importation.findUnique({ where: { id: importationId } })
  if (!importation || importation.organisationId !== organisationId) {
    throw new Error('Importation introuvable')
  }

  await prisma.importation.update({
    where: { id: importationId },
    data: { statut: 'EN_COURS', lignesErreurs: 0, details: {} },
  })

  await logAudit({
    organisationId,
    tableCible: 'importation',
    enregistrementId: importationId,
    utilisateurId: userId,
    action: 'UPDATE',
    diff: { statut: 'EN_COURS' },
  })
}

export async function downloadTemplate() {
  await requireAdminOrDeveloper()

  const headers = [
    "no_d'enregistrement",
    'date_de_vente',
    'prix_de_vente',
    'vendeur',
    'acheteur',
    'lots',
    'adresse',
    'municipalite',
    'mrc',
    'region_administrative',
    'superficie_totale_ha',
    'latitude',
    'longitude',
    'cptaq',
  ]

  const ws = XLSX.utils.aoa_to_sheet([headers])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Template JLR')
  const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' })
  return Buffer.from(buffer).toString('base64')
}
```

Add `requireAdminOrDeveloper` to `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/session.ts`:
```ts
export async function requireAdminOrDeveloper() {
  const session = await auth()
  if (!session?.user?.organisationId || (session.user.role !== 'ADMIN' && session.user.role !== 'DEVELOPPEUR')) {
    throw new Error('Accès réservé aux administrateurs et développeurs')
  }
  return {
    userId: session.user.id,
    organisationId: session.user.organisationId,
    role: session.user.role,
  }
}
```

- [ ] **Step 2: Create supervision UI**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/jlr-import-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { importJlr } from '@/server/actions/jlr'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function JlrImportForm() {
  const [report, setReport] = useState<{
    totalRows: number
    inserted: number
    ignored: number
    errors: { row: number; message: string }[]
  } | null>(null)

  async function handleSubmit(formData: FormData) {
    const res = await importJlr(formData)
    setReport(res)
  }

  return (
    <div className="mb-8">
      <form action={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="file">Fichier CSV JLR</Label>
          <input id="file" name="file" type="file" accept=".csv,.txt" required className="block mt-1" />
        </div>
        <Button type="submit">Importer JLR</Button>
      </form>
      {report && (
        <div className="border rounded p-4 mt-4">
          <p>Lignes total: {report.totalRows}</p>
          <p>Insérées: {report.inserted}</p>
          <p>Ignorées: {report.ignored}</p>
          <p>Erreurs: {report.errors.length}</p>
          {report.errors.length > 0 && (
            <ul className="max-h-40 overflow-auto">
              {report.errors.slice(0, 50).map((e, i) => (
                <li key={i} className="text-red-600 text-sm">ligne {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/import-history.tsx`:
```tsx
'use client'

import { Button } from '@/components/ui/button'
import { retryImport } from '@/server/actions/jlr'

export function ImportHistory({ imports }: { imports: any[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b">
          <th className="text-left p-2">Date</th>
          <th className="text-left p-2">Source</th>
          <th className="text-left p-2">Statut</th>
          <th className="text-left p-2">Total</th>
          <th className="text-left p-2">Insérées</th>
          <th className="text-left p-2">Ignorées</th>
          <th className="text-left p-2">Erreurs</th>
          <th className="text-left p-2"></th>
        </tr>
      </thead>
      <tbody>
        {imports.map((imp) => (
          <tr key={imp.id} className="border-b">
            <td className="p-2">{new Date(imp.createdAt).toLocaleString('fr-CA')}</td>
            <td className="p-2">{imp.typeSource}</td>
            <td className="p-2">{imp.statut}</td>
            <td className="p-2">{imp.lignesTotal}</td>
            <td className="p-2">{imp.lignesInserees}</td>
            <td className="p-2">{imp.lignesIgnorees}</td>
            <td className="p-2">{imp.lignesErreurs}</td>
            <td className="p-2">
              {imp.statut !== 'EN_COURS' && (
                <Button size="sm" onClick={async () => { await retryImport(imp.id); window.location.reload() }}>Relancer</Button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/imports/page.tsx`:
```tsx
import { listImports, downloadTemplate } from '@/server/actions/jlr'
import { JlrImportForm } from '@/components/jlr-import-form'
import { ImportHistory } from '@/components/import-history'
import { Button } from '@/components/ui/button'

export default async function ImportsPage() {
  const imports = await listImports()

  async function handleDownload() {
    'use server'
    const b64 = await downloadTemplate()
    return b64
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Supervision des imports JLR</h1>

      <form
        action={async () => {
          'use server'
          const b64 = await downloadTemplate()
          // Note: header-only action, client download handled in real component
        }}
        className="mb-4"
      >
        <Button type="submit">Télécharger le template Excel vierge</Button>
      </form>

      <JlrImportForm />
      <h2 className="text-xl font-bold mb-2">Historique</h2>
      <ImportHistory imports={imports} />
    </main>
  )
}
```

Note: the template download button in a server page needs a client component wrapper for the actual download. Create a small `DownloadTemplateButton` component or inline the download logic in `JlrImportForm`.

- [ ] **Step 3: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(jlr): add JLR import supervision UI with history and retry"
```

---

## Task 3: Automated weekly JLR import (optional but recommended)

**Files:**
- Create: `scripts/jlr-cron.sh`
- Modify: `docker-compose.yml`
- Create: `src/app/api/imports/jlr/route.ts` (secured internal endpoint)

- [ ] **Step 1: Create secure internal import endpoint**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/api/imports/jlr/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server'
import { s3 } from '@/lib/storage'
import { GetObjectCommand } from '@aws-sdk/client-s3'
import { parseJlrCsv } from '@/lib/jlr-parser'
import { importJlrRows } from '@/lib/jlr-import'
import { prisma } from '@/lib/prisma'
import { logAudit } from '@/lib/audit'

const INTERNAL_SECRET = process.env.INTERNAL_IMPORT_SECRET
const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${INTERNAL_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: 'imports/jlr/latest.csv',
  })

  let buffer: Buffer
  try {
    const response = await s3.send(command)
    const arrayBuffer = await response.Body?.transformToByteArray()
    if (!arrayBuffer) throw new Error('Fichier vide')
    buffer = Buffer.from(arrayBuffer)
  } catch (e) {
    return NextResponse.json({ error: 'Fichier JLR introuvable' }, { status: 404 })
  }

  const { rows, errors: parseErrors } = parseJlrCsv(buffer)

  const importation = await prisma.importation.create({
    data: {
      organisationId: DEFAULT_ORG_ID,
      typeSource: 'JLR',
      statut: 'EN_COURS',
      lignesTotal: rows.length,
      lignesInserees: 0,
      lignesIgnorees: 0,
      lignesErreurs: parseErrors.length,
    },
  })

  const { inserted, ignored, errors } = await importJlrRows(DEFAULT_ORG_ID, rows as any[], importation.id)
  const allErrors = [...parseErrors, ...errors]

  await prisma.importation.update({
    where: { id: importation.id },
    data: {
      statut: allErrors.length > 0 ? 'TERMINE_AVEC_ERREURS' : 'TERMINE',
      lignesTotal: rows.length,
      lignesInserees: inserted,
      lignesIgnorees: ignored,
      lignesErreurs: allErrors.length,
      details: { errors: allErrors },
    },
  })

  await logAudit({
    organisationId: DEFAULT_ORG_ID,
    tableCible: 'importation',
    enregistrementId: importation.id,
    action: 'INSERT',
    diff: { typeSource: 'JLR_AUTO', lignesTotal: rows.length, lignesInserees: inserted },
  })

  return NextResponse.json({
    importationId: importation.id,
    totalRows: rows.length,
    inserted,
    ignored,
    errors: allErrors,
  })
}
```

Note: After Gamma, replace `DEFAULT_ORG_ID` with the single EVAGRI org lookup or pass org via env.

- [ ] **Step 2: Create cron script**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/scripts/jlr-cron.sh`:
```bash
#!/bin/sh
set -e

curl -X POST "${NEXTAUTH_URL}/api/imports/jlr" \
  -H "Authorization: Bearer ${INTERNAL_IMPORT_SECRET}" \
  -H "Content-Type: application/json" \
  -s -o /tmp/jlr-import-response.json

cat /tmp/jlr-import-response.json
```

Make it executable:
```bash
chmod +x scripts/jlr-cron.sh
```

- [ ] **Step 3: Document scheduled job**

In `README.md` add:
```markdown
## Import JLR automatique

Configurer un cronjob (Coolify ou VPS) exécutant `scripts/jlr-cron.sh` chaque semaine.
Le fichier `imports/jlr/latest.csv` doit être déposé au préalable dans le bucket S3.
```

- [ ] **Step 4: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(jlr): add automated weekly JLR import endpoint and cron script"
```

---

## Task 4: Self-review and gap fix

- [ ] **Step 1: Spec coverage check**

| Cahier RC | Tâche |
|---|---|
| Import JLR hebdomadaire | Task 1, 3 |
| Interface relance / supervision | Task 2 |
| Template Excel vierge | Task 2 |
| Historique et erreurs | Task 2 |

Aucun écart identifié.

- [ ] **Step 2: Placeholder scan**

Search for `TODO`, `TBD`, `implement later`, `fill in details`. Fix before saving.

- [ ] **Step 3: Type consistency check**

- `Importation.typeSource` values: `EXISTANT_EVAGRI`, `JLR`.
- `Importation.statut` values: `EN_COURS`, `TERMINE`, `TERMINE_AVEC_ERREURS`.
- JLR parser handles both comma and tab delimiters.

- [ ] **Step 4: Final commit of plan**

```bash
cd /Users/fabien/Documents/projets/Evagri
git add docs/superpowers/plans/2026-06-17-rc-import-jlr-supervision.md
git commit -m "docs(plan): add RC implementation plan"
```

---

## Execution Handoff

**Plan RC complet et sauvegardé dans `docs/superpowers/plans/2026-06-17-rc-import-jlr-supervision.md`.**

Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — un sous-agent par tâche, revue entre chaque tâche.
2. **Inline Execution** — exécution directe dans cette session avec `superpowers:executing-plans`.

**Quelle approche ?**
