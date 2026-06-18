# EVAGRI — Gamma : Authentification, rôles, utilisateurs et audit

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sécuriser l'application avec l'authentification multi-rôles, le flux de configuration initiale, la gestion des utilisateurs, le consentement à la politique de confidentialité et la traçabilité complète dans le journal d'audit.

**Architecture:** Auth.js (NextAuth v5) avec provider `credentials` et hachage bcrypt. Middleware Next.js protège les routes. Tous les Server Actions Alpha/Beta sont mis à jour pour utiliser la session authentifiée à la place de `DEFAULT_ORGANISATION_ID`. Le journal d'audit enregistre les actions avec utilisateur, date et diff.

**Tech Stack:** Next.js 15, Auth.js v5, bcryptjs, Prisma.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/auth.ts` | Configuration Auth.js credentials et callbacks JWT/session. |
| `src/app/api/auth/[...nextauth]/route.ts` | Route API Auth.js. |
| `src/middleware.ts` | Protection des routes, redirection login/setup. |
| `src/types/next-auth.d.ts` | Typage session avec rôle et organisationId. |
| `src/app/login/page.tsx` | Page de connexion. |
| `src/components/login-form.tsx` | Formulaire de connexion. |
| `src/server/actions/auth.ts` | Server Action de connexion. |
| `src/app/setup/page.tsx` | Configuration initiale organisation + admin. |
| `src/components/setup-form.tsx` | Formulaire de setup. |
| `src/server/actions/setup.ts` | Création organisation/admin initiaux. |
| `src/app/admin/users/page.tsx` | Gestion des utilisateurs. |
| `src/components/users-table.tsx` | Tableau des utilisateurs. |
| `src/components/invite-user-form.tsx` | Invitation d'utilisateur. |
| `src/server/actions/users.ts` | CRUD utilisateurs et invitation. |
| `src/components/consent-banner.tsx` | Bannière de consentement Loi 25. |
| `src/server/actions/consent.ts` | Enregistrement du consentement. |
| `src/server/actions/*.ts` (modifiés) | Tous les actions Alpha/Beta passent à l'authentification par session. |

---

## Task 1: Install and configure Auth.js

**Files:**
- Modify: `package.json`
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/types/next-auth.d.ts`

- [ ] **Step 1: Install auth dependencies**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

- [ ] **Step 2: Write auth configuration**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/auth.ts`:
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
          mustChangePassword: user.passwordHash.startsWith('temp:'),
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
        session.user.mustChangePassword = token.mustChangePassword as boolean
      }
      return session
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role
        token.organisationId = user.organisationId
        token.mustChangePassword = user.mustChangePassword
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

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/lib/auth'
export const { GET, POST } = handlers
```

- [ ] **Step 4: Add NextAuth session types**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/types/next-auth.d.ts`:
```ts
declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      role: string
      organisationId: string
      mustChangePassword?: boolean
    }
  }

  interface User {
    role: string
    organisationId: string
    mustChangePassword?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: string
    organisationId: string
    mustChangePassword?: boolean
  }
}
```

- [ ] **Step 5: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(auth): install and configure Auth.js credentials provider"
```

---

## Task 2: Middleware and login page

**Files:**
- Create: `src/middleware.ts`
- Create: `src/app/login/page.tsx`
- Create: `src/components/login-form.tsx`
- Create: `src/server/actions/auth.ts`

- [ ] **Step 1: Create login Server Action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/auth.ts`:
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

- [ ] **Step 2: Create login form component**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/login-form.tsx`:
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

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/login/page.tsx`:
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

- [ ] **Step 3: Create middleware**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/middleware.ts`:
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

- [ ] **Step 4: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(auth): add login page, form and route middleware"
```

---

## Task 3: Initial setup flow

**Files:**
- Create: `src/app/setup/page.tsx`
- Create: `src/components/setup-form.tsx`
- Create: `src/server/actions/setup.ts`

- [ ] **Step 1: Create setup Server Action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/setup.ts`:
```ts
'use server'

import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { signIn } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function createInitialOrganisationAndAdmin(formData: FormData) {
  const existingOrg = await prisma.organisation.findFirst()
  if (existingOrg) {
    throw new Error('La configuration initiale a déjà été effectuée')
  }

  const orgName = formData.get('orgName') as string
  const adminEmail = formData.get('adminEmail') as string
  const adminName = formData.get('adminName') as string
  const adminPassword = formData.get('adminPassword') as string

  if (!orgName || !adminEmail || !adminPassword) {
    throw new Error('Champs obligatoires manquants')
  }

  const organisation = await prisma.organisation.create({ data: { nom: orgName } })
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

  await logAudit({
    organisationId: organisation.id,
    tableCible: 'utilisateur',
    enregistrementId: admin.id,
    utilisateurId: admin.id,
    action: 'INSERT',
    diff: { email: adminEmail, role: 'ADMIN' },
  })

  await signIn('credentials', {
    email: adminEmail,
    password: adminPassword,
    redirectTo: '/transactions',
  })
}
```

- [ ] **Step 2: Create setup form and page**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/setup-form.tsx`:
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
        <Label htmlFor="orgName">Nom de l'organisation</Label>
        <Input id="orgName" name="orgName" required />
      </div>
      <div>
        <Label htmlFor="adminName">Nom de l'administrateur</Label>
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
      <Button type="submit">Créer l'organisation</Button>
    </form>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/setup/page.tsx`:
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

- [ ] **Step 3: Update seed to avoid conflicts with setup**

Modify `/Users/fabien/Documents/projets/Evagri/app/my-app/prisma/seed.ts` so it is idempotent and skips if an organisation already exists:
```ts
const existing = await prisma.organisation.findFirst()
if (existing) {
  console.log('Organisation already exists, skipping seed.')
  return
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(auth): add initial setup flow for organisation and admin"
```

---

## Task 4: User management

**Files:**
- Create: `src/server/actions/users.ts`
- Create: `src/app/admin/users/page.tsx`
- Create: `src/components/users-table.tsx`
- Create: `src/components/invite-user-form.tsx`

- [ ] **Step 1: Create user Server Actions**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/users.ts`:
```ts
'use server'

import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { logAudit } from '@/lib/audit'

export async function listUsers() {
  const session = await auth()
  if (!session?.user?.organisationId) throw new Error('Non authentifié')

  return prisma.utilisateur.findMany({
    where: { organisationId: session.user.organisationId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function inviteUser(formData: FormData) {
  const session = await auth()
  if (!session?.user?.organisationId || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé')
  }

  const email = formData.get('email') as string
  const name = formData.get('name') as string
  const role = formData.get('role') as string
  const tempPassword = Math.random().toString(36).slice(-10)
  const passwordHash = `temp:${await bcrypt.hash(tempPassword, 12)}`

  const user = await prisma.utilisateur.create({
    data: {
      organisationId: session.user.organisationId,
      email,
      nom: name,
      role,
      passwordHash,
    },
  })

  await logAudit({
    organisationId: session.user.organisationId,
    tableCible: 'utilisateur',
    enregistrementId: user.id,
    utilisateurId: session.user.id,
    action: 'INSERT',
    diff: { email, role },
  })

  revalidatePath('/admin/users')
  return { tempPassword }
}

export async function toggleUserActive(id: string, actif: boolean) {
  const session = await auth()
  if (!session?.user?.organisationId || session.user.role !== 'ADMIN') {
    throw new Error('Non autorisé')
  }

  await prisma.utilisateur.update({
    where: { id },
    data: { actif },
  })

  revalidatePath('/admin/users')
}
```

- [ ] **Step 2: Create users management UI**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/invite-user-form.tsx`:
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

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/users-table.tsx`:
```tsx
'use client'

import { toggleUserActive } from '@/server/actions/users'
import { Button } from '@/components/ui/button'

export function UsersTable({ users }: { users: any[] }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="border-b">
          <th className="text-left p-2">Nom</th>
          <th className="text-left p-2">Courriel</th>
          <th className="text-left p-2">Rôle</th>
          <th className="text-left p-2">Actif</th>
          <th className="text-left p-2"></th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => (
          <tr key={u.id} className="border-b">
            <td className="p-2">{u.nom}</td>
            <td className="p-2">{u.email}</td>
            <td className="p-2">{u.role}</td>
            <td className="p-2">{u.actif ? 'Oui' : 'Non'}</td>
            <td className="p-2">
              <Button
                variant={u.actif ? 'destructive' : 'default'}
                size="sm"
                onClick={async () => {
                  await toggleUserActive(u.id, !u.actif)
                  window.location.reload()
                }}
              >
                {u.actif ? 'Désactiver' : 'Activer'}
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/users/page.tsx`:
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

- [ ] **Step 3: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(users): add user invitation and admin user management"
```

---

## Task 5: Consent flow

**Files:**
- Create: `src/server/actions/consent.ts`
- Create: `src/components/consent-banner.tsx`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create consent Server Action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/consent.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function recordConsent() {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.utilisateur.update({
    where: { id: session.user.id },
    data: { consentementPolitiqueAt: new Date() },
  })
}

export async function getConsentStatus() {
  const session = await auth()
  if (!session?.user?.id) return null

  const user = await prisma.utilisateur.findUnique({
    where: { id: session.user.id },
    select: { consentementPolitiqueAt: true },
  })

  return user?.consentementPolitiqueAt
}
```

- [ ] **Step 2: Create consent banner component**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/consent-banner.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { recordConsent } from '@/server/actions/consent'

export function ConsentBanner({ hasConsented }: { hasConsented: boolean }) {
  const [consented, setConsented] = useState(hasConsented)

  if (consented) return null

  async function handleAccept() {
    await recordConsent()
    setConsented(true)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-stone-900 text-white p-4 flex justify-between items-center">
      <span className="text-sm">
        En utilisant EVAGRI, vous acceptez la politique de confidentialité de l'organisation conformément à la Loi 25.
      </span>
      <Button onClick={handleAccept}>J'accepte</Button>
    </div>
  )
}
```

- [ ] **Step 3: Inject banner in layout**

Modify `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/layout.tsx` to call `getConsentStatus` and render `ConsentBanner`.

```tsx
import { getConsentStatus } from '@/server/actions/consent'
import { ConsentBanner } from '@/components/consent-banner'

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const consent = await getConsentStatus()
  return (
    <html lang="fr">
      <body>
        {/* NavBar ici */}
        {children}
        <ConsentBanner hasConsented={!!consent} />
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(consent): add Loi 25 privacy consent banner"
```

---

## Task 6: Update all Server Actions to use auth sessions

**Files:**
- Modify: `src/server/actions/import.ts`
- Modify: `src/server/actions/transaction.ts`
- Modify: `src/server/actions/filters.ts`
- Modify: `src/server/actions/champs.ts`
- Modify: `src/server/actions/sections.ts`
- Modify: `src/server/actions/fiche.ts`
- Modify: `src/server/actions/typologie.ts`
- Modify: `src/server/actions/dossier.ts`
- Modify: `src/server/actions/export.ts`
- Modify: `src/app/api/transactions/route.ts`
- Modify: `src/app/api/transactions/map/route.ts`

- [ ] **Step 1: Create auth helper for server actions**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/session.ts`:
```ts
import { auth } from './auth'

export async function requireAuth() {
  const session = await auth()
  if (!session?.user?.organisationId) {
    throw new Error('Non authentifié')
  }
  return {
    userId: session.user.id,
    organisationId: session.user.organisationId,
    role: session.user.role,
  }
}

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.organisationId || session.user.role !== 'ADMIN') {
    throw new Error('Accès réservé aux administrateurs')
  }
  return {
    userId: session.user.id,
    organisationId: session.user.organisationId,
    role: session.user.role,
  }
}
```

