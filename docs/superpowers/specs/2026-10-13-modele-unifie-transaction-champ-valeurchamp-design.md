# Modèle unifié Transaction / Champ / ValeurChamp

**Date :** 2026-10-13
**Portée :** `app/prisma` (schéma, migration, seed), `app/src/types`, `app/src/lib`, `app/src/repositories`, `app/src/services`, `app/src/server/actions`, `app/src/serializers`, `app/src/components`, `app/src/validators`, `app/scripts`, `app/tests`

## Contexte

Le cahier des charges a été révisé : le modèle de données des transactions passe d'une conception à deux tables à un modèle **unifié de type EAV (entité-attribut-valeur)**.

**Modèle actuel (ancien)** — le code est bâti dessus :

| Entité | Rôle actuel |
|---|---|
| `TransactionSource` | Colonnes métier figées de l'acte (n° d'inscription, date, vendeur, acheteur, lots, prix, MRC, municipalité, adresse, superficie). Immuable. **Masqué de la fiche** sauf l'en-tête. |
| `TransactionEnrichie` | Statut (`"A analyser"` / `"Analysée"`) et contributeur. Relation 1-1 avec `TransactionSource`. |
| `ChampEnrichissable` | Champs `SAISISSABLE` / `CALCULE` uniquement. `estModifiable` distingue le calculé. |
| `ValeurEnrichissement` | Valeurs des seuls champs enrichis (saisis ou calculés). |
| `SOURCE_FIELDS` (lib) | Catalogue statique codé en dur des 10 colonnes source, avec `code` snake_case ↔ `column` Prisma. |

**Modèle cible (cahier des charges révisé, §6.4–6.8, §7.1–7.3)** — un modèle unifié :

