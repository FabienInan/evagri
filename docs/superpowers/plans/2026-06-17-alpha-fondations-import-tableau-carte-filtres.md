# EVAGRI — Alpha : Fondations, import Excel, tableau, carte et filtres

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déployer l'application web initiale hébergée au Canada avec le schéma de données MVP, l'import manuel de la base Excel historique EVAGRI, la consultation des transactions dans un tableau dynamique, sur une carte interactive OSM, et l'écran administrateur de configuration des filtres de recherche.

**Architecture:** Application Next.js 15 monolithique en TypeScript, persistance dans PostgreSQL via Prisma. Déploiement containerisé via Docker et Coolify sur un VPS OVHcloud Canada. L'authentification multi-rôles est reportée à la phase Gamma ; pendant l'Alpha, l'application fonctionne avec une organisation par défaut initialisée par un script de seed.

**Tech Stack:** Next.js 15, React, TypeScript, Tailwind CSS, shadcn/ui, Prisma, PostgreSQL, Docker, Coolify, Leaflet, xlsx, Vitest.

---

## File Structure

| File | Responsibility |
|---|---|
| `Dockerfile` | Build multi-stage de l'application Next.js pour production. |
| `docker-compose.yml` | Orchestration locale : app, PostgreSQL. |
| `.env.example` | Variables d'environnement requises. |
| `.dockerignore` | Fichiers exclus du contexte Docker. |
| `prisma/schema.prisma` | Schéma complet MVP (toutes les entités du cahier). |
| `prisma/seed.ts` | Organisation par défaut, typologies de base et référentiel géographique minimal. |
| `src/lib/prisma.ts` | Singleton Prisma Client. |
| `src/lib/storage.ts` | Client S3-compatible pour Object Storage OVHcloud Canada (fichiers et backups). |
| `src/lib/audit.ts` | Helper d'écriture dans le journal d'audit. |
| `src/lib/excel-parser.ts` | Analyse du fichier Excel historique EVAGRI. |
| `src/lib/transaction-import.ts` | Insertion des transactions sources en base. |
| `src/lib/filters.ts` | Conversion d'un filtre `FiltreRecherche` en clause Prisma. |
| `src/app/layout.tsx` | Layout racine. |
| `src/app/page.tsx` | Redirection vers `/transactions`. |
| `src/app/transactions/page.tsx` | Page liste avec tableau. |
| `src/app/transactions/map/page.tsx` | Page carte interactive. |
| `src/app/admin/filters/page.tsx` | Administration des filtres de recherche. |
| `src/app/admin/import/page.tsx` | Interface d'import Excel. |
| `src/components/transaction-table.tsx` | Tableau avec tri, pagination 10 lignes, colonnes masquables. |
| `src/components/transaction-filters.tsx` | Panneau de filtres alimenté par `FiltreRecherche`. |
| `src/components/transaction-map.tsx` | Carte Leaflet avec pins et clustering. |
| `src/components/import-excel-form.tsx` | Formulaire d'upload et rapport d'import. |
| `src/components/import-history.tsx` | Tableau d'historique des importations + retry. |
| `src/components/filters-admin-form.tsx` | CRUD filtres de recherche. |
| `src/components/transactions-page-client.tsx` | Client wrapper pour la liste et les filtres. |
| `src/server/actions/transaction.ts` | Recherche paginée des transactions. |
| `src/server/actions/import.ts` | Import Excel. |
| `src/server/actions/filters.ts` | CRUD filtres de recherche. |
| `tests/lib/excel-parser.test.ts` | Tests unitaires du parseur Excel. |
| `tests/server/transaction.test.ts` | Tests des Server Actions transaction. |
| `scripts/backup.sh` | `pg_dump` compressé vers Object Storage. |
| `scripts/restore.sh` | Restore depuis Object Storage. |
| `README.md` | Instructions locale et déploiement Coolify. |

---

## Database Schema (MVP complet, installé en Alpha)