- [ ] **Step 2: Update actions to use session helper**

For each action file, replace `const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''` with:
```ts
import { requireAuth } from '@/lib/session'

const { userId, organisationId } = await requireAuth()
```

Apply to:
- `src/server/actions/import.ts` (requireAdmin)
- `src/server/actions/transaction.ts` (requireAuth)
- `src/server/actions/filters.ts` (requireAdmin)
- `src/server/actions/champs.ts` (requireAdmin)
- `src/server/actions/sections.ts` (requireAdmin)
- `src/server/actions/fiche.ts` (requireAuth)
- `src/server/actions/typologie.ts` (requireAdmin)
- `src/server/actions/dossier.ts` (requireAuth)
- `src/server/actions/export.ts` (requireAuth)

API routes (`src/app/api/transactions/route.ts` and `src/app/api/transactions/map/route.ts`) must also call `auth()` and use `session.user.organisationId`.

- [ ] **Step 3: Remove DEFAULT_ORGANISATION_ID from env examples**

Modify `/Users/fabien/Documents/projets/Evagri/app/my-app/.env.example` to remove `DEFAULT_ORGANISATION_ID`.

- [ ] **Step 4: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(auth): enforce authenticated sessions in all server actions and APIs"
```

---

## Task 7: Audit integration

**Files:**
- Modify: `src/lib/audit.ts`
- Modify: all relevant actions to include `utilisateurId`

- [ ] **Step 1: Update audit helper to include user**

`src/lib/audit.ts` already accepts `utilisateurId`. Ensure all calls pass `userId` from `requireAuth`.

- [ ] **Step 2: Add audit calls to mutations**

In each mutating Server Action, add:
```ts
await logAudit({
  organisationId,
  tableCible: 'nom_table',
  enregistrementId: record.id,
  utilisateurId: userId,
  action: 'INSERT' | 'UPDATE' | 'DELETE',
  diff: { /* champs modifiés */ },
})
```

Update:
- `import.ts` : INSERT importation.
- `champs.ts` : INSERT/UPDATE/DELETE champ.
- `filters.ts` : INSERT/UPDATE/DELETE filtre.
- `fiche.ts` : UPDATE transactionEnrichie + valeurs.
- `dossier.ts` : INSERT dossier/panier, INSERT/DELETE panier_transaction.
- `users.ts` : INSERT utilisateur, UPDATE actif.

- [ ] **Step 3: Add audit log viewer**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/audit.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { requireAuth, requireAdmin } from '@/lib/session'

export async function listAuditLogs() {
  await requireAdmin()
  const { organisationId } = await requireAuth()

  return prisma.journalAudit.findMany({
    where: { organisationId },
    orderBy: { createdAt: 'desc' },
    take: 500,
  })
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/audit/page.tsx`:
```tsx
import { listAuditLogs } from '@/server/actions/audit'

export default async function AuditPage() {
  const logs = await listAuditLogs()

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Journal d'audit</h1>
      <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Date</th>
              <th className="text-left p-2">Action</th>
              <th className="text-left p-2">Table</th>
              <th className="text-left p-2">Utilisateur</th>
              <th className="text-left p-2">Diff</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b">
                <td className="p-2">{new Date(l.createdAt).toLocaleString('fr-CA')}</td>
                <td className="p-2">{l.action}</td>
                <td className="p-2">{l.tableCible}</td>
                <td className="p-2">{l.utilisateurId || 'système'}</td>
                <td className="p-2">{JSON.stringify(l.diff)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(audit): integrate audit logging with user actions and viewer"
```

