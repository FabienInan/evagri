# Dossiers et paniers — conception

**Date :** 2026-10-17
**Portée :** `app/src/app/(app)/dossiers`, `app/prisma`, `app/src/components`, `app/src/server/actions`, `app/src/repositories`, `app/src/validators`, `app/src/lib`, `app/tests`
**Cahier des charges :** §7.7 (dossiers et paniers), §9 (livrable bêta — fin octobre), §6 (modèle)

## Contexte

La phase bêta (fin octobre, §9) ajoute le **panier de dossiers comparables** : un évaluateur regroupe
des transactions analysées dans un dossier, puis dans des paniers (sous-ensembles typés), pour les
comparer et alimenter l'analyse de dossier (§7.8).

Le **modèle de données est déjà en place** (vérifié dans `app/prisma/schema.prisma`) : `Dossier`,
`Panier`, `PanierTransaction` (table de jointure `@@id([panierId, transactionId])`),
`AnalyseDossier`, `ParametresAnalyseTransaction`, `IndicateursAjustes`. **Aucune migration n'est
nécessaire pour cette passe.** La brique applicative, en revanche, est vide : il n'existe ni route
(`/dossiers`, `/paniers`), ni action serveur (`dossier.ts`), ni repository (`dossier.repository.ts`),
ni validateur, ni entrée de navigation. Le bouton « Ajouter au panier » de `transaction-table.tsx`
(`Actions`) n'a pas de `onClick`.

Les composants réutilisables existent : `DataTable` (tri, visibilité, redimensionnement, ordre des
colonnes persistés en `localStorage` par `storageKey`), le catalogue `IMPORTED_FIELDS`
(`lib/imported-fields.ts`), le sérialiseur `serializeTransaction`, `listChampsEnrichissablesByOrganisation`
et `listTypologiesByOrganisation`.

## Objectif

Livrer la **gestion des dossiers et des paniers** :

1. Une liste `/dossiers` : créer un dossier (n° `AA-RR-DDD`) et lister les dossiers existants.
2. Un détail `/dossiers/[id]` : lister les paniers du dossier, en créer un (nom + type), ouvrir un panier.
3. Une vue `/paniers/[id]` : tableau des transactions du panier, réutilisant `DataTable`
   (colonnes/tri persistés **par panier**), retrait d'une transaction.
4. Une **modale d'ajout au panier** unique (`AddToPanierDialog`) ouverte depuis plusieurs points
   d'entrée : bouton « + » du tableau, bouton de la fiche transaction, sélection polygonale de la carte.
5. Une entrée de navigation « Dossiers » ; retrait du badge factice « Dossier 123456 » du header.

## Décisions

1. **Aucune migration.** Les modèles `Dossier` / `Panier` / `PanierTransaction` existent déjà ; cette
   passe n'ajoute que la couche applicative. `createurId` reste `null` (aucun utilisateur de session
   réel — cohérent avec la décision 6 de la fiche transaction ; les rôles arrivent en gamma).
2. **Numéro de dossier — regex stricte.** `^\d{2}-[A-Z]{2}-\d{3}$` (AA-RR-DDD, §7.7), validé par Zod.
   Unicité par organisation assurée par `@@unique([organisationId, numeroDossier])` ; un doublon est
   intercepté côté action et renvoyé comme `{ ok: false, error }`.
3. **Seules les transactions `ANALYSEE` sont admissibles dans un panier.** L'ajout d'une transaction
   non analysée est rejeté (`{ ok: false, error }`). Le filtrage est appliqué dans le repository, pas
   seulement dans l'interface.