```prisma
model Organisation {
  id        String   @id @default(uuid())
  nom       String
  actif     Boolean  @default(true)
  createdAt DateTime @default(now()) @map("date_creation")

  utilisateurs Utilisateur[]
  transactions TransactionSource[]
  champs       ChampEnrichissable[]
  filtres      FiltreRecherche[]
  vues         VueFicheEvaluation[]
  dossiers     Dossier[]
  typologies   Typologie[]
  importations Importation[]
  audits       JournalAudit[]
  referentiel  Municipalite[]

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

model Municipalite {
  id                 String @id @default(uuid())
  organisationId     String @map("id_organisation")
  nomMunicipalite    String @map("nom_municipalite")
  mrc                String
  regionAdministrative String @map("region_administrative")
  codePostalPrefix   String? @map("code_postal_prefix")

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@unique([organisationId, nomMunicipalite])
  @@map("municipalite")
}

model TransactionSource {
  id                    String    @id @default(uuid())
  organisationId        String    @map("id_organisation")
  importationId         String?   @map("id_importation")
  systemeSource         String    @map("systeme_source")
  numeroInscription     String    @map("numero_inscription")
  dateVente             DateTime  @map("date_vente") @db.Date
  prixVente             Decimal?  @map("prix_vente") @db.Decimal(15, 2)
  vendeur               String?
  acheteur              String?
  lotsCadastraux        String[]  @map("lots_cadastraux")
  adresse               String?
  municipalite          String?
  mrc                   String?
  superficieTotaleHectare Decimal?  @map("superficie_totale_hectare") @db.Decimal(12, 4)
  latitude              Decimal?  @db.Decimal(10, 8) // Géocodé depuis adresse/municipalité si absent de l'import
  longitude             Decimal?  @db.Decimal(11, 8) // Géocodé depuis adresse/municipalité si absent de l'import
  createdAt             DateTime  @default(now()) @map("date_creation")

  organisation Organisation @relation(fields: [organisationId], references: [id])
  enrichie     TransactionEnrichie?
  documents    DocumentActe[]
  analyses     ParametresAnalyseTransaction[]
  resultats    IndicateursAjustes[]

  @@unique([organisationId, numeroInscription, dateVente])
  @@map("transaction_source")
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
  valeurs         ValeurEnrichissement[]
  paniers         PanierTransaction[]

  @@map("transaction_enrichie")
}

model ChampEnrichissable {
  id               String   @id @default(uuid())
  organisationId   String   @map("id_organisation")
  codeMachine      String   @map("code_machine")
  nomAffichage     String   @map("nom_affichage")
  typeDonnees      String   @map("type_donnees")
  nature           String
  unite            String   @default("N/A") @map("unite")
  plageMin         Decimal? @map("plage_min") @db.Decimal(18, 4)
  plageMax         Decimal? @map("plage_max") @db.Decimal(18, 4)
  optionsListe     Json?    @map("options_liste")
  regleCalcul      String?  @map("regle_calcul")
  applicableATypes   Json     @map("applicable_a_types")
  ordreAffichage   Int      @default(0) @map("ordre_affichage")
  estAffiche       Boolean  @default(true) @map("est_affiche")
  estObligatoire   Boolean  @default(false) @map("est_obligatoire")
  estModifiable    Boolean  @default(true) @map("est_modifiable")
  actif            Boolean  @default(true)

  organisation Organisation @relation(fields: [organisationId], references: [id])
  filtres      FiltreRecherche[]
  valeurs      ValeurEnrichissement[]

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

  organisation       Organisation @relation(fields: [organisationId], references: [id])
  champEnrichissable ChampEnrichissable? @relation(fields: [champEnrichissableId], references: [id])

  @@map("filtre_recherche")
}

model ValeurEnrichissement {
  id                     String    @id @default(uuid())
  transactionEnrichieId  String    @map("id_transaction_enrichie")
  champEnrichissableId   String    @map("id_champ_enrichissable")
  valeurNombre           Decimal?  @map("valeur_nombre") @db.Decimal(18, 4)
  valeurTexte            String?   @map("valeur_texte")
  valeurBooleen          Boolean?  @map("valeur_booleen")
  dateModification       DateTime  @default(now()) @map("date_modification")
  modifieParId           String?   @map("id_modifie_par")

  transactionEnrichie TransactionEnrichie @relation(fields: [transactionEnrichieId], references: [id])
  champEnrichissable  ChampEnrichissable  @relation(fields: [champEnrichissableId], references: [id])

  @@unique([transactionEnrichieId, champEnrichissableId])
  @@map("valeur_enrichissement")
}

model VueFicheEvaluation {
  id             String   @id @default(uuid())
  organisationId String   @map("id_organisation")
  typeVue        String   @map("type_vue")
  contenu        Json

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@map("vue_fiche_evaluation")
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
  parent       Typologie?   @relation("TypologieParent", fields: [parentId], references: [id])
  enfants      Typologie[]  @relation("TypologieParent")
  paniers      Panier[]

  @@unique([organisationId, code])
  @@map("typologie")
}

model Dossier {
  id             String   @id @default(uuid())
  organisationId String   @map("id_organisation")
  numeroDossier  String   @map("numero_dossier")
  nom            String?
  createurId     String?  @map("id_createur")
  createdAt      DateTime @default(now()) @map("date_creation")
  actif          Boolean  @default(true)

  organisation Organisation @relation(fields: [organisationId], references: [id])
  paniers      Panier[]
  analyses     AnalyseDossier[]

  @@unique([organisationId, numeroDossier])
  @@map("dossier")
}

model Panier {
  id              String   @id @default(uuid())
  organisationId  String   @map("id_organisation")
  dossierId       String   @map("id_dossier")
  nom             String
  typeTransactionId String? @map("id_type_transaction")
  createurId      String?  @map("id_createur")
  createdAt       DateTime @default(now()) @map("date_creation")

  organisation    Organisation @relation(fields: [organisationId], references: [id])
  dossier         Dossier      @relation(fields: [dossierId], references: [id])
  typeTransaction Typologie?   @relation(fields: [typeTransactionId], references: [id])
  transactions    PanierTransaction[]
  analyses        AnalyseDossier[]

  @@map("panier")
}

model PanierTransaction {
  panierId              String @map("id_panier")
  transactionEnrichieId String @map("id_transaction_enrichie")
  dateAjout             DateTime @default(now()) @map("date_ajout")

  panier              Panier              @relation(fields: [panierId], references: [id])
  transactionEnrichie TransactionEnrichie @relation(fields: [transactionEnrichieId], references: [id])

  @@id([panierId, transactionEnrichieId])
  @@map("panier_transaction")
}

model AnalyseDossier {
  id              String   @id @default(uuid())
  organisationId  String   @map("id_organisation")
  dossierId       String   @map("id_dossier")
  panierId        String?  @map("id_panier")
  dateEvaluation  DateTime @map("date_evaluation") @db.Date
  tauxCroissance  Decimal  @map("taux_croissance") @db.Decimal(5, 4)
  createurId      String?  @map("id_createur")
  createdAt       DateTime @default(now()) @map("date_creation")

  organisation Organisation @relation(fields: [organisationId], references: [id])
  dossier      Dossier      @relation(fields: [dossierId], references: [id])
  panier       Panier?      @relation(fields: [panierId], references: [id])
  parametres   ParametresAnalyseTransaction[]
  resultats    IndicateursAjustes[]

  @@map("analyse_dossier")
}

model ParametresAnalyseTransaction {
  id                    String   @id @default(uuid())
  analyseDossierId      String   @map("id_analyse_dossier")
  transactionSourceId   String   @map("id_transaction_source")
  tauxBoiseRef          Decimal? @map("taux_boise_ref") @db.Decimal(15, 2)
  tauxCultiveRef        Decimal? @map("taux_cultive_ref") @db.Decimal(15, 2)
  valeurBatimentRef     Decimal? @map("valeur_batiment_ref") @db.Decimal(15, 2)
  valeurMaisonRef       Decimal? @map("valeur_maison_ref") @db.Decimal(15, 2)
  valeurTerrainResidentielRef Decimal? @map("valeur_terrain_residentiel_ref") @db.Decimal(15, 2)

  analyseDossier    AnalyseDossier    @relation(fields: [analyseDossierId], references: [id])
  transactionSource TransactionSource @relation(fields: [transactionSourceId], references: [id])

  @@unique([analyseDossierId, transactionSourceId])
  @@map("parametres_analyse_transaction")
}

model IndicateursAjustes {
  id                         String   @id @default(uuid())
  analyseDossierId           String   @map("id_analyse_dossier")
  transactionSourceId        String   @map("id_transaction_source")
  prixVenteAjuste            Decimal? @map("prix_vente_ajuste") @db.Decimal(15, 2)
  tauxGlobalAjuste           Decimal? @map("taux_global_ajuste") @db.Decimal(15, 2)
  tauxResiduelCultiveAjuste  Decimal? @map("taux_residuel_cultive_ajuste") @db.Decimal(15, 2)
  tauxResiduelBoiseAjuste    Decimal? @map("taux_residuel_boise_ajuste") @db.Decimal(15, 2)
  tauxResiduelBatimentAjuste Decimal? @map("taux_residuel_batiment_ajuste") @db.Decimal(15, 2)
  tauxParEntailleAjuste      Decimal? @map("taux_par_entaille_ajuste") @db.Decimal(15, 2)

  analyseDossier    AnalyseDossier    @relation(fields: [analyseDossierId], references: [id])
  transactionSource TransactionSource @relation(fields: [transactionSourceId], references: [id])

  @@unique([analyseDossierId, transactionSourceId])
  @@map("indicateurs_ajustes")
}

model DocumentActe {
  id                  String   @id @default(uuid())
  transactionSourceId String   @map("id_transaction_source")
  nomFichier          String   @map("nom_fichier")
  cheminStockage      String   @map("chemin_stockage")
  dateUpload          DateTime @default(now()) @map("date_upload")
  uploadeurId         String?  @map("id_uploadeur")

  transactionSource TransactionSource @relation(fields: [transactionSourceId], references: [id])

  @@map("document_acte")
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

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@map("importation")
}

model JournalAudit {
  id               String    @id @default(uuid())
  organisationId   String    @map("id_organisation")
  tableCible       String    @map("table_cible")
  enregistrementId String?   @map("id_enregistrement")
  utilisateurId    String?   @map("id_utilisateur")
  action           String
  diff             Json?
  adresseIp        String?   @map("adresse_ip")
  createdAt        DateTime  @default(now()) @map("date_action")

  organisation Organisation @relation(fields: [organisationId], references: [id])

  @@map("journal_audit")
}
```

---

## Task 1: Initialize Next.js project with Docker

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.env.example`
- Create: `.dockerignore`
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

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/Dockerfile`:
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

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/next.config.js`:
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
}
module.exports = nextConfig
```