---

## Task 8: Self-review and gap fix

- [ ] **Step 1: Spec coverage check**

| Cahier Gamma | Tâche |
|---|---|
| Authentification multi-rôles | Task 1, 2 |
| Setup initial | Task 3 |
| Gestion utilisateurs | Task 4 |
| Consentement Loi 25 | Task 5 |
| Audit / traçabilité | Task 6, 7 |

Aucun écart identifié.

- [ ] **Step 2: Placeholder scan**

Search for `TODO`, `TBD`, `implement later`, `fill in details`. Fix before saving.

- [ ] **Step 3: Type consistency check**

- `role` values are `ADMIN`, `EVALUATEUR`, `DEVELOPPEUR`.
- `mustChangePassword` flag propagated in JWT/session.
- All server actions use `organisationId` from session.

- [ ] **Step 4: Final commit of plan**

```bash
cd /Users/fabien/Documents/projets/Evagri
git add docs/superpowers/plans/2026-06-17-gamma-authentification-utilisateurs-roles-audit.md
git commit -m "docs(plan): add Gamma implementation plan"
```

---

## Execution Handoff

**Plan Gamma complet et sauvegardé dans `docs/superpowers/plans/2026-06-17-gamma-authentification-utilisateurs-roles-audit.md`.**

Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — un sous-agent par tâche, revue entre chaque tâche.
2. **Inline Execution** — exécution directe dans cette session avec `superpowers:executing-plans`.

**Quelle approche ?**
