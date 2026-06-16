# EVAGRI — Vague 1 : Fondations + Données + Exploration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déployer une application web consultable hébergée au Canada, permettant d’importer la base Excel historique EVAGRI et d’explorer les transactions dans un tableau dynamique et sur une carte interactive OSM.

**Architecture:** Application Next.js 15 monolithique en TypeScript, authentifiée via Auth.js, persistante dans PostgreSQL via Prisma. Les imports asynchrones sont gérés par BullMQ/Redis. Le déploiement se fait via Coolify sur un VPS OVHcloud Canada, avec Object Storage OVHcloud Canada pour les backups et fichiers.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, Redis, BullMQ, Auth.js, Leaflet, Docker, Coolify.

---

## File Structure

| File | Responsibility |
|---|---|
| `Dockerfile` | Build multi-stage de l’application Next.js pour production. |
| `docker-compose.yml` | Orchestration locale : app, PostgreSQL, Redis. |
| `.env.example` | Variables d’environnement requises. |
| `prisma/schema.prisma` | Schéma de base de données (entités Vague 1). |
| `src/lib/prisma.ts` | Singleton Prisma Client. |
| `src/lib/auth.ts` | Configuration Auth.js (credentials). |
| `src/lib/redis.ts` | Connexion Redis pour BullMQ. |
| `src/lib/queue.ts` | Déclaration des files BullMQ. |
| `src/lib/storage.ts` | Client S3-compatible pour Object Storage. |
| `src/lib/audit.ts` | Helper d’écriture dans le journal d’audit. |
| `src/lib/excel-import.ts` | Logique d’analyse et de conversion de l’Excel historique. |
| `src/lib/transaction-import.ts` | Insertion des transactions en base. |
| `src/app/layout.tsx` | Layout racine avec providers. |
| `src/app/page.tsx` | Page d’accueil redirige vers login ou tableau. |
| `src/app/login/page.tsx` | Écran de connexion. |
| `src/app/setup/page.tsx` | Écran de setup initial (Organisation + admin). |
| `src/app/admin/import/page.tsx` | Interface d’import Excel. |
| `src/app/admin/users/page.tsx` | Gestion des utilisateurs. |
| `src/app/transactions/page.tsx` | Tableau dynamique des transactions. |
| `src/app/transactions/map/page.tsx` | Carte interactive OSM. |
| `src/components/transaction-table.tsx` | Tableau avec tri, pagination, colonnes masquables. |
| `src/components/transaction-filters.tsx` | Panneau latéral de filtres. |
| `src/components/transaction-map.tsx` | Carte Leaflet avec pins et clustering. |
| `src/components/setup-form.tsx` | Formulaire de setup initial. |
| `src/components/import-report.tsx` | Affichage du rapport d’import. |
| `src/server/actions/auth.ts` | Server Actions auth (login, setup, invitation). |
| `src/server/actions/transaction.ts` | Server Actions recherche/pagination transactions. |
| `src/server/actions/import.ts` | Server Actions d’import Excel. |
| `tests/lib/excel-import.test.ts` | Tests du mapping Excel. |
| `tests/server/transaction.test.ts` | Tests des Server Actions transaction. |
| `scripts/backup.sh` | Script pg_dump vers Object Storage. |
| `scripts/restore.sh` | Script restore depuis Object Storage. |

---

## Database Schema (Vague 1 subset)

```prisma
model Organisation {
  id        String   @id @default(uuid())
  nom       String
  actif     Boolean  @default(true)
  createdAt DateTime @default(now()) @map("date_creation")

  utilisateurs Utilisateur[]
  transactions TransactionSource[]
  champs       ChampEnrichissable[]
  filtre       FiltreRecherche[]
  vues         VueFicheEvaluation[]

  @@map("organisation")
}

model Utilisateur {
  id                      String    @id @default(uuid())
  organisationId          String    @map("id_organisation")
  email                   String
  nom                     String?
  role                    String
  passwordHash            String    @map("mot_de_passe")
  consentementPolitiqueAt DateTime? @map("consentement_politique_date")
  actif                   Boolean   @default(true)
  createdAt               DateTime  @default(now()) @map("date_creation")

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@unique([organisationId, email])
  @@map("utilisateur")
}

model TransactionSource {
  id                    String    @id @default(uuid())
  organisationId        String    @map("id_organisation")
  importationId         String?   @map("id_importation")
  systemeSource           String    @map("systeme_source")
  referenceExterne        String?   @map("reference_externe")
  numeroInscription       String    @map("numero_inscription")
  numeroLot               String    @map("numero_lot")
  dateVente               DateTime  @map("date_vente") @db.Date
  prixVente               Decimal?  @map("prix_vente") @db.Decimal(15, 2)
  vendeur                 String?
  acheteur                String?
  lotsCadastraux          String[]  @map("lots_cadastraux")
  adresse                 String?
  municipalite            String?
  mrc                     String?
  regionAdministrative    String?   @map("region_administrative")
  superficieTotaleHectare Decimal?  @map("superficie_totale_hectare") @db.Decimal(12, 4)
  latitude                Decimal?  @db.Decimal(10, 8)
  longitude               Decimal?  @db.Decimal(11, 8)
  zoneAgricole             String?   @map("zone_agricole")
  presenceBatiment        Boolean?  @map("presence_batiment")
  estErabliere            Boolean?  @map("est_erabliere")
  cptaq                   String?
  createdAt               DateTime  @default(now()) @map("date_creation")

  organisation Organisation @relation(fields: [organisationId], references: [id])
  enrichie     TransactionEnrichie?

  @@unique([organisationId, numeroInscription, dateVente])
  @@map("transaction_source")
}

model Typologie {
  id              String    @id @default(uuid())
  organisationId  String    @map("id_organisation")
  code            String
  nom             String
  parentId        String?   @map("id_type_parent")
  estTypeMere     Boolean   @default(false) @map("est_type_mere")
  estFeuille      Boolean   @default(true) @map("est_feuille")
  ordre           Int       @default(0)
  actif           Boolean   @default(true)

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@unique([organisationId, code])
  @@map("typologie")
}

model TransactionEnrichie {
  id                  String    @id @default(uuid())
  organisationId      String    @map("id_organisation")
  transactionSourceId String    @unique @map("id_transaction_source")
  statut              String    @default("NON_ANALYSEE")
  contributeurId      String?   @map("id_contributeur")
  dateStatut          DateTime? @map("date_statut")
  createdAt           DateTime  @default(now()) @map("date_creation")
  updatedAt           DateTime  @updatedAt @map("date_modification")

  transactionSource TransactionSource @relation(fields: [transactionSourceId], references: [id])
  organisation      Organisation      @relation(fields: [organisationId], references: [id])

  @@map("transaction_enrichie")
}

model ChampEnrichissable {
  id               String   @id @default(uuid())
  organisationId   String   @map("id_organisation")
  codeMachine        String   @map("code_machine")
  nomAffichage       String   @map("nom_affichage")
  typeDonnees        String   @map("type_donnees")
  nature             String
  unite              String   @default("N/A")
  plageMin           Decimal? @map("plage_min") @db.Decimal(18, 4)
  plageMax           Decimal? @map("plage_max") @db.Decimal(18, 4)
  optionsListe       Json?    @map("options_liste")
  regleCalcul        String?  @map("regle_calcul")
  applicableATypes   Json     @map("applicable_a_types")
  ordreAffichage     Int      @default(0) @map("ordre_affichage")
  estAffiche         Boolean  @default(true) @map("est_affiche")
  estObligatoire     Boolean  @default(false) @map("est_obligatoire")
  estModifiable      Boolean  @default(true) @map("est_modifiable")
  actif              Boolean  @default(true)

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@unique([organisationId, codeMachine])
  @@map("champ_enrichissable")
}

model FiltreRecherche {
  id                   String   @id @default(uuid())
  organisationId       String   @map("id_organisation")
  champEnrichissableId String?  @map("id_champ_enrichissable")
  nomFiltre            String   @map("nom_filtre")
  typeFiltre           String   @map("type_filtre")
  operateursDisponibles Json?   @map("operateurs_disponibles")
  ordreAffichage       Int      @default(0) @map("ordre_affichage")
  estActif             Boolean  @default(true) @map("est_actif")
  applicableATypes     Json?    @map("applicable_a_types")

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@map("filtre_recherche")
}

model VueFicheEvaluation {
  id             String   @id @default(uuid())
  organisationId String   @map("id_organisation")
  typeVue        String   @map("type_vue")
  contenu        Json

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@map("vue_fiche_evaluation")
}

model Importation {
  id              String    @id @default(uuid())
  organisationId  String    @map("id_organisation")
  typeSource      String    @map("type_source")
  statut          String
  lignesTotal     Int       @map("lignes_total")
  lignesInserees  Int       @map("lignes_inserees")
  lignesIgnorees  Int       @map("lignes_ignorees")
  lignesErreurs   Int       @map("lignes_erreurs")
  details         Json?
  createdAt       DateTime  @default(now()) @map("date_creation")

  @@map("importation")
}

model JournalAudit {
  id              String    @id @default(uuid())
  organisationId  String    @map("id_organisation")
  tableCible      String    @map("table_cible")
  enregistrementId String?  @map("id_enregistrement")
  utilisateurId   String?   @map("id_utilisateur")
  action          String
  diff            Json?
  adresseIp       String?   @map("adresse_ip")
  createdAt       DateTime  @default(now()) @map("date_action")

  @@map("journal_audit")
}
```