4. **Ajout idempotent.** `addTransactionsToPanier` utilise `createMany({ skipDuplicates: true })` sur la
   contrainte `@@id([panierId, transactionId])` : ré-ajouter une transaction déjà présente est un
   succès sans doublon (pas d'erreur).
5. **Un panier appartient à un dossier.** `Panier.dossierId` est obligatoire : on crée un panier depuis
   le détail d'un dossier. Le `typeTransactionId` (optionnel, → `Typologie`) est choisi à la création.
6. **La vue panier réutilise `DataTable`, sans réordonnancement manuel.** §7.7 impose que l'ordre des
   colonnes **découle du tri**, pas d'un glisser-déposer. On ajoute au `DataTable` une prop
   `reorderable?: boolean` (défaut `true`) ; la vue panier passe `reorderable={false}`
   (en-têtes non déplaçables, poignée de réordonnancement masquée). Le tri et la visibilité des
   colonnes restent persistés **par panier** via `storageKey="panier-table:<panierId>"`.
7. **Jeu de colonnes par défaut de la vue panier, aligné sur la liste des transactions.**
   N° d'inscription, date de vente, prix à l'acte, superficie totale (ha) et MRC, soit les mêmes
   colonnes de champs que `/transactions`. Les champs non importés — `SAISISSABLE` comme `CALCULE`
   (indicateurs) — sont **masqués par défaut** (`defaultVisible: false`) mais réactivables via le menu
   « Colonnes ». Toutes les colonnes sont masquables (aucune verrouillée), la colonne d'action
   (retrait) exceptée si elle est présente.
8. **Une modale d'ajout unique, plusieurs points d'entrée.** `AddToPanierDialog` reçoit une liste
   d'`transactionIds` et propose : sélection **Dossier → Panier**, puis confirmation. Elle gère
   elle-même le retour succès/échec (`{ ok, error }`). Ouverte depuis : (a) le bouton « + » d'une ligne
   du tableau (`transaction-table.tsx`), (b) un bouton de la fiche transaction, (c) le panneau de
   sélection de la carte (`selected-panel.tsx`, ajout en lot).
9. **Le badge « Dossier 123456 » du header est retiré.** Il est factice (valeur codée en dur) ; la
   navigation vers les dossiers passe désormais par l'entrée de sidebar « Dossiers ».
10. **Ordre des colonnes : le `DataTable` conserve son défaut.** Aucune régression sur les autres
    tables : `reorderable` par défaut à `true` préserve le comportement actuel.

## Non-objectifs

- **Analyse de dossier** (formule des indicateurs ajustés, §7.8.2) et écriture de `AnalyseDossier` /
  `IndicateursAjustes` / `ParametresAnalyseTransaction` — c'est la **passe B2**.
- **Export Excel** (§7.9) et **export carte PNG** (§7.10) — passes B2 et B3.
- **Rôle / contrôle d'accès** (§7.7, « partage entre évaluateurs ») — la bêta reste mono-compte ;
  les rôles arrivent en gamma. Le partage entre évaluateurs est assuré par la nature partagée de la
  base (tout évaluateur voit tout) ; aucune notion de propriétaire n'est implémentée ici.
- **Édition / suppression d'un dossier** et renommage d'un panier — création et consultation seulement.
- **Réordonnancement manuel des colonnes** de la vue panier (décision 6).
- **Badge de provenance** et contributeur (§7.5.2 / §7.7).

## Architecture

### 1. Validateur — `app/src/validators/dossier.validator.ts`

Règles Zod pures, réutilisées par les actions.

```ts
export const NUMERO_DOSSIER_REGEX = /^\d{2}-[A-Z]{2}-\d{3}$/

export const createDossierSchema = z.object({
  numeroDossier: z.string().regex(NUMERO_DOSSIER_REGEX, "Format attendu : AA-RR-DDD (ex. 25-AB-001)."),
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
```

- `formatDossierInputErrors(error)` : aplatit un `ZodError` en phrase lisible, sur le modèle de
  `formatChampInputErrors` (`lib/champs.ts`).

### 2. Repository — `app/src/repositories/dossier.repository.ts`

Accès Prisma isolé ; l'organisation est passée en paramètre (motif du dépôt).

```ts
listDossiers(organisationId)                              // Dossier + _count.paniers, tri createdAt desc
findDossierById(organisationId, id)                       // Dossier + paniers (avec _count.transactions)
createDossier(organisationId, { numeroDossier, nom })     // create ; createurId = null
findDossierByNumero(organisationId, numeroDossier)        // pour l'unicité applicative
createPanier(organisationId, { dossierId, nom, typeTransactionId })   // createurId = null
findPanierById(organisationId, id)                        // Panier + dossier + typeTransaction
listPaniersByDossier(organisationId, dossierId)           // Panier + _count.transactions, tri createdAt
addTransactionsToPanier(panierId, transactionIds)         // createMany skipDuplicates (décision 4)
removeTransactionFromPanier(panierId, transactionId)      // delete sur l'id composé
listTransactionsOfPanier(panierId)                        // Transaction + valeurs, via PanierTransaction
countEligibleTransactions(organisationId, transactionIds) // combien sont ANALYSEE (garde-fou décision 3)
```

- `listTransactionsOfPanier` réutilise `TRANSACTION_INCLUDE` (`transaction.repository.ts`) pour
  sérialiser avec `serializeTransaction`.
- La validation « ANALYSEE seulement » : `addTransactionsToPanier` filtre les `transactionIds` en
  amont via `countEligibleTransactions`, et l'action renvoie `{ ok: false, error }` si le compte
  diffère. (Le repository lui-même reste sans logique métier de refus : il reçoit une liste déjà
  vérifiée — la règle vit dans l'action.)

### 3. Actions serveur — `app/src/server/actions/dossier.ts`

`"use server"`. **Aucune exception ne remonte au client** : toute action renvoie
`{ ok: true, ... } | { ok: false, error }` (Next masque les messages des actions lancées en production ;
voir `champs.ts`).

```ts
listDossiers(): Promise<SerializedDossier[]>
createDossier(input): Promise<{ ok: true; id: string } | { ok: false; error: string }>
createPanier(input): Promise<{ ok: true; id: string } | { ok: false; error: string }>
addTransactionsToPanier(input): Promise<{ ok: true; added: number } | { ok: false; error: string }>
removeTransactionFromPanier(panierId, transactionId): Promise<{ ok: true } | { ok: false; error: string }>
listPaniersForDossier(dossierId): Promise<SerializedPanier[]>
listTransactionsForPanier(panierId): Promise<SerializedTransaction[]>
```

- `createDossier` : valide via `createDossierSchema`, puis `findDossierByNumero` → si présent,
  `{ ok: false, error: "Un dossier existe déjà avec ce numéro." }`. Sinon `createDossier`, puis
  `revalidatePath("/dossiers")`.
- `createPanier` : valide via `createPanierSchema`, vérifie que le dossier appartient à l'organisation,
  crée, `revalidatePath(`/dossiers/${dossierId}`)`.
- `addTransactionsToPanier` : valide via `addTransactionsSchema`, vérifie que **toutes** les
  transactions sont `ANALYSEE` (`countEligibleTransactions`), sinon
  `{ ok: false, error: "Seules les transactions analysées peuvent être ajoutées." }`. Puis
  `createMany({ skipDuplicates: true })`, `added = résultat.count`.
- `removeTransactionFromPanier` : `removeTransactionFromPanier`, `revalidatePath(`/paniers/${panierId}`)`.
- Les actions de lecture (`listDossiers`, `listPaniersForDossier`, `listTransactionsForPanier`) sont
  appelées par le client (la modale et la vue panier sont interactives) ; elles sérialisent les
  `Decimal` en `number` (motif `transaction.serializer.ts`).

### 4. Sérialisation — `app/src/serializers/dossier.serializer.ts`

Forme des props passées aux clients.

```ts
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
```

- Les transactions d'un panier réutilisent `SerializedTransaction` (`serializeTransaction`).

### 5. Routes

| Route | Composant serveur | Contenu |
|---|---|---|
| `app/src/app/(app)/dossiers/page.tsx` | server, `force-dynamic` | `listDossiers` → `<DossiersPageClient dossiers={...} />` |
| `app/src/app/(app)/dossiers/[id]/page.tsx` | server, `force-dynamic` | `findDossierById` + `listPaniersByDossier` + `listTypologiesByOrganisation` → `<DossierDetailClient ... />` ; `notFound()` si absent |
| `app/src/app/(app)/paniers/[id]/page.tsx` | server, `force-dynamic` | `findPanierById` + `listTransactionsOfPanier` + `listChampsEnrichissables` → `<PanierView ... />` ; `notFound()` si absent |

### 6. Composants — `app/src/components/dossier/`

| Composant | Rôle |
|---|---|
| `dossiers-page-client.tsx` | Client. Liste des dossiers (cartes ou tableau léger) + bouton « Nouveau dossier » ouvrant le formulaire de création (n° + nom optionnel). Retour `{ ok, error }` affiché. |
| `dossier-form-dialog.tsx` | Formulaire de création d'un dossier : champs n° (`placeholder` « 25-AB-001 ») + nom ; appelle `createDossier`. |
| `dossier-detail-client.tsx` | Client. En-tête (n° + nom du dossier), liste des paniers (`DataTable` ou cartes), bouton « Nouveau panier » (`panier-form-dialog.tsx`). Chaque panier → lien `/paniers/[id]`. |
| `panier-form-dialog.tsx` | Création d'un panier : nom + sélecteur de type (typologies feuilles). Appelle `createPanier`. |
| `panier-view.tsx` | Client. `DataTable` (`storageKey="panier-table:<id>"`, `reorderable={false}`) des transactions du panier ; colonne d'action « Retirer » (appelle `removeTransactionFromPanier`). |
| `add-to-panier-dialog.tsx` | Modale réutilisable : reçoit `transactionIds: string[]`, charge la liste des dossiers (`listDossiers`) et de leurs paniers, propose Dossier → Panier, confirme via `addTransactionsToPanier`. Affiche le succès (« N transaction(s) ajoutée(s) ») ou l'erreur. |

Réutilisation : `DataTable`, `ui/` (`Button`, `Input`, `Select`, `Label`, `Badge`). **Pas de
bibliothèque de dialogue dans `ui/`** (pas de `Dialog` Radix) : les modales
(`dossier-form-dialog`, `panier-form-dialog`, `add-to-panier-dialog`) sont un petit overlay maison
(`fixed inset-0` + `Card` centrée + fond `bg-black/40`), sans nouvelle dépendance. Les colonnes de
`panier-view.tsx` sont construites avec la **même logique**
que `useTableColumns` de `transaction-table.tsx` (catalogue `IMPORTED_FIELDS` + champs `CALCULE`),
avec le jeu par défaut de la décision 7.

### 7. Points d'entrée de l'ajout au panier

| Point | Fichier | Détail |
|---|---|---|
| Tableau (1 transaction) | `transaction-table.tsx` | Le bouton « + » de `Actions` ouvre `AddToPanierDialog` avec `[row.id]` (remplace le stub inerte). |
| Fiche transaction (1 transaction) | `fiche` (en-tête ou documents) | Un bouton « Ajouter au panier » ouvre `AddToPanierDialog` avec `[transactionId]` — câblage minimal, l'auto-passage à la suivante (§7.5.9) reste hors périmètre. |
| Carte (n transactions) | `selected-panel.tsx` + `transaction-map.tsx` | Le panneau de sélection gagne un bouton « Ajouter au panier » qui ouvre `AddToPanierDialog` avec les ids sélectionnés. Nouvelle prop `onAddToPanier` remontée par `transaction-map.tsx`. |

### 8. Câblage navigation

- `sidebar.tsx` : ajouter `{ href: "/dossiers", label: "Dossiers", icon: FolderOpen }` à `NAV_ITEMS`
  (après « Liste des transactions »).
- `header.tsx` : retirer le bloc `Dossier 123456` (lignes 31-36) et l'import `FolderOpen` devenu inutile ;
  ajouter `/dossiers` → « Dossiers » et `/paniers/...` → « Panier » à `PAGE_TITLES` (ou repli `title`).
- `data-table.tsx` : ajouter la prop `reorderable?: boolean` (défaut `true`) ; quand `false`, les
  en-têtes ne sont pas `draggable`, la poignée `GripVertical` et le curseur `cursor-grab` sont masqués,
  et `onReorderColumn` n'est jamais appelé. La visibilité (menu « Colonnes ») et le redimensionnement
  restent disponibles.

## Flux de données

```
/dossiers (server) ──► listDossiers ──► DossiersPageClient ──► dossier-form-dialog ──► createDossier
                                                                       │
/dossiers/[id] (server) ──► findDossierById + listPaniersByDossier ──► DossierDetailClient
                                                                       │
                                              panier-form-dialog ──► createPanier
                                                                       │
/paniers/[id] (server) ──► findPanierById + listTransactionsOfPanier ──► PanierView
                                                                            │
                                     DataTable(reorderable=false) ──► removeTransactionFromPanier

Ajout au panier (depuis tableau / fiche / carte)
  AddToPanierDialog(transactionIds) ──► listDossiers + paniers ──► choix ──► addTransactionsToPanier
                                     ──► Zod ──► countEligibleTransactions (ANALYSEE) ──► createMany
                                     ──► { ok, added } / { ok:false, error }
```

## Cas limites

- **Numéro de dossier mal formé** (hors `AA-RR-DDD`) : rejeté par Zod → `{ ok: false, error }`.
- **Numéro de dossier déjà pris** dans l'organisation : `{ ok: false, error }` (unicité applicative).
- **Ajout d'une transaction non `ANALYSEE`** : rejeté (décision 3).
- **Transaction déjà dans le panier** : ajout silencieux sans doublon (décision 4, `skipDuplicates`).
- **Sélection vide** dans `AddToPanierDialog` : action refusée (`min(1)` sur `transactionIds`).
- **Panier sans transaction** : vue affichant le message vide du `DataTable` (« Aucun résultat »).
- **Dossier ou panier inexistant / hors organisation** : `notFound()`.
- **Panier sans type** : `typeTransactionId` `null` autorisé ; la colonne « Type » affiche « — ».
- **Retrait d'une transaction absente** : `delete` idempotent (Prisma lève si absent → l'action renvoie
  `{ ok: false, error }`, sans casser la vue).

## Tests

Fichiers Vitest (environnement `node`, alias `@` — exécuter depuis `app/`) :

- `app/tests/validators/dossier.validator.test.ts` :
  - `NUMERO_DOSSIER_REGEX` : accepte `25-AB-001` ; refuse `25-ab-001`, `5-AB-001`, `25-ABC-001`, `25-AB-01`,
    chaîne vide.
  - `createDossierSchema` : nom optionnel ; n° requis.
  - `createPanierSchema` : nom requis non vide ; `typeTransactionId` `null` accepté.
  - `addTransactionsSchema` : `transactionIds` vide rejeté.
- `app/tests/repositories/dossier.repository.test.ts` (base réelle ou mock Prisma, à l'image des tests
  repository existants) :
  - `addTransactionsToPanier` idempotent (`skipDuplicates`) : deux appels → un seul enregistrement.
  - `removeTransactionFromPanier` supprime bien l'id composé.
  - `listTransactionsOfPanier` renvoie les transactions liées.
- `app/tests/e2e/dossier-lifecycle.test.ts` (sur la couche actions, comme `tests/e2e/lifecycle.test.ts`) :
  - créer un dossier → le lister ; rejet d'un numéro dupliqué ; rejet d'un format invalide.
  - créer un panier dans le dossier.
  - ajouter des transactions `ANALYSEE` → présentes dans le panier ; ré-ajout → pas de doublon.
  - ajouter une transaction non `ANALYSEE` → `{ ok: false }`.

Vérification globale : `npm run typecheck` (`tsc --noEmit`), `npm test` (vitest), `npm run lint`.

## Notes d'implémentation

- Réutiliser `formatValue` / `formatNumber` / `formatCurrency` de `transaction-table.tsx` pour les
  cellules de la vue panier (cohérence de formatage).
- La colonne « MRC » lit `row.fields.municipalite` (code machine existant, cf. `MAP_POPUP_CODES`).
- Les actions de lecture appelées par le client sérialisent les `Decimal` en `number` (motif du dépôt).
- `revalidatePath` après chaque mutation : `/dossiers`, `/dossiers/[id]`, `/paniers/[id]` selon le cas.
- Le motif `{ ok, error }` est obligatoire (jamais de `throw` dans une action) — cf. `feedback` mémoire
  et `champs.ts`.