- [ ] **Step 4: Write docker-compose.yml**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/docker-compose.yml`:
```yaml
version: "3.8"
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://evagri:evagri@db:5432/evagri
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-dev-secret-change-me}
      - NEXTAUTH_URL=${NEXTAUTH_URL:-http://localhost:3000}
      - S3_ENDPOINT=${S3_ENDPOINT}
      - S3_REGION=${S3_REGION:-ca-central-1}
      - S3_BUCKET=${S3_BUCKET}
      - S3_ACCESS_KEY=${S3_ACCESS_KEY}
      - S3_SECRET_KEY=${S3_SECRET_KEY}
    depends_on:
      - db

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

volumes:
  pgdata:
```

- [ ] **Step 5: Write .env.example**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/.env.example`:
```
DATABASE_URL=postgresql://evagri:evagri@localhost:5432/evagri
NEXTAUTH_SECRET=change_me_to_random_32_chars
NEXTAUTH_URL=http://localhost:3000
S3_ENDPOINT=https://s3.ca-central-1.ovhcloud.com
S3_REGION=ca-central-1
S3_BUCKET=evagri-prod
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=xxx
```

- [ ] **Step 6: Write .dockerignore**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/.dockerignore`:
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

- [ ] **Step 7: Build and run locally**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
docker compose up --build -d
```
Expected: app reachable at `http://localhost:3000`.

- [ ] **Step 8: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "chore: init Next.js 15 project with Docker and shadcn"
```

---

## Task 2: Setup Prisma schema, seed and database

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/lib/prisma.ts`
- Create: `prisma/seed.ts`
- Create: `src/lib/storage.ts`
- Create: `src/lib/audit.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Prisma and dependencies**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install prisma @prisma/client @aws-sdk/client-s3
npm install -D tsx
npx prisma init
```
Expected: `prisma/schema.prisma` and `.env` created.

- [ ] **Step 2: Write Prisma schema**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/prisma/schema.prisma` with the schema defined in the **Database Schema** section above.

- [ ] **Step 3: Create Prisma singleton**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/prisma.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 4: Create S3-compatible storage client**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/storage.ts`:
```ts
import { S3Client } from '@aws-sdk/client-s3'

export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION || 'ca-central-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || '',
    secretAccessKey: process.env.S3_SECRET_KEY || '',
  },
  forcePathStyle: true,
})
```

- [ ] **Step 5: Create audit helper**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/audit.ts`:
```ts
import { prisma } from './prisma'

export async function logAudit(data: {
  organisationId: string
  tableCible: string
  enregistrementId?: string
  utilisateurId?: string
  action: string
  diff?: Record<string, unknown>
  adresseIp?: string
}) {
  await prisma.journalAudit.create({ data })
}
```

- [ ] **Step 6: Create seed script**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/prisma/seed.ts`:
```ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  let org = await prisma.organisation.findFirst({ where: { nom: 'EVAGRI' } })
  if (!org) {
    org = await prisma.organisation.create({ data: { nom: 'EVAGRI' } })
    console.log('Created default organisation:', org.id)
  }

  const typologies = [
    { code: 'TERRES_CULTIVEES', nom: 'Terres cultivées', ordre: 1 },
    { code: 'TERRES_BOISEES', nom: 'Terres boisées', ordre: 2 },
    { code: 'ERABLIERES', nom: 'Érablières', ordre: 3 },
    { code: 'BATIMENTS_AGRICOLES', nom: 'Bâtiments agricoles', ordre: 4 },
    { code: 'FERME', nom: 'Ferme', ordre: 5 },
  ]

  for (const t of typologies) {
    await prisma.typologie.upsert({
      where: { organisationId_code: { organisationId: org.id, code: t.code } },
      update: {},
      create: { organisationId: org.id, ...t, estFeuille: true },
    })
  }

  const villes = [
    { nomMunicipalite: 'Drummondville', mrc: 'Drummond', regionAdministrative: 'Centre-du-Québec' },
    { nomMunicipalite: 'Victoriaville', mrc: 'Arthabaska', regionAdministrative: 'Centre-du-Québec' },
    { nomMunicipalite: 'Nicolet', mrc: 'Nicolet-Yamaska', regionAdministrative: 'Centre-du-Québec' },
  ]

  for (const v of villes) {
    await prisma.municipalite.upsert({
      where: { organisationId_nomMunicipalite: { organisationId: org.id, nomMunicipalite: v.nomMunicipalite } },
      update: {},
      create: { organisationId: org.id, ...v },
    })
  }

  console.log('Seed completed.')
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

- [ ] **Step 7: Add Prisma scripts and run initial migration**

Modify `/Users/fabien/Documents/projets/Evagri/app/my-app/package.json` scripts:
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
    "db:seed": "tsx prisma/seed.ts",
    "test": "vitest"
  }
}
```

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npx prisma migrate dev --name init
npm run db:seed
```
Expected: migration created, tables present, default organisation and seed data inserted.

- [ ] **Step 8: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(db): add full MVP Prisma schema, seed and storage helpers"
```

---

## Task 3: Excel import engine

**Files:**
- Create: `src/lib/excel-parser.ts`
- Create: `src/lib/transaction-import.ts`
- Create: `tests/lib/excel-parser.test.ts`
- Create: `tests/fixtures/minimal.xlsx`
- Create: `src/server/actions/import.ts`
- Create: `src/app/admin/import/page.tsx`
- Create: `src/components/import-excel-form.tsx`

- [ ] **Step 1: Install Excel parsing and test dependencies**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install xlsx
npm install -D vitest @vitejs/plugin-react
```

- [ ] **Step 2: Add Vitest configuration**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/vitest.config.ts`:
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

- [ ] **Step 3: Define sheet mapping and source columns**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/excel-parser.ts`:
```ts
import * as XLSX from 'xlsx'

export const SHEET_MAPPING: Record<string, { typologieCode: string }> = {
  'Terre': { typologieCode: 'TERRES_CULTIVEES' },
  'Bois': { typologieCode: 'TERRES_BOISEES' },
  'Ventes erablière': { typologieCode: 'ERABLIERES' },
  'Ventes erabliere': { typologieCode: 'ERABLIERES' },
}

export const SOURCE_COLUMNS = [
  { headerKeys: ["No d'enregistrement", "No d'enr."], field: 'numeroInscription' },
  { headerKeys: ["Date de L'acte", "Date de l'acte ou de l'avant contrat"], field: 'dateVente' },
  { headerKeys: ['Vendeur'], field: 'vendeur' },
  { headerKeys: ['Acheteur'], field: 'acheteur' },
  { headerKeys: ['Lots'], field: 'lotsCadastraux' },
  { headerKeys: ['Prix de vente', 'Prix de vente ($)', 'Prixdevente($)'], field: 'prixVente' },
  { headerKeys: ['MRC'], field: 'mrc' },
  { headerKeys: ['Ville/Municipalité'], field: 'municipalite' },
  { headerKeys: ['Adresse complete', 'Adresse complète'], field: 'adresse' },
  { headerKeys: ['Superficie Totale (ha)', 'Superficie totale (ha)'], field: 'superficieTotaleHectare' },
  { headerKeys: ['Latitude'], field: 'latitude' },
  { headerKeys: ['Longitude'], field: 'longitude' },
]

export function parseWorkbook(buffer: ArrayBuffer) {
  const workbook = XLSX.read(buffer, { type: 'array' })
  const results: { sheet: string; rows: Record<string, unknown>[]; typologieCode: string }[] = []

  for (const sheetName of workbook.SheetNames) {
    const mapping = SHEET_MAPPING[sheetName]
    if (!mapping) continue

    const worksheet = workbook.Sheets[sheetName]
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: null })
    if (json.length > 0) {
      results.push({ sheet: sheetName, rows: json, typologieCode: mapping.typologieCode })
    }
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

export function rowToSourceFields(row: Record<string, unknown>): Record<string, unknown> {
  const headers = Object.keys(row).map((h) => (h ? h.trim() : null))
  const result: Record<string, unknown> = {}

  for (const col of SOURCE_COLUMNS) {
    const idx = findHeaderIndex(headers, col.headerKeys)
    if (idx !== -1) {
      const key = headers[idx] as string
      result[col.field] = row[key]
    }
  }

  return result
}

const SOURCE_HEADER_SET = new Set(SOURCE_COLUMNS.flatMap((c) => c.headerKeys.map((h) => h.toLowerCase())))

export function isSourceHeader(header: string): boolean {
  return SOURCE_HEADER_SET.has(header.toLowerCase())
}

function isIgnoredHeader(header: string): boolean {
  const h = header.trim().toLowerCase()
  return h === '' || h.startsWith('__empty') || h.startsWith('column')
}

export function extractNonEmptyEnrichmentHeaders(
  rows: Record<string, unknown>[]
): { header: string; sample: unknown }[] {
  if (rows.length === 0) return []
  const allHeaders = Object.keys(rows[0]).filter(Boolean)
  const candidates: { header: string; sample: unknown }[] = []

  for (const header of allHeaders) {
    if (isSourceHeader(header) || isIgnoredHeader(header)) continue
    const trimmedHeader = header.trim()
    const firstNonEmpty = rows.map((r) => r[trimmedHeader]).find((v) => v !== null && v !== undefined && v !== '')
    if (firstNonEmpty !== undefined) {
      candidates.push({ header: trimmedHeader, sample: firstNonEmpty })
    }
  }

  return candidates
}

export function inferType(value: unknown): 'TEXTE' | 'DECIMAL' | 'ENTIER' | 'BOOLEAN' {
  if (typeof value === 'boolean') return 'BOOLEAN'
  if (typeof value === 'number') return Number.isInteger(value) ? 'ENTIER' : 'DECIMAL'
  const str = String(value).trim().replace(',', '.')
  if (!isNaN(Number(str)) && str !== '') return Number.isInteger(Number(str)) ? 'ENTIER' : 'DECIMAL'
  return 'TEXTE'
}
```

- [ ] **Step 4: Create fixture and write parser tests**

Create a minimal workbook at `/Users/fabien/Documents/projets/Evagri/app/my-app/tests/fixtures/minimal.xlsx` containing one sheet named `Terre` with headers:
- `No d'enregistrement` | `Date de L'acte` | `Vendeur` | `Acheteur` | `Lots` | `Prix de vente` | `MRC` | `Ville/Municipalité` | `Adresse complete` | `Superficie Totale (ha)`

and one data row.

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/tests/lib/excel-parser.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseWorkbook, rowToSourceFields, extractNonEmptyEnrichmentHeaders, inferType } from '@/lib/excel-parser'

const fixture = readFileSync(join(__dirname, '../fixtures/minimal.xlsx'))

describe('excel parser', () => {
  it('parses fixture with known sheets', () => {
    const parsed = parseWorkbook(fixture)
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed[0].typologieCode).toBe('TERRES_CULTIVEES')
    expect(parsed[0].rows.length).toBe(1)
  })

  it('maps a row to source fields', () => {
    const row = {
      "No d'enregistrement": '12345',
      "Date de L'acte": '2023-01-15',
      Vendeur: 'Vendeur A',
      Acheteur: 'Acheteur B',
      Lots: '1,2,3',
      'Prix de vente': 50000,
      MRC: 'Nicolet-Yamaska',
      'Ville/Municipalité': 'Nicolet',
      'Adresse complete': '123 rue Principale',
      'Superficie Totale (ha)': 12.5,
    }
    const mapped = rowToSourceFields(row)
    expect(mapped.numeroInscription).toBe('12345')
    expect(mapped.dateVente).toBe('2023-01-15')
    expect(mapped.vendeur).toBe('Vendeur A')
    expect(mapped.acheteur).toBe('Acheteur B')
    expect(mapped.lotsCadastraux).toEqual(['1', '2', '3'])
    expect(mapped.prixVente).toBe(50000)
    expect(mapped.mrc).toBe('Nicolet-Yamaska')
    expect(mapped.municipalite).toBe('Nicolet')
    expect(mapped.adresse).toBe('123 rue Principale')
    expect(mapped.superficieTotaleHectare).toBe(12.5)
  })

  it('ignores empty enrichment columns', () => {
    const rows = [
      { "No d'enregistrement": '1', 'Colonne vide': '', 'Colonne pleine': 'ABC' },
      { "No d'enregistrement": '2', 'Colonne vide': null, 'Colonne pleine': 'DEF' },
    ]
    const candidates = extractNonEmptyEnrichmentHeaders(rows)
    expect(candidates.map((c) => c.header)).toEqual(['Colonne pleine'])
  })

  it('infers decimal type', () => {
    expect(inferType(12.5)).toBe('DECIMAL')
    expect(inferType(12)).toBe('ENTIER')
    expect(inferType('texte')).toBe('TEXTE')
  })
})
```

- [ ] **Step 5: MRC and region**

The MRC is read directly from the `MRC` source column. `regionAdministrative` is not stored on `TransactionSource` in the Alpha schema; the referentiel `Municipalite` table keeps MRC/region mappings for future use.

- [ ] **Step 6: Create geocoding helper (stub for Alpha)**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/geocode.ts`:
```ts
export async function geocodeAddress(query: string): Promise<{ latitude: number; longitude: number } | null> {
  // Alpha stub: returns null. Replace with a Canada-hosted geocoding API (e.g. Nominatim or paid provider) in Beta/RC.
  console.log('Geocoding skipped for Alpha:', query)
  return null
}
```

- [ ] **Step 7: Create transaction import logic**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/transaction-import.ts`:
```ts
import { prisma } from './prisma'
import { geocodeAddress } from './geocode'
import Decimal from 'decimal.js'

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) return value
  if (typeof value === 'number') {
    return new Date(Math.round((value - 25569) * 86400 * 1000))
  }
  if (typeof value === 'string') {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const normalized = String(value).trim().replace(',', '.').replace(/\s/g, '')
  const n = Number(normalized)
  return isNaN(n) ? null : n
}

function parseLots(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'number') return [String(value)]
  if (typeof value === 'string') return value.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  return []
}

export interface ParsedRow {
  numeroInscription: string
  dateVente: string
  vendeur?: string
  acheteur?: string
  lotsCadastraux?: string[]
  prixVente?: number
  mrc?: string
  municipalite?: string
  adresse?: string
  superficieTotaleHectare?: number
  latitude?: number
  longitude?: number
}

export interface EnrichmentChamp {
  id: string
  header: string
  codeMachine: string
  typeDonnees: string
}

function parseEnrichmentValue(
  champ: EnrichmentChamp,
  rawValue: unknown
): { nombre: Decimal | null; texte: string | null; booleen: boolean | null } {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return { nombre: null, texte: null, booleen: null }
  }
  if (champ.typeDonnees === 'BOOLEAN') return { nombre: null, texte: null, booleen: Boolean(rawValue) }
  if (champ.typeDonnees === 'TEXTE') return { nombre: null, texte: String(rawValue), booleen: null }
  const n = Number(String(rawValue).replace(',', '.'))
  if (!isNaN(n)) return { nombre: new Decimal(n), texte: null, booleen: null }
  return { nombre: null, texte: String(rawValue), booleen: null }
}

export async function importTransactions(
  organisationId: string,
  rows: ParsedRow[],
  enrichmentChamps: EnrichmentChamp[],
  rawRows: Record<string, unknown>[],
  typologieId: string,
  systemeSource: string,
  importationId: string
) {
  let inserted = 0
  let ignored = 0
  const errors: { row: number; message: string }[] = []

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i]
    try {
      if (!raw.numeroInscription || !raw.dateVente) {
        throw new Error('Missing numeroInscription or dateVente')
      }

      const dateVente = parseDate(raw.dateVente)
      if (!dateVente) throw new Error(`Invalid date: ${raw.dateVente}`)

      const numeroInscription = String(raw.numeroInscription).trim()
      const lots = parseLots(raw.lotsCadastraux)
      const prixVente = parseNumber(raw.prixVente)
      const superficieTotaleHectare = parseNumber(raw.superficieTotaleHectare)
      const latitude = parseNumber(raw.latitude)
      const longitude = parseNumber(raw.longitude)

      let coords: { latitude: number; longitude: number } | null = null
      if (latitude !== null && longitude !== null) {
        coords = { latitude, longitude }
      } else {
        const geoQuery = [raw.adresse, raw.municipalite].filter(Boolean).join(', ')
        coords = geoQuery ? await geocodeAddress(geoQuery) : null
      }

      if (dateVente > new Date()) {
        throw new Error('V-004: date de vente postérieure à aujourd\'hui')
      }

      const existing = await prisma.transactionSource.findUnique({
        where: {
          organisationId_numeroInscription_dateVente: {
            organisationId,
            numeroInscription,
            dateVente,
          },
        },
      })

      if (existing) {
        ignored++
        continue
      }

      await prisma.$transaction(async (tx) => {
        const txSource = await tx.transactionSource.create({
          data: {
            organisationId,
            importationId,
            systemeSource,
            numeroInscription,
            dateVente,
            prixVente: prixVente !== null ? new Decimal(prixVente) : null,
            vendeur: raw.vendeur || null,
            acheteur: raw.acheteur || null,
            lotsCadastraux: lots,
            adresse: raw.adresse || null,
            municipalite: raw.municipalite || null,
            mrc: raw.mrc || null,
            superficieTotaleHectare: superficieTotaleHectare !== null ? new Decimal(superficieTotaleHectare) : null,
            latitude: coords?.latitude !== undefined ? new Decimal(coords.latitude) : null,
            longitude: coords?.longitude !== undefined ? new Decimal(coords.longitude) : null,
          },
        })

        const enrichie = await tx.transactionEnrichie.create({
          data: {
            organisationId,
            transactionSourceId: txSource.id,
            statut: 'NON_ANALYSEE',
          },
        })

        const raw = rawRows[i]
        for (const champ of enrichmentChamps) {
          const parsed = parseEnrichmentValue(champ, raw?.[champ.header])
          if (parsed.nombre !== null || parsed.texte !== null || parsed.booleen !== null) {
            await tx.valeurEnrichissement.create({
              data: {
                transactionEnrichieId: enrichie.id,
                champEnrichissableId: champ.id,
                valeurNombre: parsed.nombre,
                valeurTexte: parsed.texte,
                valeurBooleen: parsed.booleen,
              },
            })
          }
        }
      })

      inserted++
    } catch (e) {
      errors.push({ row: i + 2, message: (e as Error).message })
    }
  }

  return { inserted, ignored, errors }
}
```

- [ ] **Step 8: Create import Server Action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/import.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { parseWorkbook, rowToSourceFields, extractNonEmptyEnrichmentHeaders, inferType } from '@/lib/excel-parser'
import { importTransactions } from '@/lib/transaction-import'
import { logAudit } from '@/lib/audit'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

async function ensureEnrichmentChamps(
  organisationId: string,
  sheetRows: Record<string, unknown>[]
) {
  const candidates = extractNonEmptyEnrichmentHeaders(sheetRows)
  const result: { id: string; header: string; codeMachine: string; typeDonnees: string }[] = []

  for (const candidate of candidates) {
    const codeMachine = candidate.header
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .replace(/_+/g, '_')

    const existing = await prisma.champEnrichissable.findUnique({
      where: { organisationId_codeMachine: { organisationId, codeMachine } },
    })

    if (existing) {
      result.push({ id: existing.id, header: candidate.header, codeMachine, typeDonnees: existing.typeDonnees })
    } else {
      const created = await prisma.champEnrichissable.create({
        data: {
          organisationId,
          codeMachine,
          nomAffichage: candidate.header,
          typeDonnees: inferType(candidate.sample),
          nature: 'SAISISSABLE',
          unite: 'N/A',
          applicableATypes: [],
        },
      })
      result.push({ id: created.id, header: candidate.header, codeMachine, typeDonnees: created.typeDonnees })
    }
  }

  return result
}

export async function importExcel(formData: FormData) {
  const file = formData.get('file') as File
  if (!file) throw new Error('No file provided')

  const buffer = Buffer.from(await file.arrayBuffer())
  const parsed = parseWorkbook(buffer)
  if (parsed.length === 0) throw new Error('Aucune feuille reconnue (Terre, Bois, Ventes erablière)')

  const org = await prisma.organisation.findFirst({ where: { id: DEFAULT_ORG_ID } })
  if (!org) throw new Error('Organisation par défaut non initialisée')

  const importation = await prisma.importation.create({
    data: {
      organisationId: org.id,
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

  try {
    for (const sheet of parsed) {
      const typologie = await prisma.typologie.findUnique({
        where: { organisationId_code: { organisationId: org.id, code: sheet.typologieCode } },
      })
      if (!typologie) {
        allErrors.push({ sheet: sheet.sheet, row: 0, message: `Typologie ${sheet.typologieCode} inconnue` })
        continue
      }

      const enrichmentChamps = await ensureEnrichmentChamps(org.id, sheet.rows)
      const rows = sheet.rows.map((r) => rowToSourceFields(r) as any)
      totalRows += rows.length

      const { inserted, ignored, errors } = await importTransactions(
        org.id,
        rows,
        enrichmentChamps,
        sheet.rows,
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
  } catch (e) {
    await prisma.importation.update({
      where: { id: importation.id },
      data: {
        statut: 'EN_ECHEC',
        lignesErreurs: 1,
        details: { error: (e as Error).message },
      },
    })
    throw e
  }

  await logAudit({
    organisationId: org.id,
    tableCible: 'importation',
    enregistrementId: importation.id,
    action: 'INSERT',
    diff: { lignesTotal: totalRows, lignesInserees: totalInserted, typeSource: 'EXISTANT_EVAGRI' },
  })

  return {
    importationId: importation.id,
    totalRows,
    inserted: totalInserted,
    ignored: totalIgnored,
    errors: allErrors,
  }
}

export async function listImports() {
  const org = await prisma.organisation.findFirst({ where: { id: DEFAULT_ORG_ID } })
  if (!org) throw new Error('Organisation par défaut non initialisée')

  return prisma.importation.findMany({
    where: { organisationId: org.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
}

export async function retryImport(importationId: string) {
  const org = await prisma.organisation.findFirst({ where: { id: DEFAULT_ORG_ID } })
  if (!org) throw new Error('Organisation par défaut non initialisée')

  const importation = await prisma.importation.findFirst({
    where: { id: importationId, organisationId: org.id },
  })
  if (!importation) throw new Error('Importation introuvable')
  if (importation.typeSource === 'EXISTANT_EVAGRI') {
    throw new Error('Relance non disponible pour les imports Excel manuels. Veuillez ré-uploader le fichier.')
  }

  await prisma.importation.update({
    where: { id: importationId },
    data: { statut: 'EN_COURS', lignesErreurs: 0, details: {} },
  })

  // JLR retry hook for RC phase
  return { success: true, message: 'Importation marquée pour relance.' }
}
```

- [ ] **Step 9: Create import admin UI**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/import-excel-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { importExcel } from '@/server/actions/import'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'

export function ImportExcelForm({ onImported }: { onImported?: () => void }) {
  const [report, setReport] = useState<{
    totalRows: number
    inserted: number
    ignored: number
    errors: { sheet: string; row: number; message: string }[]
  } | null>(null)

  async function handleSubmit(formData: FormData) {
    const res = await importExcel(formData)
    setReport(res)
    onImported?.()
  }

  return (
    <div>
      <form action={handleSubmit} className="space-y-4 mb-8">
        <div>
          <Label htmlFor="file">Fichier Excel EVAGRI (.xlsx)</Label>
          <input id="file" name="file" type="file" accept=".xlsx" required className="block mt-1" />
        </div>
        <Button type="submit">Importer</Button>
      </form>
      {report && (
        <div className="border rounded p-4 space-y-1">
          <p>Lignes total: {report.totalRows}</p>
          <p>Insérées: {report.inserted}</p>
          <p>Ignorées (doublons): {report.ignored}</p>
          <p>Erreurs: {report.errors.length}</p>
          {report.errors.length > 0 && (
            <ul className="mt-2 max-h-60 overflow-auto border rounded p-2">
              {report.errors.slice(0, 50).map((e, i) => (
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

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/import-history.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { retryImport } from '@/server/actions/import'
import { Button } from '@/components/ui/button'

type Importation = {
  id: string
  typeSource: string
  statut: string
  lignesTotal: number
  lignesInserees: number
  lignesIgnorees: number
  lignesErreurs: number
  details: any
  createdAt: Date
}

const STATUS_LABELS: Record<string, string> = {
  EN_COURS: 'En cours',
  TERMINE: 'Terminé',
  TERMINE_AVEC_ERREURS: 'Terminé avec erreurs',
  EN_ECHEC: 'En échec',
}

const STATUS_CLASSES: Record<string, string> = {
  EN_COURS: 'bg-blue-100 text-blue-800',
  TERMINE: 'bg-green-100 text-green-800',
  TERMINE_AVEC_ERREURS: 'bg-yellow-100 text-yellow-800',
  EN_ECHEC: 'bg-red-100 text-red-800',
}

export function ImportHistory({ initialImports }: { initialImports: Importation[] }) {
  const [imports, setImports] = useState(initialImports)
  const [selected, setSelected] = useState<Importation | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function handleRetry(id: string) {
    try {
      const res = await retryImport(id)
      setMessage(res.message)
      setImports((prev) =>
        prev.map((imp) => (imp.id === id ? { ...imp, statut: 'EN_COURS' } : imp))
      )
    } catch (e) {
      setMessage((e as Error).message)
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div className="border rounded p-3 bg-stone-50 text-sm">{message}</div>
      )}
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
            <tr key={imp.id} className="border-b hover:bg-stone-50">
              <td className="p-2">{new Date(imp.createdAt).toLocaleString('fr-CA')}</td>
              <td className="p-2">{imp.typeSource}</td>
              <td className="p-2">
                <span className={`px-2 py-1 rounded text-xs ${STATUS_CLASSES[imp.statut] || 'bg-gray-100'}`}>
                  {STATUS_LABELS[imp.statut] || imp.statut}
                </span>
              </td>
              <td className="p-2">{imp.lignesTotal}</td>
              <td className="p-2">{imp.lignesInserees}</td>
              <td className="p-2">{imp.lignesIgnorees}</td>
              <td className="p-2">{imp.lignesErreurs}</td>
              <td className="p-2">
                <Button variant="outline" size="sm" onClick={() => setSelected(imp)}>
                  Détails
                </Button>
                {imp.statut === 'EN_ECHEC' && (
                  <Button variant="secondary" size="sm" className="ml-2" onClick={() => handleRetry(imp.id)}>
                    Relancer
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {selected && (
        <div className="border rounded p-4">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-medium">Détails de l'import {selected.id.slice(0, 8)}</h3>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Fermer
            </Button>
          </div>
          <pre className="text-xs bg-stone-100 p-2 rounded overflow-auto max-h-60">
            {JSON.stringify(selected.details, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/import/page.tsx`:
```tsx
import { ImportExcelForm } from '@/components/import-excel-form'
import { ImportHistory } from '@/components/import-history'
import { listImports } from '@/server/actions/import'

export default async function ImportPage() {
  const imports = await listImports()

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-6">Gestion des imports</h1>
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Importer un fichier Excel EVAGRI</h2>
          <ImportExcelForm />
        </section>
        <section>
          <h2 className="text-lg font-semibold mb-4">Historique des importations</h2>
          <ImportHistory initialImports={imports} />
        </section>
      </div>
    </main>
  )
}
```

- [ ] **Step 10: Run parser tests**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm run test
```
Expected: tests pass.

- [ ] **Step 11: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(import): add Excel parser and historical data import"
```

---

## Task 4: Transaction table with configurable filters

**Files:**
- Create: `src/server/actions/transaction.ts`
- Create: `src/server/actions/filters.ts`
- Create: `src/lib/filters.ts`
- Create: `src/components/transaction-table.tsx`
- Create: `src/components/transaction-filters.tsx`
- Create: `src/app/transactions/page.tsx`
- Create: `src/app/api/transactions/route.ts`

- [ ] **Step 1: Create filter-to-Prisma converter**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/lib/filters.ts`:
```ts
import { Prisma } from '@prisma/client'

export interface FilterInput {
  id: string
  typeFiltre: string
  field: string
  operator: string
  value: string
}

export function buildWhereClause(filters: FilterInput[]): Prisma.TransactionSourceWhereInput {
  const andClauses: Prisma.TransactionSourceWhereInput[] = []

  for (const f of filters) {
    if (!f.value && f.value !== '0') continue

    const field = f.field as keyof Prisma.TransactionSourceWhereInput
    let clause: Prisma.TransactionSourceWhereInput = {}

    switch (f.typeFiltre) {
      case 'RECHERCHE_TEXTE':
        clause = {
          OR: [
            { numeroInscription: { contains: f.value, mode: 'insensitive' } },
            { vendeur: { contains: f.value, mode: 'insensitive' } },
            { acheteur: { contains: f.value, mode: 'insensitive' } },
            { municipalite: { contains: f.value, mode: 'insensitive' } },
          ],
        }
        break
      case 'PLAGE_NUMERIQUE':
        if (f.operator === 'entre') {
          const [min, max] = f.value.split('-').map(Number)
          clause = { [field]: { gte: min, lte: max } }
        } else if (f.operator === '+') {
          clause = { [field]: { gte: Number(f.value) } }
        } else if (f.operator === '-') {
          clause = { [field]: { lte: Number(f.value) } }
        } else {
          clause = { [field]: { equals: Number(f.value) } }
        }
        break
      case 'PLAGE_DATE':
        if (f.operator === 'entre') {
          const [start, end] = f.value.split(',').map((s) => new Date(s.trim()))
          clause = { [field]: { gte: start, lte: end } }
        } else if (f.operator === '+') {
          clause = { [field]: { gte: new Date(f.value) } }
        } else if (f.operator === '-') {
          clause = { [field]: { lte: new Date(f.value) } }
        } else {
          clause = { [field]: { equals: new Date(f.value) } }
        }
        break
      case 'LISTE':
      case 'MULTI_SELECT':
        clause = { [field]: { in: f.value.split(',') } }
        break
      case 'BOOLEEN':
        clause = { [field]: f.value === 'true' }
        break
    }

    andClauses.push(clause)
  }

  return andClauses.length > 0 ? { AND: andClauses } : {}
}
```

- [ ] **Step 2: Create transaction search Server Action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/transaction.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { buildWhereClause, FilterInput } from '@/lib/filters'
import Decimal from 'decimal.js'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export async function searchTransactions(input: {
  page?: number
  pageSize?: number
  filters?: FilterInput[]
  sortField?: string
  sortOrder?: 'asc' | 'desc'
}) {
  const page = input.page ?? 1
  const pageSize = input.pageSize ?? 10
  const orgId = DEFAULT_ORG_ID

  const filterWhere = buildWhereClause(input.filters || [])
  const where = {
    organisationId: orgId,
    ...filterWhere,
  }

  const orderBy: any = input.sortField
    ? { [input.sortField]: input.sortOrder ?? 'asc' }
    : { dateVente: 'desc' }

  const [transactions, total] = await Promise.all([
    prisma.transactionSource.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
      include: { enrichie: true },
    }),
    prisma.transactionSource.count({ where }),
  ])

  return {
    transactions: transactions.map((t) => ({
      ...t,
      prixVente: t.prixVente ? new Decimal(t.prixVente.toString()).toNumber() : null,
      superficieTotaleHectare: t.superficieTotaleHectare ? new Decimal(t.superficieTotaleHectare.toString()).toNumber() : null,
    })),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
```

- [ ] **Step 3: Create filter administration Server Actions**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/server/actions/filters.ts`:
```ts
'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export async function listFilters() {
  return prisma.filtreRecherche.findMany({
    where: { organisationId: DEFAULT_ORG_ID },
    orderBy: { ordreAffichage: 'asc' },
    include: { champEnrichissable: true },
  })
}

export async function createFilter(formData: FormData) {
  const nomFiltre = formData.get('nomFiltre') as string
  const typeFiltre = formData.get('typeFiltre') as string
  const field = formData.get('field') as string
  const operateurs = formData.get('operateurs') as string
  const ordre = Number(formData.get('ordreAffichage') || 0)

  let champEnrichissableId: string | null = null
  if (field.startsWith('champ:')) {
    champEnrichissableId = field.replace('champ:', '')
  }

  await prisma.filtreRecherche.create({
    data: {
      organisationId: DEFAULT_ORG_ID,
      nomFiltre,
      typeFiltre,
      champEnrichissableId,
      operateursDisponibles: operateurs ? JSON.parse(operateurs) : null,
      ordreAffichage: ordre,
    },
  })

  revalidatePath('/admin/filters')
}

export async function updateFilterOrder(filters: { id: string; ordreAffichage: number; estActif: boolean }[]) {
  for (const f of filters) {
    await prisma.filtreRecherche.update({
      where: { id: f.id },
      data: { ordreAffichage: f.ordreAffichage, estActif: f.estActif },
    })
  }
  revalidatePath('/admin/filters')
}

export async function deleteFilter(id: string) {
  await prisma.filtreRecherche.delete({ where: { id } })
  revalidatePath('/admin/filters')
}
```

- [ ] **Step 4: Create filters admin UI**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/filters-admin-form.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { createFilter, deleteFilter, updateFilterOrder } from '@/server/actions/filters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const FILTER_TYPES = [
  'PLAGE_NUMERIQUE',
  'PLAGE_DATE',
  'LISTE',
  'MULTI_SELECT',
  'RECHERCHE_TEXTE',
  'BOOLEEN',
]

export function FiltersAdminForm({
  filters,
  champs,
  sourceFields,
}: {
  filters: any[]
  champs: any[]
  sourceFields: { value: string; label: string }[]
}) {
  const [items, setItems] = useState(filters)

  const fieldOptions = [
    ...sourceFields,
    ...champs.map((c) => ({ value: `champ:${c.id}`, label: `[${c.nature}] ${c.nomAffichage}` })),
  ]

  return (
    <div className="space-y-6">
      <form
        action={async (formData) => {
          await createFilter(formData)
          window.location.reload()
        }}
        className="grid grid-cols-5 gap-2 items-end"
      >
        <div>
          <Label htmlFor="nomFiltre">Nom</Label>
          <Input id="nomFiltre" name="nomFiltre" required />
        </div>
        <div>
          <Label htmlFor="typeFiltre">Type</Label>
          <select id="typeFiltre" name="typeFiltre" className="w-full border rounded p-2" required>
            {FILTER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="field">Champ cible</Label>
          <select id="field" name="field" className="w-full border rounded p-2" required>
            {fieldOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="ordreAffichage">Ordre</Label>
          <Input id="ordreAffichage" name="ordreAffichage" type="number" defaultValue={0} />
        </div>
        <Button type="submit">Ajouter</Button>
      </form>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2">Nom</th>
            <th className="text-left p-2">Type</th>
            <th className="text-left p-2">Ordre</th>
            <th className="text-left p-2">Actif</th>
            <th className="text-left p-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((f) => (
            <tr key={f.id} className="border-b">
              <td className="p-2">{f.nomFiltre}</td>
              <td className="p-2">{f.typeFiltre}</td>
              <td className="p-2">
                <input
                  type="number"
                  defaultValue={f.ordreAffichage}
                  className="w-20 border rounded p-1"
                  onChange={async (e) => {
                    const ordre = Number(e.target.value)
                    const next = items.map((i) => (i.id === f.id ? { ...i, ordreAffichage: ordre } : i))
                    setItems(next)
                    await updateFilterOrder(next.map((i) => ({ id: i.id, ordreAffichage: i.ordreAffichage, estActif: i.estActif })))
                  }}
                />
              </td>
              <td className="p-2">
                <input
                  type="checkbox"
                  defaultChecked={f.estActif}
                  onChange={async (e) => {
                    const next = items.map((i) => (i.id === f.id ? { ...i, estActif: e.target.checked } : i))
                    setItems(next)
                    await updateFilterOrder(next.map((i) => ({ id: i.id, ordreAffichage: i.ordreAffichage, estActif: i.estActif })))
                  }}
                />
              </td>
              <td className="p-2">
                <Button variant="destructive" size="sm" onClick={async () => { await deleteFilter(f.id); window.location.reload() }}>
                  Supprimer
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/admin/filters/page.tsx`:
```tsx
import { prisma } from '@/lib/prisma'
import { FiltersAdminForm } from '@/components/filters-admin-form'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

const SOURCE_FIELDS = [
  { value: 'numeroInscription', label: "N° d'inscription" },
  { value: 'dateVente', label: 'Date de vente' },
  { value: 'prixVente', label: 'Prix de vente' },
  { value: 'mrc', label: 'MRC' },
  { value: 'municipalite', label: 'Municipalité' },
  { value: 'superficieTotaleHectare', label: 'Superficie totale (ha)' },
]

export default async function FiltersAdminPage() {
  const [filters, champs] = await Promise.all([
    prisma.filtreRecherche.findMany({
      where: { organisationId: DEFAULT_ORG_ID },
      orderBy: { ordreAffichage: 'asc' },
      include: { champEnrichissable: true },
    }),
    prisma.champEnrichissable.findMany({ where: { organisationId: DEFAULT_ORG_ID } }),
  ])

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Configuration des filtres de recherche</h1>
      <FiltersAdminForm filters={filters} champs={champs} sourceFields={SOURCE_FIELDS} />
    </main>
  )
}
```

- [ ] **Step 5: Create transaction table component**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/transaction-table.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

type TransactionRow = {
  id: string
  numeroInscription: string
  dateVente: Date
  mrc: string | null
  municipalite: string | null
  superficieTotaleHectare: number | null
  prixVente: number | null
  enrichie?: { statut: string } | null
}

const COLUMNS = [
  { key: 'numeroInscription', label: "N° d'inscription" },
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
    transactions: TransactionRow[]
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
  const [filters, setFilters] = useState<any[]>([])

  async function loadPage(newPage: number) {
    const params = new URLSearchParams({
      page: String(newPage),
      sortField,
      sortOrder,
      filters: JSON.stringify(filters),
    })
    const res = await fetch(`/api/transactions?${params.toString()}`)
    const json = await res.json()
    setData(json)
  }

  function toggleColumn(key: string) {
    setHiddenColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  function handleSort(key: string) {
    const nextOrder = sortField === key && sortOrder === 'asc' ? 'desc' : 'asc'
    setSortField(key)
    setSortOrder(nextOrder)
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
                {!hiddenColumns.includes('numeroInscription') && <td className="p-2">{t.numeroInscription}</td>}
                {!hiddenColumns.includes('dateVente') && (
                  <td className="p-2">{new Date(t.dateVente).toLocaleDateString('fr-CA')}</td>
                )}
                {!hiddenColumns.includes('mrc') && <td className="p-2">{t.mrc}</td>}
                {!hiddenColumns.includes('municipalite') && <td className="p-2">{t.municipalite}</td>}
                {!hiddenColumns.includes('superficieTotaleHectare') && (
                  <td className="p-2">{t.superficieTotaleHectare ?? '-'}</td>
                )}
                {!hiddenColumns.includes('prixVente') && (
                  <td className="p-2">{t.prixVente ? t.prixVente.toLocaleString('fr-CA') : '-'}</td>
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
        <Button disabled={data.page <= 1} onClick={() => loadPage(data.page - 1)}>
          Précédent
        </Button>
        <span>Page {data.page} / {data.totalPages}</span>
        <Button disabled={data.page >= data.totalPages} onClick={() => loadPage(data.page + 1)}>
          Suivant
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Create public filter search component**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/transaction-filters.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function TransactionFilters({
  filtersConfig,
  onSearch,
}: {
  filtersConfig: any[]
  onSearch: (filters: any[]) => void
}) {
  const [values, setValues] = useState<Record<string, { operator: string; value: string }>>({})

  function handleSearch() {
    const active = Object.entries(values)
      .filter(([_, v]) => v.value !== '')
      .map(([id, v]) => {
        const config = filtersConfig.find((f) => f.id === id)
        const field = config?.champEnrichissable?.codeMachine || id
        return { id, typeFiltre: config.typeFiltre, field, operator: v.operator, value: v.value }
      })
    onSearch(active)
  }

  return (
    <div className="space-y-3 mb-4">
      <p className="font-medium">Filtres</p>
      {filtersConfig
        .filter((f) => f.estActif)
        .sort((a: any, b: any) => a.ordreAffichage - b.ordreAffichage)
        .map((f) => (
          <div key={f.id} className="flex gap-2 items-center">
            <span className="w-40 text-sm">{f.nomFiltre}</span>
            <select
              className="border rounded p-1 text-sm"
              value={values[f.id]?.operator || '='}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.id]: { ...(prev[f.id] || { value: '' }), operator: e.target.value } }))
              }
            >
              <option value="=">=</option>
              <option value="+">+</option>
              <option value="-">-</option>
              <option value="entre">entre</option>
              <option value="contient">contient</option>
            </select>
            <Input
              className="flex-1 text-sm"
              placeholder="valeur"
              value={values[f.id]?.value || ''}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [f.id]: { ...(prev[f.id] || { operator: '=' }), value: e.target.value } }))
              }
            />
          </div>
        ))}
      <Button onClick={handleSearch}>Rechercher</Button>
    </div>
  )
}
```

- [ ] **Step 7: Create transactions page**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/transactions/page.tsx`:
```tsx
'use client'

import { useState } from 'react'
import { searchTransactions } from '@/server/actions/transaction'
import { TransactionTable } from '@/components/transaction-table'
import { TransactionFilters } from '@/components/transaction-filters'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export default function TransactionsPage() {
  const [data, setData] = useState<any>(null)
  const [filters, setFilters] = useState<any[]>([])

  async function handleSearch(newFilters: any[]) {
    setFilters(newFilters)
    const res = await searchTransactions({ page: 1, filters: newFilters })
    setData(res)
  }

  if (!data) {
    ;(async () => {
      const initial = await searchTransactions({ page: 1, filters: [] })
      setData(initial)
    })()
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold mb-4">Liste des transactions</h1>
      <TransactionFilters filtersConfig={[]} onSearch={handleSearch} />
      {data ? <TransactionTable initialData={data} /> : <p>Chargement...</p>}
    </main>
  )
}
```

Note: in Alpha the filters configuration is loaded server-side in the final implementation; replace `filtersConfig={[]}` by fetching from `/admin/filters` route or a server prop. For this task, add a small wrapper that loads config in `useEffect`.

- [ ] **Step 8: Create API route for paginated table**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/api/transactions/route.ts`:
```ts
import { searchTransactions } from '@/server/actions/transaction'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = parseInt(searchParams.get('page') ?? '1', 10)
  const sortField = searchParams.get('sortField') ?? 'dateVente'
  const sortOrder = (searchParams.get('sortOrder') ?? 'desc') as 'asc' | 'desc'
  const filters = JSON.parse(searchParams.get('filters') ?? '[]')

  const data = await searchTransactions({ page, sortField, sortOrder, filters })
  return NextResponse.json(data)
}
```

- [ ] **Step 9: Add tests for search action**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/tests/server/transaction.test.ts`:
```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { searchTransactions } from '@/server/actions/transaction'
import { prisma } from '@/lib/prisma'

describe('searchTransactions', () => {
  let orgId: string

  beforeAll(async () => {
    const org = await prisma.organisation.create({ data: { nom: 'Test Org' } })
    orgId = org.id
    process.env.DEFAULT_ORGANISATION_ID = orgId

    await prisma.transactionSource.create({
      data: {
        organisationId: orgId,
        systemeSource: 'EXISTANT_EVAGRI',
        numeroInscription: '12345',
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
    const res = await searchTransactions({ page: 1, pageSize: 10 })
    expect(res.transactions.length).toBeGreaterThan(0)
    expect(res.total).toBeGreaterThan(0)
    expect(res.totalPages).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 10: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(transactions): add searchable paginated table and filter admin"
```

---

## Task 5: Interactive OSM map

**Files:**
- Create: `src/components/transaction-map.tsx`
- Create: `src/app/transactions/map/page.tsx`
- Create: `src/app/api/transactions/map/route.ts`
- Create: `public/pin.svg`

- [ ] **Step 1: Install Leaflet**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
npm install leaflet react-leaflet leaflet.markercluster
npm install -D @types/leaflet @types/leaflet.markercluster
```

- [ ] **Step 2: Create map data API**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/api/transactions/map/route.ts`:
```ts
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

const DEFAULT_ORG_ID = process.env.DEFAULT_ORGANISATION_ID || ''

export async function GET() {
  const transactions = await prisma.transactionSource.findMany({
    where: {
      organisationId: DEFAULT_ORG_ID,
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

- [ ] **Step 3: Create map component with clustering**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/components/transaction-map.tsx`:
```tsx
'use client'

import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
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

function ClusterLayer({ transactions }: { transactions: MapTransaction[] }) {
  const map = useMap()

  useEffect(() => {
    const group = L.markerClusterGroup()
    transactions.forEach((t) => {
      const marker = L.marker([Number(t.latitude), Number(t.longitude)], { icon: pinIcon })
      marker.bindPopup(
        `<div>
          <strong>${t.numeroInscription}</strong>
          <p>${t.municipalite || ''}</p>
          <p>Date: ${new Date(t.dateVente).toLocaleDateString('fr-CA')}</p>
          <p>Prix: ${t.prixVente ? t.prixVente.toLocaleString('fr-CA') : '-'} $</p>
          <p>Superficie: ${t.superficieTotaleHectare ?? '-'} ha</p>
        </div>`
      )
      group.addLayer(marker)
    })
    map.addLayer(group)
    return () => {
      map.removeLayer(group)
    }
  }, [map, transactions])

  return null
}

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
      <ClusterLayer transactions={transactions} />
    </MapContainer>
  )
}
```

- [ ] **Step 4: Add pin SVG**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/public/pin.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="36" viewBox="0 0 24 36" fill="#66995c">
  <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24c0-6.6-5.4-12-12-12z"/>
  <circle cx="12" cy="12" r="5" fill="#fff"/>
</svg>
```

- [ ] **Step 5: Create map page**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/transactions/map/page.tsx`:
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

- [ ] **Step 6: Add navigation and healthcheck**

Modify `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/layout.tsx` to include:
```tsx
import Link from 'next/link'

function NavBar() {
  return (
    <nav className="bg-stone-900 text-white p-4 flex gap-6">
      <Link href="/transactions">Liste</Link>
      <Link href="/transactions/map">Carte</Link>
      <Link href="/admin/import">Import</Link>
      <Link href="/admin/filters">Filtres</Link>
    </nav>
  )
}
```

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/src/app/api/health/route.ts`:
```ts
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
```

- [ ] **Step 7: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "feat(map): add interactive OSM map with clustered transaction pins"
```

---

## Task 6: Production build and deployment prep

**Files:**
- Modify: `Dockerfile`
- Create: `scripts/backup.sh`
- Create: `scripts/restore.sh`
- Create: `README.md`

- [ ] **Step 1: Add healthcheck to Dockerfile**

Append to the runner stage of `/Users/fabien/Documents/projets/Evagri/app/my-app/Dockerfile`:
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"
```

- [ ] **Step 2: Verify production build**

Run:
```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
docker compose down
docker compose up --build -d
```
Expected: app builds and runs.

- [ ] **Step 3: Add backup and restore scripts**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/scripts/backup.sh`:
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

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/scripts/restore.sh`:
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

Make them executable:
```bash
chmod +x scripts/backup.sh scripts/restore.sh
```

- [ ] **Step 4: Document local and Coolify deployment**

Create `/Users/fabien/Documents/projets/Evagri/app/my-app/README.md`:
```markdown
# EVAGRI

## Local development

```bash
cp .env.example .env
# Set DEFAULT_ORGANISATION_ID after first seed
npm install
docker compose up -d
npx prisma migrate dev
npm run db:seed
npm run dev
```

## Alpha scope

- Schéma de données MVP complet.
- Import manuel de la base Excel EVAGRI.
- Tableau dynamique des transactions.
- Carte interactive OSM avec regroupement de pins.
- Administration des filtres de recherche.

## Coolify deployment

1. Provisionner un VPS OVHcloud Canada (Beauharnois) avec Docker.
2. Installer Coolify sur le VPS.
3. Créer une ressource à partir du dépôt Git.
4. Définir `DEFAULT_ORGANISATION_ID` et les variables S3 dans `.env.example`.
5. Ajouter un service PostgreSQL dans Coolify et lier `DATABASE_URL`.
6. Lancer `npm run db:migrate` et `npm run db:seed` une fois.
7. Configurer une tâche planifiée pour `scripts/backup.sh`.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/fabien/Documents/projets/Evagri/app/my-app
git add -A
git commit -m "chore(deploy): add healthcheck, backup scripts and deployment docs"
```

---

## Task 7: Self-review and gap fix

- [ ] **Step 1: Spec coverage check**

| Cahier Alpha | Tâche |
|---|---|
| Import Excel EVAGRI | Task 3 |
| BD transactions (tableau dynamique) | Task 4 |
| Carte interactive OSM | Task 5 |
| Écran administrateur filtres | Task 4 |
| Hébergement Canada / Docker | Task 1, 6 |

Aucun écart identifié.

- [ ] **Step 2: Placeholder scan**

Search the plan for `TODO`, `TBD`, `implement later`, `fill in details`. Fix any found before saving.

- [ ] **Step 3: Type consistency check**

- `searchTransactions` returns `{ transactions, total, page, pageSize, totalPages }` consistently.
- `importExcel` returns `{ importationId, totalRows, inserted, ignored, errors }` consistently.
- Decimal values are converted to plain numbers for JSON serialization in the table API.

- [ ] **Step 4: Final commit of plan**

```bash
cd /Users/fabien/Documents/projets/Evagri
git add docs/superpowers/plans/2026-06-17-alpha-fondations-import-tableau-carte-filtres.md
git commit -m "docs(plan): add Alpha implementation plan"
```

---

## Execution Handoff

**Plan Alpha complet et sauvegardé dans `docs/superpowers/plans/2026-06-17-alpha-fondations-import-tableau-carte-filtres.md`.**

Deux options d'exécution :

1. **Subagent-Driven (recommandé)** — un sous-agent par tâche, revue entre chaque tâche.
2. **Inline Execution** — exécution directe dans cette session avec `superpowers:executing-plans`.

**Quelle approche ?**