---

## Task 1: Initialize Next.js project with Docker

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `package.json`
- Create: `next.config.js`
- Create: `tsconfig.json`
- Create: `tailwind.config.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`

- [ ] **Step 1: Generate Next.js 15 project with shadcn**

Run:
```bash
mkdir -p /Users/fabien/Documents/projets/Evagri/app
cd /Users/fabien/Documents/projets/Evagri/app
echo "my-app" | npx shadcn@latest init --yes --template next --base-color stone
```
Expected: project scaffolded in `/Users/fabien/Documents/projets/Evagri/app/my-app`.

- [ ] **Step 2: Write Dockerfile**

Create `Dockerfile`:
```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Enable standalone output in next.config.js**

Modify `next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}
module.exports = nextConfig
```

- [ ] **Step 4: Write docker-compose.yml**

Create `docker-compose.yml`:
```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://evagri:evagri@db:5432/evagri
      - REDIS_URL=redis://redis:6379
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_REGION=${S3_REGION:-ca-central-1}
      - S3_BUCKET=${S3_BUCKET}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
    depends_on:
      - db
      - redis

  db:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=evagri
      - POSTGRES_PASSWORD=evagri
      - POSTGRES_DB=evagri
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pgdata:
```

- [ ] **Step 5: Write .env.example**

Create `.env.example`:
```
DATABASE_URL=postgresql://evagri:evagri@localhost:5432/evagri
REDIS_URL=redis://localhost:6379
NEXTAUTH_SECRET=change_me_to_random_32_chars
NEXTAUTH_URL=http://localhost:3000
S3_ENDPOINT=https://s3.ca-central-1.ovhcloud.com
S3_REGION=ca-central-1
S3_BUCKET=evagri-prod
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
```

- [ ] **Step 6: Build and run locally**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
docker compose up --build -d
```
Expected: app reachable at `http://localhost:3000`.

- [ ] **Step 7: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "chore: init Next.js 15 project with Docker and shadcn"
```

---

## Task 2: Setup Prisma schema and database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Modify: `package.json`
- Modify: `.env`

- [ ] **Step 1: Install Prisma**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install prisma @prisma/client
npx prisma init
```
Expected: `prisma/schema.prisma` and `.env` created.

- [ ] **Step 2: Write Prisma schema**

Replace `prisma/schema.prisma` with the schema defined in the **Database Schema** section above.

- [ ] **Step 3: Create Prisma singleton**

Create `src/lib/prisma.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 4: Add prisma scripts**

Modify `package.json` scripts:
```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "db:migrate": "prisma migrate dev",
    "db:generate": "prisma generate",
    "db:studio": "prisma studio",
    "db:seed": "tsx prisma/seed.ts"
  }
}
```

- [ ] **Step 5: Run initial migration**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npx prisma migrate dev --name init
```
Expected: migration created, database tables present.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(db): add Prisma schema for MVP entities"
```

---

## Task 3: Setup Auth.js and initial setup flow

**Files:**
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/setup/page.tsx`
- Create: `src/components/setup-form.tsx`
- Create: `src/server/actions/setup.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/components/login-form.tsx`
- Create: `src/server/actions/auth.ts`
- Create: `src/middleware.ts`

- [ ] **Step 1: Install auth dependencies**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Configure Auth.js with credentials**