| Entité | Rôle cible |
|---|---|
| `Transaction` | Entité fusionnée, **sans aucune colonne métier**. Porte `id_importation`, `systeme_source`, `statut`, contributeur et dates. |
| `Champ` | Entité unique pour les trois natures `IMPORTE` / `SAISISSABLE` / `CALCULE`. Les champs importés forment un catalogue amorcé par le système, avec `entetes_import` (correspondance d'en-têtes par système source). Nouvel attribut `est_lecture_seule`. |
| `ValeurChamp` | **Toutes** les valeurs, quelle que soit la nature : importées, saisies ou calculées. Ajoute `valeur_texte_multiple` (`TEXT[]`) et `valeur_date`. |

Conséquences majeures :
1. L'unicité `(numero_inscription, date_vente)` n'est **plus une contrainte de base** : elle est vérifiée par le processus d'import, appuyée sur les index de `ValeurChamp`.
2. Les champs importés **apparaissent sur la fiche** (zone principale drag-and-drop), au lieu d'être masqués.
3. Les filtres de recherche référencent un `Champ` de **toute nature**.
4. Le catalogue `SOURCE_FIELDS` codé en dur est remplacé par des lignes `Champ` de nature `IMPORTE`.

## Objectif

Migrer l'application du modèle à deux tables vers le modèle unifié, de façon fidèle au cahier des charges, en conservant un **point de passage unique et propre** entre la couche de stockage (EAV) et le reste de l'application.

Frontière retenue (**Option 1**) : le stockage est EAV, mais les repositories et sérialiseurs **hydratent une carte plate `fields: Record<code_machine, value>`** (source + enrichi fusionnés, clés en snake_case) plus `statut`. Les repositories, actions et composants lisent cette unique carte. La scission source/enrichi se réduit à cette carte fusionnée.

## Non-objectifs

- **Migration de données réelles** : décision prise — environnement de développement local uniquement → reset de la base + `db:seed`. Aucune donnée de production n'est conservée. La migration supprime les anciennes tables et crée les nouvelles.
- **Ne pas refondre** les règles de calcul ni la validation au-delà de l'adaptation au modèle fusionné.
- **Ne pas modifier** la logique des filtres virtuels existants (`statut`) ni du filtre `TYPE_TRANSACTION`, hormis le changement de source d'identité (voir §7 et §9).
- **Ne pas toucher** au parseur Excel au-delà du renommage des clés de champ (camelCase → snake_case) et de la suppression du concept de « colonne source ».
- **Ne pas introduire** de vue SQL de dénormalisation : la rigidité des colonnes est précisément ce que le modèle EAV élimine.

## Décisions

1. **`Transaction` fusionnée.** Colonnes métier supprimées ; `statut` devient un **enum Prisma** `StatutTransaction { NON_ANALYSEE, ANALYSEE }` (défaut `NON_ANALYSEE`), libellés affichés « Non analysée » / « Analysée ». Toutes les comparaisons de code à la chaîne `"Analysée"` deviennent `=== "ANALYSEE"`.
2. **`Champ` unifiée.** `nature` devient un enum à trois valeurs `{ IMPORTE, SAISISSABLE, CALCULE }`. Ajout de `entetes_import` (JSONB, pertinent si `IMPORTE`). `est_modifiable` est **supprimé et remplacé** par `est_lecture_seule` (sens inversé) : `true` par défaut pour `IMPORTE`, `false` pour `SAISISSABLE`, forcé `true` pour `CALCULE`. `type_donnees` gagne `TEXTE_MULTIPLE` et `MULTI_SELECT`.
3. **`ValeurChamp` unifiée.** Remplace `ValeurEnrichissement`. Ajout de `valeur_texte_multiple` (`String[]`) et `valeur_date` (`Date?`). Contrainte `@@unique([transactionId, champId])`, index sur `(champId, valeurTexte)` et `(champId, valeurDate)`, index GIN sur `valeurTexteMultiple`.
4. **Catalogue d'imports en données, pas en code.** Les 12 champs importés (§6.5) sont amorcés comme lignes `Champ` (`nature IMPORTE`) via le seed, avec leur `entetes_import`. Le descripteur statique `lib/imported-fields.ts` sert **uniquement** de source d'amorçage et de « hints » d'affichage, plus de logique métier conditionnée à `nature === "SOURCE"`.
5. **Frontière DTO plate.** `serializeTransaction` produit `{ ...identifiants, fields: Record<string, SerializableValue>, statut }`. `fields` est indexé par `code_machine` (snake_case) et couvre toutes les natures.
6. **Filtres unifiés.** `FiltreRecherche.id_champ_enrichissable` → `id_champ` (FK → `Champ`). `code_machine` **est conservé** sur `FiltreRecherche` comme discriminant des seuls filtres virtuels (`statut`), où `id_champ` est `NULL`. Le préfixe `__SOURCE_<code>` du formulaire admin disparaît : les champs importés sont des `Champ` comme les autres.
7. **Latitude / longitude deviennent des champs `IMPORTE`** (ils figurent au catalogue §6.5), et non plus des champs `SAISISSABLE` créés à la volée par l'import.
8. **Reset + reseed.** La migration drope les anciennes tables et crée les nouvelles ; `db:seed` réamorce catalogue, typologies, indicateurs, filtres et vue de fiche.

## Architecture

### 1. Schéma Prisma

**`Transaction`**

```prisma
enum StatutTransaction {
  NON_ANALYSEE
  ANALYSEE
}

model Transaction {
  id             String            @id @default(uuid())
  organisationId String            @map("id_organisation")
  importationId  String?           @map("id_importation")
  systemeSource  String            @map("systeme_source") // "JLR" | "EXISTANT_EVAGRI"
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
```

**`Champ`** (renommée depuis `ChampEnrichissable`)

```prisma
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
  unite                String      @default("N/A")
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
```

**`ValeurChamp`** (renommée depuis `ValeurEnrichissement`)

```prisma
model ValeurChamp {
  id                   String      @id @default(uuid())
  transactionId        String      @map("id_transaction")
  champId              String      @map("id_champ")
  valeurNombre         Decimal?    @map("valeur_nombre") @db.Decimal(18, 4)
  valeurTexte          String?     @map("valeur_texte")
  valeurTexteMultiple  String[]    @map("valeur_texte_multiple")
  valeurBooleen        Boolean?    @map("valeur_booleen")
  valeurDate           DateTime?   @map("valeur_date") @db.Date
  dateModification     DateTime    @default(now()) @map("date_modification")
  modifieParId         String?     @map("id_modifie_par")
  transaction          Transaction @relation(fields: [transactionId], references: [id])
  champ                Champ       @relation(fields: [champId], references: [id])

  @@unique([transactionId, champId])
  @@index([champId, valeurTexte])
  @@index([champId, valeurDate])
  @@index([champId, valeurTexteMultiple(ops: ArrayOps)], type: Gin)
  @@map("valeur_champ")
}
```

**Renommages de FK sur les entités dépendantes** (le type de clé reste `String` ; seuls le nom de champ et la table référencée changent) :

| Entité | Ancien | Nouveau |
|---|---|---|
| `PanierTransaction` | `transactionEnrichieId` → `TransactionEnrichie` | `transactionId` → `Transaction` |
| `ParametresAnalyseTransaction` | `transactionSourceId` → `TransactionSource` | `transactionId` → `Transaction` |
| `IndicateursAjustes` | `transactionSourceId` → `TransactionSource` | `transactionId` → `Transaction` |
| `DocumentActe` | `transactionSourceId` → `TransactionSource` | `transactionId` → `Transaction` |
| `FiltreRecherche` | `champEnrichissableId` → `ChampEnrichissable` | `champId` → `Champ` |

`FiltreRecherche` conserve `codeMachine String?` (filtres virtuels). Les relations `Organisation.champs`, `Organisation.transactions`, etc. sont renommées en conséquence.

### 2. Catalogue des champs importés — `app/src/lib/imported-fields.ts`

Remplace `transaction-source-fields.ts`. Deux exports :

```ts
export interface ImportedField {
  code: string                          // code_machine (snake_case)
  label: string                         // nom_affichage par défaut
  typeDonnees: TypeDonneesChamp
  typeFiltreRecommande: FilterType
  entetesImport: { JLR: string[]; EXISTANT_EVAGRI: string[] }
  numeric: boolean
  /** hints d'affichage du tableau de transactions */
  display: { sortable: boolean; defaultVisible: boolean; minWidth: number; priority: number }
}
export const IMPORTED_FIELDS: ImportedField[]
export const IMPORTED_FIELD_BY_CODE: Record<string, ImportedField>
```

Contenu (issu de §6.5 ; en-têtes EVAGRI/JLR tels que documentés) :

| `code` | Label | Type | En-têtes EVAGRI | En-têtes JLR |
|---|---|---|---|---|
| `numero_inscription` | N° d'inscription | `TEXTE` | `No d'enregistrement`, `No d'enr.` | (à confirmer) |
| `date_vente` | Date de vente | `DATE` | `Date de L'acte`, `Date de l'acte ou de l'avant contrat` | (à confirmer) |
| `vendeur` | Vendeur | `TEXTE` | `Vendeur` | (à confirmer) |
| `acheteur` | Acheteur | `TEXTE` | `Acheteur` | (à confirmer) |
| `lots_cadastraux` | Lots cadastraux | `TEXTE_MULTIPLE` | `Lots` | (à confirmer) |
| `prix_vente` | Prix à l'acte | `DECIMAL` ($) | `Prix de vente`, `Prix de vente ($)` | (à confirmer) |
| `mrc` | MRC | `TEXTE` | `MRC` | `MRC` |
| `municipalite` | Municipalité | `TEXTE` | `Ville/Municipalité` | (à confirmer) |
| `adresse` | Adresse | `TEXTE` | `Adresse complete`, `Adresse complète` | (à confirmer) |
| `superficie_totale_hectare` | Superficie totale | `DECIMAL` (ha) | `Superficie Totale (ha)` | (à confirmer) |
| `latitude` | Latitude | `DECIMAL` (°) | `Latitude`, `Lat` | `Latitude` |
| `longitude` | Longitude | `DECIMAL` (°) | `Longitude`, `Long`, `Lng` | `Longitude` |

Les hints `display` reprennent les valeurs actuelles de `TRANSACTION_SOURCE_FIELDS` (minWidth, priority, defaultVisible, sortable), désormais indexés par `code` snake_case. `TRANSACTION_SOURCE_FIELDS` et `SOURCE_FIELDS` sont supprimés.

### 3. Seed — `app/prisma/seed.ts`

Pour chaque organisation amorcée :
1. **12 `Champ` de nature `IMPORTE`** dérivés de `IMPORTED_FIELDS` (code, label, type, `entetesImport`, `typeFiltreRecommande`, `ordreAffichage`, `estAffiche = true`, `estLectureSeule = true`, `actif = true`).
2. Typologies (inchangé).
3. Champs `CALCULE` (indicateurs de base) et `SAISISSABLE` (saisissables) — règles de calcul référençant par code les champs importés (`prix_vente`, `superficie_totale_hectare`, …).
4. `FiltreRecherche` : filtres de champs (référencent `champId`) + filtre virtuel `statut` (`champId = null`, `codeMachine = "statut"`, `typeFiltre LISTE`, options « Non analysée » / « Analysée »).
5. **`VueFicheEvaluation` par défaut** : une section **« Données de l'acte »** (`ordre = 0`) contenant les ids des 12 champs importés, afin que la fiche affiche immédiatement les données de l'acte dans la zone principale.

`scripts/truncate-transactions.ts`, `reset-database.ts`/`.mjs` sont mis à jour pour cibler `valeur_champ`, `transaction`, `champ` (les scripts de backfill obsolètes — `backfill-champ-*`, `backfill-recommended-filter-types`, `check-type`, `backfill-cptaq` — sont supprimés ou adaptés ; décision d'implémentation dans le plan).

### 4. Service d'import — `app/src/services/import.service.ts`

- `importSheet` crée une **`Transaction`** (sans colonne métier) puis une **`ValeurChamp`** par champ `IMPORTE` présent et non vide, en résolvant le `Champ` par `code_machine` (issu du catalogue amorcé).
- La correspondance colonne → champ utilise `entetes_import` du `Champ` (au lieu du dictionnaire `SOURCE_COLUMNS` du parseur, qui devient un simple mapping en-tête → `code_machine`).
- **Déduction géographique** (§7.1.4) : `mrc` déduite de la municipalité via le référentiel ; `latitude`/`longitude` géocodées depuis les lots, à défaut l'adresse. La valeur déduite/géocodée est écrite comme valeur du **champ importé** correspondant (plus de création de champ `SAISISSABLE` à la volée via `ensureChampByCodeMachine`).
- **Doublons** (§7.1.3) : la vérification `(numero_inscription, date_vente)` interroge `ValeurChamp` joint à `Champ` (`code_machine`), sur l'organisation, via les index `(champId, valeurTexte)` / `(champId, valeurDate)`.
- `statut` : `NON_ANALYSEE` (brouillon) ou `ANALYSEE` (ligne EVAGRI jugée complète), remplaçant les chaînes actuelles.

### 5. Repositories + sérialiseurs

- `transaction.repository.ts` : `TRANSACTION_INCLUDE` devient `valeurs: { include: { champ: true } }`. `findTransactions`, `countTransactions`, `buildTransactionWhere` (type `Prisma.TransactionWhereInput`), `findTransactionsForMap`, `createImportedTransaction` (écrit `Transaction` + `createMany ValeurChamp`). `findRenteLotNumbers` (SQL brut) est réécrit sur `valeur_champ`/`champ` (`code_machine = 'lots_cadastraux'`) avec `unnest(valeur_texte_multiple)`. `withRenteLots` cible la valeur multiple. `findExistingTransaction` s'appuie sur `ValeurChamp`.
- `fiche.repository.ts` : `ficheInclude` → `valeurs.champ` ; `saveFicheValues` fait `valeurChamp.deleteMany` + `createMany` (par `transactionId`) ; `updateFicheStatut` écrit `statut`/`dateStatut` sur `Transaction`.
- `filters.repository.ts` : `findDistinctEnrichmentValues` et `findDistinctSourceValues` fusionnent en **une** `findDistinctFieldValues(organisationId, codeMachine)` lisant `ValeurChamp` (texte et multiple) jointe à `Champ`. `findFiltersByOrganisation` inclut `champ`. CRUD filtre sur `id_champ`.
- `champs.repository.ts`, `enrichment.repository.ts` : renommage `ChampEnrichissable` → `Champ` ; `estModifiable` → `estLectureSeule` ; `listChampsByOrganisation` inclut désormais les trois natures.
- `actes.repository.ts` : `findTransactionSourceByNumeroInscription` → `findTransactionByNumeroInscription` (via `ValeurChamp`).
- `serializers/transaction.serializer.ts` : `serializeTransaction` construit la **carte `fields`** à partir des `valeurs` (clé = `champ.codeMachine`, valeur typée selon `champ.typeDonnees`), expose `statut` et une aide `latitude`/`longitude` lue dans `fields` pour la carte.
- `serializers/fiche.serializer.ts` : `SerializedFiche` expose `fields` + `statut` + `mode`.

### 6. Couche `lib`

- `calculator.ts` : `CalculationContext` devient `{ fields: Record<string, number | null> }` ; `resolveIdentifier` fait une **seule** lecture dans `fields`. L'API et l'évaluation RPN sont inchangées.
- `fiche.ts` :
  - `buildSourceNumbers` → `buildNumericFields(fields)` (source + enrichi fusionnés).
  - `buildCalculationContext(fields)` unique.
  - `buildStorageEntries` renvoie `{ champId, valeurNombre, valeurTexte, valeurTexteMultiple, valeurBooleen, valeurDate }[]` (plus `champEnrichissableId`).
  - `toStorageValue` gère `TEXTE_MULTIPLE` (`valeurTexteMultiple`).
  - `validateFiche` opère sur `fields` fusionnés ; les règles V-001…V-007 (§7.8.3) s'appliquent aux champs modifiables.
  - `buildFicheViewModel` sépare zone principale (`IMPORTE` + `SAISISSABLE`, avec `estLectureSeule`) et zone latérale (`CALCULE`).
- `filters.ts` : `buildWhereClause` émet des clauses `ValeurChamp` (`enrichie.valeurs.some` → `valeurs.some`) pour **toute** nature, via `champ.codeMachine` ; `sourceColumnOf` et toute la branche « colonne source » disparaissent. `recommendFilterType` perd sa branche source. `filterByPolygon` lit lat/long dans les valeurs.
- `champs.ts` : `deriveEstModifiable` → `deriveEstLectureSeule(nature)` (`IMPORTE` → true, `SAISISSABLE` → false, `CALCULE` → true). La vérification de collision de `codeMachine` se fait contre **tous** les `Champ` de l'organisation (les codes importés sont réservés). `validateChampConfig` interdit `regle_calcul` si `IMPORTE`.
- `validators/filter.validator.ts` : `SORTABLE_FIELDS` dérivé du catalogue `IMPORTED_FIELDS`.

### 7. Composants

- **Fiche** (`fiche/fiche-transaction.tsx`, `fiche/*`) : `fields` remplace `source`/`enrichment`. Les champs importés s'affichent dans la **zone principale** (drag-and-drop), grisés si `estLectureSeule`. `fiche/source-data-panel.tsx` disparaît (fusionné dans les sections). L'en-tête conserve n° d'inscription + n° de lot. Le badge de statut compare à `ANALYSEE`.
- **Tableau de transactions** (`transaction-table.tsx`, `transactions-page-client.tsx`) : colonnes construites depuis les `Champ` (importé + saisissable) via les hints `display` du catalogue importé + les champs saisissables ; clés en `code_machine`. `computeTauxGlobal` lit `fields.prix_vente` / `fields.superficie_totale_hectare`.
- **Filtres admin** (`filters-admin-form.tsx`) : suppression des préfixes `__SOURCE_` ; tous les champs de toute nature proviennent des `Champ` (`champId`), les seuls cas virtuels (`__VIRTUAL_statut`) subsistent avec `codeMachine`.
- **Filtres transaction** (`transaction-filters.tsx`) : `isVirtual` sans `isSourceFieldCode` ; options de liste lues au niveau supérieur.
- **Admin champs** (`champs-admin.tsx`, `champs-page-client.tsx`, `sections-editor.tsx`) : libellé de nature à trois valeurs (« Importé » / « Saisissable » / « Calculé ») ; les champs `IMPORTE` ne sont ni créables ni supprimables (libellé, affichage, lecture seule, section éditables) ; `sections-editor` accepte les champs importés.

## Flux de données

```
Import (CSV JLR / Excel EVAGRI)
    │
    ▼
Transaction (sans colonne métier) + 1 ValeurChamp / champ IMPORTE présent
    │            (Champ résolu par code_machine via entetes_import)
    ▼
Lecture / fiche / tableau / carte
    │
    ▼
findTransactions (include valeurs.champ)
    │
    ▼
serializeTransaction → { id, fields: { code_machine: valeur }, statut }
    │
    ├─ fiche : zone principale (IMPORTE + SAISISSABLE, lecture seule selon est_lecture_seule)
    └─ zone latérale : CALCULE (recalcul onBlur via fields)
```

```
Filtre (admin)
    ├─ champ importé/saisissable/calculé ─► FiltreRecherche.champId, codeMachine = null
    └─ virtuel (statut) ─────────────────► FiltreRecherche.champId = null, codeMachine = "statut"
                        │
                        ▼
              buildWhereClause → valeurs.some(champ.codeMachine, valeur_*)
```

## Migration

Environnement dev uniquement → **reset + reseed**. La migration Prisma (générée `--create-only`, complétée à la main) :

1. `DROP` des tables `transaction_source`, `transaction_enrichie`, `valeur_enrichissement`, `champ_enrichissable` et de leurs dépendances (les tables `panier_transaction`, `parametres_analyse_transaction`, `indicateurs_ajustes`, `document_acte`, `filtre_recherche` sont recréées avec les FK renommées).
2. `CREATE` des tables `transaction`, `champ`, `valeur_champ` et des enums `StatutTransaction`, `NatureChamp` (3 valeurs).
3. Recréation des tables dépendantes avec les nouvelles FK.

La base est ensuite re-seedée par `npm run db:migrate` (qui déclenche `postdb:migrate` → `tsx prisma/seed.ts`).

## Tests

- `tests/lib/transaction-source-fields.test.ts` → remplacé par `tests/lib/imported-fields.test.ts` (12 entrées, `IMPORTED_FIELD_BY_CODE`, entêtes d'import, hints d'affichage).
- `tests/lib/filters.test.ts` : `buildWhereClause` produit des clauses `valeurs.some` pour un champ importé (`mrc`, `prix_vente`, `lots_cadastraux` en `hasSome`/`valeurTexteMultiple`) ; suppression des cas « colonne source » ; `recommendedTypeForField` sans branche source.
- `tests/lib/fiche.test.ts` : `buildStorageEntries` renvoie `champId` + `valeurTexteMultiple`/`valeurDate` ; `validateFiche`/`recomputeIndicateurs` sur `fields` fusionnés.
- `tests/lib/champs.test.ts` : `deriveEstLectureSeule`, collision de code contre les codes importés, `regleCalcul` interdit si `IMPORTE`.
- `tests/server/transaction.test.ts` : création `prisma.transaction` + `valeurChamp`, `deleteMany`.
- `tests/server/filters.test.ts` : fixtures `prisma.transaction`, `prisma.champ`, `prisma.valeurChamp`, `prisma.filtreRecherche` (`champId`).
- `tests/services/import.test.ts` : `parseFieldValue` renvoie le quintuplet typé (dont `valeurTexteMultiple`/`valeurDate`).
- `tests/components/*` : fixtures sans `enrichie`/`champEnrichissable`.
- **Vérification globale** : `npm run typecheck` (`tsc --noEmit`), `npm test` (vitest), `npm run lint`, puis `npm run db:migrate` + `db:seed` sur la base locale.

## Cas limites

- **`champId` d'un filtre virtuel** : un filtre `statut` a `champId = null` et `codeMachine = "statut"` ; le formulaire admin et `buildWhereClause` conservent cette voie virtuelle.
- **Champ importé en lecture seule modifiable** : si l'administrateur décoche « Lecture seule », l'évaluateur peut corriger la valeur importée ; la modification est tracée au journal d'audit et la valeur d'origine reste consultable (§7.3.4, §7.12.2).
- **`TEXTE_MULTIPLE` dans une règle de calcul** : interdit — non numérique ; `validateChampConfig` / `validateRuleSyntax` le rejettent.
- **Valeurs typées multiples** : `lots_cadastraux` (`TEXTE_MULTIPLE`) est stocké dans `valeur_texte_multiple` ; la recherche de revente s'appuie sur l'index GIN et `hasSome`/`unnest`.
- **Latitude/longitude absentes** : géocodées puis écrites comme valeurs des champs importés `latitude`/`longitude` ; la carte lit ces valeurs depuis `fields`.
- **Statut historique** : les anciennes chaînes `"A analyser"`/`"Analysée"` disparaissent avec la migration (reset) ; le seed réamorce les filtres `statut` avec les libellés « Non analysée » / « Analysée ».

## Notes d'implémentation

- La carte `fields` sérialisée est la **seule** surface de lecture des valeurs pour les composants ; aucun composant ne reçoit le tableau `valeurs` brut.
- `code_machine` est l'identifiant canonique unique (snake_case) pour : règles de calcul, filtres, clés de `fields`, et résolution à l'import. Il n'existe plus de double vocabulaire camelCase/snake_case.
- La contrainte d'unicité `(numero_inscription, date_vente)` n'existe **qu'au niveau applicatif** (§7.1.3) ; sa robustesse repose sur les index de `ValeurChamp`.
- `est_obligatoire` reste ignoré pour les champs en lecture seule et pour les champs calculés (§6.5).
