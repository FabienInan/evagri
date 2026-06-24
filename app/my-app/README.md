# EVAGRI

Application web de gestion et d'analyse des transactions foncières agricoles.

## Local development

```bash
cp .env.example .env
npm install
# Start PostgreSQL (Docker or local)
docker compose up -d
# or use a local PostgreSQL 14+ cluster
npx prisma migrate dev
npm run db:seed
npm run dev
```

After the first seed, copy the generated organisation id into `DEFAULT_ORGANISATION_ID` in `.env`.

## Alpha scope

- MVP Prisma schema with organisations, utilisateurs, transactions source/enrichies, filtres, typologies, dossiers, etc.
- Import manuel de la base Excel EVAGRI historique (feuilles Terre, Bois, Ventes erablière).
- Détection automatique des colonnes sources vs colonnes d'enrichissement.
- Tableau dynamique des transactions avec tri, pagination et colonnes masquables.
- Carte interactive OSM avec regroupement de pins.
- Administration des filtres de recherche.
- Historique des importations avec retry (non disponible pour les imports Excel manuels).

## Scripts

- `npm run db:migrate` — Prisma migrate dev
- `npm run db:seed` — seed organisation par défaut, typologies, municipalités et champs sources
- `npm run test` — Vitest
- `scripts/backup.sh` — sauvegarde PostgreSQL vers Object Storage S3
- `scripts/restore.sh <backup_file>` — restauration depuis Object Storage S3

## Coolify deployment

1. Provisionner un VPS OVHcloud Canada (Beauharnois) avec Docker.
2. Installer Coolify sur le VPS.
3. Créer une ressource à partir du dépôt Git.
4. Définir `DEFAULT_ORGANISATION_ID` et les variables S3 dans l'environnement Coolify.
5. Ajouter un service PostgreSQL dans Coolify et lier `DATABASE_URL`.
6. Lancer `npm run db:migrate` et `npm run db:seed` une fois.
7. Configurer une tâche planifiée pour `scripts/backup.sh`.