Create `src/lib/auth.ts`:
```ts
import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null
        const user = await prisma.utilisateur.findFirst({
          where: { email: credentials.email as string, actif: true },
          include: { organisation: true },
        })
        if (!user) return null
        const valid = await bcrypt.compare(credentials.password as string, user.passwordHash)
        if (!valid) return null
        return {
          id: user.id,
          email: user.email,
          name: user.nom,
          role: user.role,
          organisationId: user.organisationId,
        }
      },
    }),
  ],
  callbacks: {
    session: async ({ session, token }) => {
      if (token.sub) {
        session.user.id = token.sub
        session.user.role = token.role as string
        session.user.organisationId = token.organisationId as string
      }
      return session
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role
        token.organisationId = user.organisationId
      }
      return token
    },
  },
  pages: {
    signIn: '/login',
  },
})
```

- [ ] **Step 3: Create API route**

Create `src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 4: Create setup Server Action**

Create `src/server/actions/setup.ts`:
```ts
'use server'

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signIn } from '@/lib/auth'

export async function createInitialOrganisationAndAdmin(formData: FormData) {
  const existingOrg = await prisma.organisation.findFirst()
  if (existingOrg) {
    throw new Error('Setup already completed')
  }

  const orgName = formData.get('orgName') as string
  const adminEmail = formData.get('adminEmail') as string
  const adminName = formData.get('adminName') as string
  const adminPassword = formData.get('adminPassword') as string

  if (!orgName || !adminEmail || !adminPassword) {
    throw new Error('Missing required fields')
  }

  const organisation = await prisma.organisation.create({
    data: { nom: orgName },
  })

  const passwordHash = await bcrypt.hash(adminPassword, 12)

  const admin = await prisma.utilisateur.create({
    data: {
      organisationId: organisation.id,
      email: adminEmail,
      nom: adminName,
      role: 'ADMIN',
      passwordHash,
      consentementPolitiqueAt: new Date(),
    },
  })

  await prisma.journalAudit.create({
    data: {
      organisationId: organisation.id,
      tableCible: 'utilisateur',
      enregistrementId: admin.id,
      action: 'INSERT',
      diff: { email: adminEmail, role: 'ADMIN' },
    },
  })

  await signIn('credentials', {
    email: adminEmail,
    password: adminPassword,
    redirectTo: '/transactions',
  })
}
```

- [ ] **Step 5: Create setup form component**

Create `src/components/setup-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { createInitialOrganisationAndAdmin } from '@/server/actions/setup'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function SetupForm() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    try {
      await createInitialOrganisationAndAdmin(formData)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <Label htmlFor="orgName">Nom de l’organisation</Label>
        <Input id="orgName" name="orgName" required />
      </div>
      <div>
        <Label htmlFor="adminName">Nom de l’administrateur</Label>
        <Input id="adminName" name="adminName" />
      </div>
      <div>
        <Label htmlFor="adminEmail">Courriel</Label>
        <Input id="adminEmail" name="adminEmail" type="email" required />
      </div>
      <div>
        <Label htmlFor="adminPassword">Mot de passe</Label>
        <Input id="adminPassword" name="adminPassword" type="password" required />
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <Button type="submit">Créer l’organisation</Button>
    </form>
  )
}
```

- [ ] **Step 6: Create setup page**

Create `src/app/setup/page.tsx`:
```tsx
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import { SetupForm } from '@/components/setup-form'

export default async function SetupPage() {
  const existing = await prisma.organisation.findFirst()
  if (existing) {
    redirect('/login')
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Configuration initiale EVAGRI</h1>
      <SetupForm />
    </main>
  )
}
```

- [ ] **Step 7: Create login form and page**

Create `src/server/actions/auth.ts`:
```ts
'use server'

import { signIn } from '@/lib/auth'

export async function login(formData: FormData) {
  await signIn('credentials', {
    email: formData.get('email') as string,
    password: formData.get('password') as string,
    redirectTo: '/transactions',
  })
}
```

Create `src/components/login-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { login } from '@/server/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    try {
      await login(formData)
    } catch {
      setError('Identifiants invalides')
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <Label htmlFor="email">Courriel</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="password">Mot de passe</Label>
        <Input id="password" name="password" type="password" required />
      </div>
      {error && <p className="text-red-600">{error}</p>}
      <Button type="submit">Se connecter</Button>
    </form>
  )
}
```

Create `src/app/login/page.tsx`:
```tsx
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Connexion EVAGRI</h1>
      <LoginForm />
    </main>
  )
}
```

- [ ] **Step 8: Create middleware to guard pages**

Create `src/middleware.ts`:
```ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const isSetupPage = nextUrl.pathname === '/setup'
  const isLoginPage = nextUrl.pathname === '/login'
  const isApiAuthRoute = nextUrl.pathname.startsWith('/api/auth')

  if (isApiAuthRoute) return NextResponse.next()

  if (!isLoggedIn && !isLoginPage && !isSetupPage) {
    return NextResponse.redirect(new URL('/login', nextUrl))
  }

  if (isLoggedIn && isLoginPage) {
    return NextResponse.redirect(new URL('/transactions', nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
}
```

- [ ] **Step 9: Add shadcn/ui components**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npx shadcn@latest add button input label
```

- [ ] **Step 10: Add types for next-auth session**

Create `src/types/next-auth.d.ts`:
```ts
import NextAuth from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      organisationId: string
    }
  }

  interface User {
    role: string
    organisationId: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    organisationId: string
  }
}
```

- [ ] **Step 11: Test setup and login**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm run build
docker compose up -d
```
Open `http://localhost:3000/setup`, create organisation, verify redirect to `/transactions`.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat(auth): add Auth.js credentials, setup flow and middleware"
```

---

## Task 4: Seed default typologies and create user management UI

**Files:**
- Create: `prisma/seed.ts`
- Create: `src/server/actions/users.ts`
- Create: `src/app/admin/users/page.tsx`
- Create: `src/components/users-table.tsx`
- Create: `src/components/invite-user-form.tsx`

- [ ] **Step 1: Create seed script**

Create `prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const org = await prisma.organisation.findFirst()
  if (!org) {
    console.log('No organisation found, skipping seed.')
    return
  }

  const defaults = [
    { code: 'TERRES_CULTIVEES', nom: 'Terres cultivées', ordre: 1 },
    { code: 'TERRES_BOISEES', nom: 'Terres boisées', ordre: 2 },
    { code: 'ERABLIERES', nom: 'Érablières', ordre: 3 },
    { code: 'BATIMENTS_AGRICOLES', nom: 'Bâtiments agricoles', ordre: 4 },
    { code: 'FERME', nom: 'Ferme', ordre: 5 },
  ]

  for (const t of defaults) {
    await prisma.typologie.upsert({
      where: { organisationId_code: { organisationId: org.id, code: t.code } },
      update: {},
      create: { organisationId: org.id, ...t, estFeuille: true },
    })
  }

  console.log('Default typologies seeded.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 2: Add seed command and run**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install -D tsx
npm run db:seed
```
Expected: default typologies created.

- [ ] **Step 3: Create user Server Actions**

Create `src/server/actions/users.ts`:
```ts
'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function listUsers() {
  const session = await auth()
  if (!session?.user?.organisationId) throw new Error('Unauthorized')

  return prisma.utilisateur.findMany({
    where: { organisationId: session.user.organisationId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function inviteUser(formData: FormData) {
  const session = await auth()
  if (!session?.user?.organisationId || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  const email = formData.get('email') as string
  const name = formData.get('name') as string
  const role = formData.get('role') as string
  const tempPassword = Math.random().toString(36).slice(-10)
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  const user = await prisma.utilisateur.create({
    data: {
      organisationId: session.user.organisationId,
      email,
      nom: name,
      role,
      passwordHash,
    },
  })

  await prisma.journalAudit.create({
    data: {
      organisationId: session.user.organisationId,
      tableCible: 'utilisateur',
      enregistrementId: user.id,
      utilisateurId: session.user.id,
      action: 'INSERT',
      diff: { email, role },
    },
  })

  revalidatePath('/admin/users')
  return { tempPassword }
}
```

- [ ] **Step 4: Create invite user form**

Create `src/components/invite-user-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { inviteUser } from '@/server/actions/users'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function InviteUserForm() {
  const [result, setResult] = useState<{ tempPassword: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    try {
      const res = await inviteUser(formData)
      setResult(res)
      setError(null)
    } catch (e) {
      setError((e as Error).message)
      setResult(null)
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4 mb-8 max-w-md">
      <div>
        <Label htmlFor="email">Courriel</Label>
        <Input id="email" name="email" type="email" required />
      </div>
      <div>
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" />
      </div>
      <div>
        <Label htmlFor="role">Rôle</Label>
        <select id="role" name="role" className="w-full border rounded p-2" required>
          <option value="EVALUATEUR">Évaluateur</option>
          <option value="ADMIN">Administrateur</option>
          <option value="DEVELOPPEUR">Développeur</option>
        </select>
      </div>
      {error && <p className="text-red-600">{error}</p>}
      {result && (
        <p className="text-green-700">
          Utilisateur invité. Mot de passe temporaire : <strong>{result.tempPassword}</strong>
        </p>
      )}
      <Button type="submit">Inviter</Button>
    </form>
  )
}
```

- [ ] **Step 5: Create users page**

Create `src/app/admin/users/page.tsx`:
```tsx
import { listUsers } from '@/server/actions/users'
import { UsersTable } from '@/components/users-table'
import { InviteUserForm } from '@/components/invite-user-form'

export default async function UsersPage() {
  const users = await listUsers()

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Gestion des utilisateurs</h1>
      <InviteUserForm />
      <UsersTable users={users} />
    </main>
  )
}
```

- [ ] **Step 6: Create users table component**

Create `src/components/users-table.tsx`:
```tsx
import { Utilisateur } from '@prisma/client'

export function UsersTable({ users }: { users: Utilisateur[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b">
          <th className="text-left p-2">Nom</th>
          <th className="text-left p-2">Courriel</th>
          <th className="text-left p-2">Rôle</th>
          <th className="text-left p-2">Actif</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b">
            <td className="p-2">{u.nom}</td>
            <td className="p-2">{u.email}</td>
            <td className="p-2">{u.role}</td>
            <td className="p-2">{u.actif ? 'Oui' : 'Non'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(users): add user invitation and admin users list"
```

---

## Task 5: Build Excel import engine

**Files:**
- Create: `src/lib/excel-parser.ts`
- Create: `src/lib/transaction-import.ts`
- Create: `tests/lib/excel-parser.test.ts`
- Create: `src/server/actions/import.ts`
- Create: `src/app/admin/import/page.tsx`
- Create: `src/components/import-excel-form.tsx`

- [ ] **Step 1: Install Excel parsing library**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install xlsx
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 2: Add vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    globals: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

- [ ] **Step 3: Add vitest script**

Modify `package.json`:
```json
{
  "scripts": {
    "test": "vitest"
  }
}
```

- [ ] **Step 4: Define sheet mapping configuration**

Create `src/lib/excel-parser.ts`:
```ts
import * as XLSX from 'xlsx'

export const SHEET_MAPPING: Record<string, { typologieCode: string; typologieNom: string }> = {
  'Terre': { typologieCode: 'TERRES_CULTIVEES', typologieNom: 'Terres cultivées' },
  'Bois': { typologieCode: 'TERRES_BOISEES', typologieNom: 'Terres boisées' },
  'Ventes erablière': { typologieCode: 'ERABLIERES', typologieNom: 'Érablières' },
}

export const SOURCE_COLUMNS = [
  { headerKeys: ["No d'enr.", "No d'enregistrement", 'No d\'enr.'], field: 'numeroInscription' },
  { headerKeys: ['MLS', '# MLS', '#vente'], field: 'referenceExterne' },
  { headerKeys: ["Date de l'acte ou de l'avant contrat", "Date de L'acte"], field: 'dateVente' },
  { headerKeys: ['Vendeur'], field: 'vendeur' },
  { headerKeys: ['Acheteur'], field: 'acheteur' },
  { headerKeys: ['Lots'], field: 'lotsCadastraux' },
  { headerKeys: ['Prixdevente($)', 'Prix de vente ($)', 'Prix de vente'], field: 'prixVente' },
  { headerKeys: ['MRC'], field: 'mrc' },
  { headerKeys: ['Ville/Municipalité'], field: 'municipalite' },
  { headerKeys: ['Adresse complète', 'Adresse complette'], field: 'adresse' },
  { headerKeys: ['Latitude'], field: 'latitude' },
  { headerKeys: ['Longitude'], field: 'longitude' },
  { headerKeys: ['Superficie totale (ha)', 'Superficie Totale (ha)'], field: 'superficieTotaleHectare' },
  { headerKeys: ['Région administrative'], field: 'regionAdministrative' },
  { headerKeys: ['CPTAQ'], field: 'cptaq' },
]

export function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const results: { sheet: string; rows: Record<string, unknown>[]; typologieCode: string }[] = []

  for (const sheetName of workbook.SheetNames) {
    const mapping = SHEET_MAPPING[sheetName]
    if (!mapping) continue

    const worksheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null })
    results.push({ sheet: sheetName, rows: json, typologieCode: mapping.typologieCode })
  }

  return results
}

export function findHeaderIndex(headers: (string | null)[], headerKeys: string[]): number {
  for (const key of headerKeys) {
    const idx = headers.findIndex((h) => h?.trim().toLowerCase() === key.toLowerCase())
    if (idx !== -1) return idx
  }
  return -1
}
```

- [ ] **Step 5: Write test for Excel parser**

Create `tests/lib/excel-parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SHEET_MAPPING, parseWorkbook } from '@/lib/excel-parser'

describe('excel parser', () => {
  it('maps known sheets', () => {
    expect(SHEET_MAPPING['Terre'].typologieCode).toBe('TERRES_CULTIVEES')
  })

  it('parses a minimal workbook', () => {
    const data = [
      ['No d\'enr.', 'Date de l\'acte ou de l\'avant contrat', 'Prixdevente($)', 'MRC'],
      [123, '2023-01-15', 50000, 'Nicolet-Yamaska'],
    ]
    const ws = {
      '!ref': 'A1:D2',
      A1: { t: 's', v: data[0][0] },
      B1: { t: 's', v: data[0][1] },
      C1: { t: 's', v: data[0][2] },
      D1: { t: 's', v: data[0][3] },
      A2: { t: 'n', v: data[1][0] },
      B2: { t: 's', v: data[1][1] },
      C2: { t: 'n', v: data[1][2] },
      D2: { t: 's', v: data[1][3] },
    }
    const wb = {
      SheetNames: ['Terre'],
      Sheets: { Terre: ws },
    }

    const parsed = parseWorkbook(XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as unknown as ArrayBuffer)
    expect(parsed).toHaveLength(1)
    expect(parsed[0].typologieCode).toBe('TERRES_CULTIVEES')
    expect(parsed[0].rows).toHaveLength(1)
  })
})
```

Note: adjust the test if the XLSX write helper is awkward; instead build a real minimal `.xlsx` file in `tests/fixtures/minimal.xlsx`.

- [ ] **Step 6: Create fixture file for tests**

Place `tests/fixtures/minimal.xlsx` with one row per sheet (`Terre`, `Bois`, `Ventes erablière`) containing at least the source columns.

- [ ] **Step 7: Update test to read fixture**

Modify `tests/lib/excel-parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseWorkbook } from '@/lib/excel-parser'

const fixture = readFileSync(join(__dirname, '../fixtures/minimal.xlsx'))

describe('excel parser', () => {
  it('parses fixture with all sheets', () => {
    const parsed = parseWorkbook(fixture)
    expect(parsed).toHaveLength(3)
    expect(parsed[0].rows.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 8: Create transaction import logic**

Create `src/lib/transaction-import.ts`:
```ts
import { prisma } from '@/lib/prisma'

export interface ParsedRow {
  numeroInscription: string
  referenceExterne?: string
  dateVente: string
  vendeur?: string
  acheteur?: string
  lotsCadastraux?: string[]
  prixVente?: number
  mrc?: string
  municipalite?: string
  adresse?: string
  latitude?: number
  longitude?: number
  superficieTotaleHectare?: number
  regionAdministrative?: string
  cptaq?: string
}

export async function importTransactions(
  organisationId: string,
  rows: ParsedRow[],
  typologieId: string,
  systemeSource: string,
  importationId: string
) {
  let inserted = 0
  let ignored = 0
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    try {
      if (!row.numeroInscription || !row.dateVente) {
        throw new Error('Missing numeroInscription or dateVente')
      }

      const dateVente = new Date(row.dateVente)
      if (isNaN(dateVente.getTime())) {
        throw new Error(`Invalid date: ${row.dateVente}`)
      }

      const existing = await prisma.transactionSource.findUnique({
        where: {
          organisationId_numeroInscription_dateVente: {
            organisationId,
            numeroInscription: String(row.numeroInscription).trim(),
            dateVente,
          },
        },
      })

      if (existing) {
        ignored++
        continue
      }

      await prisma.transactionSource.create({
        data: {
          organisationId,
          importationId,
          systemeSource,
          referenceExterne: row.referenceExterne,
          numeroInscription: String(row.numeroInscription).trim(),
          numeroLot: String(row.lotsCadastraux?.[0] ?? ''),
          dateVente,
          prixVente: row.prixVente ? Number(row.prixVente) : null,
          vendeur: row.vendeur,
          acheteur: row.acheteur,
          lotsCadastraux: row.lotsCadastraux ?? [],
          adresse: row.adresse,
          municipalite: row.municipalite,
          mrc: row.mrc,
          regionAdministrative: row.regionAdministrative,
          superficieTotaleHectare: row.superficieTotaleHectare ? Number(row.superficieTotaleHectare) : null,
          latitude: row.latitude ? Number(row.latitude) : null,
          longitude: row.longitude ? Number(row.longitude) : null,
          cptaq: row.cptaq,
          estErabliere: false,
          presenceBatiment: false,
        },
      })

      inserted++
    } catch (e) {
      errors.push({ row: i + 2, message: (e as Error).message })
    }
  }

  return { inserted, ignored, errors }
}
```

- [ ] **Step 9: Create import Server Action**

Create `src/server/actions/import.ts`:
```ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { parseWorkbook } from '@/lib/excel-parser'
import { importTransactions } from '@/lib/transaction-import'

export async function importExcel(formData: FormData) {
  const session = await auth()
  if (!session?.user?.organisationId || session.user.role !== 'ADMIN') {
    throw new Error('Unauthorized')
  }

  const file = formData.get('file') as File
  if (!file) throw new Error('No file provided')

  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = parseWorkbook(buffer)

  const importation = await prisma.importation.create({
    data: {
      organisationId: session.user.organisationId,
      typeSource: 'EXISTANT_EVAGRI',
      statut: 'EN_COURS',
      lignesTotal: 0,
      lignesInserees: 0,
      lignesIgnorees: 0,
      lignesErreurs: 0,
    },
  })

  let totalRows = 0
  let totalInserted = 0
  let totalIgnored = 0
  const allErrors: { sheet: string; row: number; message: string }[] = []

  for (const sheet of parsed) {
    const typologie = await prisma.typologie.findUnique({
      where: {
        organisationId_code: {
          organisationId: session.user.organisationId,
          code: sheet.typologieCode,
        },
      },
    })

    if (!typologie) continue

    const rows = sheet.rows as any[]
    totalRows += rows.length

    const { inserted, ignored, errors } = await importTransactions(
      session.user.organisationId,
      rows,
      typologie.id,
      'EXISTANT_EVAGRI',
      importation.id
    )

    totalInserted += inserted
    totalIgnored += ignored
    allErrors.push(...errors.map((e) => ({ ...e, sheet: sheet.sheet })))
  }

  await prisma.importation.update({
    where: { id: importation.id },
    data: {
      statut: allErrors.length > 0 ? 'TERMINE_AVEC_ERREURS' : 'TERMINE',
      lignesTotal: totalRows,
      lignesInserees: totalInserted,
      lignesIgnorees: totalIgnored,
      lignesErreurs: allErrors.length,
      details: { errors: allErrors },
    },
  })

  await prisma.journalAudit.create({
    data: {
      organisationId: session.user.organisationId,
      tableCible: 'importation',
      enregistrementId: importation.id,
      utilisateurId: session.user.id,
      action: 'INSERT',
      diff: { lignesTotal: totalRows, lignesInserees: totalInserted },
    },
  })

  return {
    importationId: importation.id,
    totalRows,
    inserted: totalInserted,
    ignored: totalIgnored,
    errors: allErrors,
  }
}
```

- [ ] **Step 10: Create import UI**

Create `src/components/import-excel-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { importExcel } from '@/server/actions/import'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function ImportExcelForm() {
  const [report, setReport] = useState<{
    totalRows: number
    inserted: number
    ignored: number
    errors: { sheet: string; row: number; message: string }[]
  } | null>(null)

  async function handleSubmit(formData: FormData) {
    const res = await importExcel(formData)
    setReport(res)
  }

  return (
    <div>
      <form action={handleSubmit} className="space-y-4 mb-8">
        <div>
          <Label htmlFor="file">Fichier Excel EVAGRI</Label>
          <input id="file" name="file" type="file" accept=".xlsx" required />
        </div>
        <Button type="submit">Importer</Button>
      </form>
      {report && (
        <div className="border rounded p-4">
          <p>Lignes total: {report.totalRows}</p>
          <p>Insérées: {report.inserted}</p>
          <p>Ignorées (doublons): {report.ignored}</p>
          <p>Erreurs: {report.errors.length}</p>
          {report.errors.length > 0 && (
            <ul className="mt-2 max-h-40 overflow-auto">
              {report.errors.slice(0, 20).map((e, i) => (
                <li key={i} className="text-red-600 text-sm">
                  {e.sheet} ligne {e.row}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 11: Create import page**

Create `src/app/admin/import/page.tsx`:
```tsx
import { ImportExcelForm } from '@/components/import-excel-form'

export default function ImportPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Import des données historiques</h1>
      <ImportExcelForm />
    </main>
  )
}
```

- [ ] **Step 12: Run parser tests**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm run test
```
Expected: tests pass.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(import): add Excel parser and historical data import"
```

---

## Task 6: Build transaction table with filters

**Files:**
- Create: `src/server/actions/transaction.ts`
- Create: `src/components/transaction-table.tsx`
- Create: `src/components/transaction-filters.tsx`
- Create: `src/app/transactions/page.tsx`
- Create: `src/lib/search.ts`

- [ ] **Step 1: Create transaction search Server Action**

Create `src/server/actions/transaction.ts`:
```ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function searchTransactions(input: {
  page?: number
  pageSize?: number
  query?: string
  filters?: { field: string; operator: string; value: string }[]
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}) {
  const session = await auth()
  if (!session?.user?.organisationId) throw new Error('Unauthorized')

  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 10
  const where: any = { organisationId: session.user.organisationId }

  if (input.query) {
    where.OR = [
      { numeroInscription: { contains: input.query, mode: 'insensitive' } },
      { vendeur: { contains: input.query, mode: 'insensitive' } },
      { acheteur: { contains: input.query, mode: 'insensitive' } },
      { municipalite: { contains: input.query, mode: 'insensitive' } },
    ]
  }

  const [transactions, total] = await Promise.all([
    prisma.transactionSource.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { [input.sortField ?? 'dateVente']: input.sortOrder ?? 'desc' },
      include: { enrichie: true },
    }),
    prisma.transactionSource.count({ where }),
  ])

  return { transactions, total, page, pageSize, totalPages: Math.ceil(total / pageSize) }
}
```

- [ ] **Step 2: Create reusable table component**

Create `src/components/transaction-table.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { TransactionSource, TransactionEnrichie } from '@prisma/client'
import { Button } from '@/components/ui/button'

type TransactionWithEnrichie = TransactionSource & { enrichie: TransactionEnrichie | null }

const COLUMNS = [
  { key: 'numeroInscription', label: "N° d'inscription" },
  { key: 'numeroLot', label: 'Lot' },
  { key: 'dateVente', label: 'Date' },
  { key: 'mrc', label: 'MRC' },
  { key: 'municipalite', label: 'Municipalité' },
  { key: 'superficieTotaleHectare', label: 'Superficie (ha)' },
  { key: 'prixVente', label: 'Prix ($)' },
  { key: 'statut', label: 'Statut' },
]

export function TransactionTable({
  initialData,
}: {
  initialData: {
    transactions: TransactionWithEnrichie[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
}) {
  const [data, setData] = useState(initialData)
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([])
  const [sortField, setSortField] = useState('dateVente')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)

  async function loadPage(newPage: number) {
    const res = await fetch(
      `/api/transactions?page=${newPage}&sortField=${sortField}&sortOrder=${sortOrder}`
    )
    const json = await res.json()
    setData(json)
    setPage(newPage)
  }

  function toggleColumn(key: string) {
    setHiddenColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function handleSort(key: string) {
    if (sortField === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(key)
      setSortOrder('asc')
    }
    loadPage(1)
  }

  return (
    <div>
      <div className="flex gap-2 mb-4 flex-wrap">
        {COLUMNS.map((col) => (
          <label key={col.key} className="flex items-center gap-1 text-sm">
            <input
              type="checkbox"
              checked={!hiddenColumns.includes(col.key)}
              onChange={() => toggleColumn(col.key)}
            />
            {col.label}
          </label>
        ))}
      </div>
      <div className="overflow-auto" style={{ maxHeight: '60vh' }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              {COLUMNS.filter((c) => !hiddenColumns.includes(c.key)).map((col) => (
                <th
                  key={col.key}
                  className="text-left p-2 cursor-pointer"
                  onClick={() => handleSort(col.key)}
                >
                  {col.label} {sortField === col.key ? (sortOrder === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.transactions.map((t) => (
              <tr key={t.id} className="border-b hover:bg-stone-50">
                {!hiddenColumns.includes('numeroInscription') && (
                  <td className="p-2">{t.numeroInscription}</td>
                )}
                {!hiddenColumns.includes('numeroLot') && <td className="p-2">{t.numeroLot}</td>}
                {!hiddenColumns.includes('dateVente') && (
                  <td className="p-2">{new Date(t.dateVente).toLocaleDateString('fr-CA')}</td>
                )}
                {!hiddenColumns.includes('mrc') && <td className="p-2">{t.mrc}</td>}
                {!hiddenColumns.includes('municipalite') && <td className="p-2">{t.municipalite}</td>}
                {!hiddenColumns.includes('superficieTotaleHectare') && (
                  <td className="p-2">{t.superficieTotaleHectare?.toString()}</td>
                )}
                {!hiddenColumns.includes('prixVente') && (
                  <td className="p-2">{t.prixVente?.toString()}</td>
                )}
                {!hiddenColumns.includes('statut') && (
                  <td className="p-2">{t.enrichie?.statut ?? 'NON_ANALYSEE'}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-4 mt-4">
        <Button disabled={page <= 1} onClick={() => loadPage(page - 1)}>
          Précédent
        </Button>
        <span>
          Page {page} / {data.totalPages}
        </span>
        <Button disabled={page >= data.totalPages} onClick={() => loadPage(page + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create API route for paginated table**

Create `src/app/api/transactions/route.ts`:
```ts
import { searchTransactions } from '@/server/actions/transaction'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const sortField = searchParams.get('sortField') ?? 'dateVente'
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'

  const data = await searchTransactions({ page, sortField, sortOrder })
  return NextResponse.json(data)
}
```

- [ ] **Step 4: Create filters component (basic Vague 1)**

Create `src/components/transaction-filters.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function TransactionFilters({
  onSearch,
}: {
  onSearch: (query: string) => void
}) {
  const [query, setQuery] = useState('')

  return (
    <div className="flex gap-2 mb-4">
      <Input
        placeholder="Rechercher (n° d'inscription, vendeur, acheteur, municipalité)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1"
      />
      <Button onClick={() => onSearch(query)}>Rechercher</Button>
    </div>
  )
}
```

- [ ] **Step 5: Create transactions page**

Create `src/app/transactions/page.tsx`:
```tsx
import { searchTransactions } from '@/server/actions/transaction'
import { TransactionTable } from '@/components/transaction-table'
import { TransactionFilters } from '@/components/transaction-filters'

export default async function TransactionsPage() {
  const data = await searchTransactions({ page: 1 })

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Liste des transactions</h1>
      <TransactionFilters onSearch={() => {}} />
      <TransactionTable initialData={data} />
    </main>
  )
}
```

- [ ] **Step 6: Wire search filters to table**

Update `src/app/transactions/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { searchTransactions } from '@/server/actions/transaction'
import { TransactionTable } from '@/components/transaction-table'
import { TransactionFilters } from '@/components/transaction-filters'

export default function TransactionsPage() {
  const [data, setData] = useState<any>(null)

  async function handleSearch(query: string) {
    const res = await searchTransactions({ page: 1, query })
    setData(res)
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Liste des transactions</h1>
      <TransactionFilters onSearch={handleSearch} />
      {data ? <TransactionTable initialData={data} /> : <p>Chargement...</p>}
    </main>
  )
}
```

Note: this makes the page client-side. If preferring SSR, keep the server version and add a client wrapper for filters.

- [ ] **Step 7: Add test for search action**

Create `tests/server/transaction.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { searchTransactions } from '@/server/actions/transaction'
import { prisma } from '@/lib/prisma'

describe('searchTransactions', () => {
  let orgId: string

  beforeAll(async () => {
    const org = await prisma.organisation.create({ data: { nom: 'Test Org' } })
    orgId = org.id
    await prisma.transactionSource.create({
      data: {
        organisationId: orgId,
        systemeSource: 'EXISTANT_EVAGRI',
        numeroInscription: '12345',
        numeroLot: '54321',
        dateVente: new Date('2023-01-15'),
        prixVente: 50000,
        mrc: 'Test MRC',
        municipalite: 'Testville',
      },
    })
  })

  afterAll(async () => {
    await prisma.transactionSource.deleteMany({ where: { organisationId: orgId } })
    await prisma.organisation.delete({ where: { id: orgId } })
  })

  it('returns paginated transactions', async () => {
    // Mock auth session
    process.env.NEXTAUTH_SECRET = 'test-secret'
    const res = await searchTransactions({ page: 1, pageSize: 10 })
    expect(res.transactions.length).toBeGreaterThan(0)
    expect(res.total).toBeGreaterThan(0)
  })
})
```

Note: auth mocking in server actions requires a test helper. Simplify by testing `searchTransactions` only if auth can be bypassed; otherwise test via API route.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(transactions): add searchable and paginated transaction table"
```

---

## Task 7: Build interactive map with OSM

**Files:**
- Create: `src/components/transaction-map.tsx`
- Create: `src/app/transactions/map/page.tsx`
- Create: `src/app/api/transactions/map/route.ts`
- Create: `src/lib/map.ts`

- [ ] **Step 1: Install Leaflet and React wrapper**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install leaflet react-leaflet leaflet.markercluster
npm install -D @types/leaflet @types/leaflet.markercluster
```

- [ ] **Step 2: Create map data API**

Create `src/app/api/transactions/map/route.ts`:
```ts
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session?.user?.organisationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const transactions = await prisma.transactionSource.findMany({
    where: {
      organisationId: session.user.organisationId,
      latitude: { not: null },
      longitude: { not: null },
    },
    select: {
      id: true,
      numeroInscription: true,
      dateVente: true,
      prixVente: true,
      superficieTotaleHectare: true,
      latitude: true,
      longitude: true,
      municipalite: true,
    },
  })

  return NextResponse.json(transactions)
}
```

- [ ] **Step 3: Create map component**

Create `src/components/transaction-map.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type MapTransaction = {
  id: string
  numeroInscription: string
  dateVente: Date
  prixVente: number | null
  superficieTotaleHectare: number | null
  latitude: number
  longitude: number
  municipalite: string | null
}

const pinIcon = new L.Icon({
  iconUrl: '/pin.svg',
  iconSize: [24, 36],
  iconAnchor: [12, 36],
})

export function TransactionMap() {
  const [transactions, setTransactions] = useState<MapTransaction[]>([])

  useEffect(() => {
    fetch('/api/transactions/map')
      .then((res) => res.json())
      .then(setTransactions)
  }, [])

  return (
    <MapContainer
      center={[52.0, -72.0]}
      zoom={6}
      scrollWheelZoom={true}
      style={{ height: '70vh', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {transactions.map((t) => (
        <Marker key={t.id} position={[Number(t.latitude), Number(t.longitude)]} icon={pinIcon}>
          <Popup>
            <div>
              <strong>{t.numeroInscription}</strong>
              <p>{t.municipalite}</p>
              <p>Date: {new Date(t.dateVente).toLocaleDateString('fr-CA')}</p>
              <p>Prix: {t.prixVente?.toString() ?? '-'}</p>
              <p>Superficie: {t.superficieTotaleHectare?.toString() ?? '-'} ha</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
```

- [ ] **Step 4: Add a simple SVG pin**

Create `public/pin.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36" fill="#66995c">
  <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z"/>
  <circle cx="12" cy="12" r="5" fill="#fff"/>
</svg>
```

- [ ] **Step 5: Create map page**

Create `src/app/transactions/map/page.tsx`:
```tsx
import dynamic from 'next/dynamic'

const TransactionMap = dynamic(
  () => import('@/components/transaction-map').then((m) => m.TransactionMap),
  { ssr: false }
)

export default function MapPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Carte des transactions</h1>
      <TransactionMap />
    </main>
  )
}
```

- [ ] **Step 6: Add navigation links**

Modify `src/app/layout.tsx` to add a top navigation bar:
```tsx
import Link from 'next/link'

function NavBar() {
  return (
    <nav className="bg-stone-900 text-white p-4 flex gap-6">
      <Link href="/transactions">Liste</Link>
      <Link href="/transactions/map">Carte</Link>
      <Link href="/admin/import">Import</Link>
      <Link href="/admin/users">Utilisateurs</Link>
    </nav>
  )
}
```

Inject `<NavBar />` into the body of the root layout.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(map): add interactive OSM map with transaction pins"
```

---

## Task 8: Production build and Coolify deployment prep

**Files:**
- Create: `coolify.json`
- Create: `.dockerignore`
- Create: `README.md`
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add .dockerignore**

Create `.dockerignore`:
```
node_modules
.next
.git
.env
.env.local
*.log
Dockerfile
.dockerignore
```

- [ ] **Step 2: Verify production build**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
docker compose down
docker compose up --build -d
```
Expected: app builds, runs, setup/login/import/table/map all functional.

- [ ] **Step 3: Add Coolify-specific healthcheck**

Modify `Dockerfile` runner stage:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
```

Create `src/app/api/health/route.ts`:
```ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
```

- [ ] **Step 4: Add backup script**

Create `scripts/backup.sh`:
```bash
#!/bin/sh
set -e

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DUMP_FILE="/tmp/evagri_${TIMESTAMP}.sql.gz"

pg_dump "$DATABASE_URL" | gzip > "$DUMP_FILE"

aws s3 cp "$DUMP_FILE" "s3://${S3_BUCKET}/backups/" --endpoint-url="${S3_ENDPOINT}"

rm "$DUMP_FILE"
echo "Backup completed: backups/evagri_${TIMESTAMP}.sql.gz"
```

Install AWS CLI in Dockerfile if not already present:
```dockerfile
RUN apk add --no-cache aws-cli
```

- [ ] **Step 5: Add restore script**

Create `scripts/restore.sh`:
```bash
#!/bin/sh
set -e

BACKUP_FILE=$1
TMP_FILE="/tmp/restore.sql.gz"

aws s3 cp "s3://${S3_BUCKET}/backups/${BACKUP_FILE}" "$TMP_FILE" --endpoint-url="${S3_ENDPOINT}"
gunzip < "$TMP_FILE" | psql "$DATABASE_URL"
rm "$TMP_FILE"
echo "Restore completed from ${BACKUP_FILE}"
```

- [ ] **Step 6: Document deployment steps**

Create `README.md`:
```markdown
# EVAGRI

## Local development

```bash
cp .env.example .env
npm install
docker compose up -d
npx prisma migrate dev
npm run dev
```

## Coolify deployment

1. Provision VPS OVHcloud Canada (Beauharnois) with Docker.
2. Install Coolify on the VPS.
3. Create a new resource from this Git repository.
4. Set environment variables from `.env.example`.
5. Add separate PostgreSQL and Redis services in Coolify, or use the docker-compose override.
6. Configure scheduled backup job using `scripts/backup.sh`.
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(deploy): add healthcheck, backup/restore scripts and Coolify docs"
```

---

## Task 9: Self-review and gap fix

- [ ] **Step 1: Spec coverage check**

Verify each Vague 1 requirement from the design doc has a task:

| Requirement | Task |
|---|---|
| Setup technique Docker + DB | Task 1, 2 |
| Auth + setup initial | Task 3 |
| Seed typologies | Task 4 |
| Import Excel historique | Task 5 |
| Tableau dynamique | Task 6 |
| Carte interactive OSM | Task 7 |
| Déploiement / backups | Task 8 |

No gaps identified.

- [ ] **Step 2: Placeholder scan**

Search the plan:
```bash
grep -i "TODO\|TBD\|placeholder\|implement later\|fill in details" /Users/fabien/Documents/projets/Evagri/docs/superpowers/plans/2026-06-15-vague-1-fondations-donnees-exploration.md || echo "No placeholders"
```

Expected: no placeholders.

- [ ] **Step 3: Type consistency check**

- `searchTransactions` uses `{ transactions, total, page, pageSize, totalPages }` consistently.
- `importExcel` returns `{ importationId, totalRows, inserted, ignored, errors }` consistently.
- `Utilisateur` and `Organisation` Prisma names match schema.

- [ ] **Step 4: Add missing edge-case note**

In `src/lib/transaction-import.ts`, handle whitespace in `numeroInscription` and skip empty rows. Already noted in code.

- [ ] **Step 5: Final commit of plan**

```bash
cd /Users/fabien/Documents/projets/Evagri
git add docs/superpowers/plans/2026-06-15-vague-1-fondations-donnees-exploration.md
git commit -m "docs(plan): add Vague 1 implementation plan"
```

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-15-vague-1-fondations-donnees-exploration.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

**Which approach do you want?**
