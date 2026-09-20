# Retrait de la nature « SOURCE » et alignement des filtres sur les colonnes source

**Date :** 2026-09-19
**Portée :** `app/prisma` (schéma, migration, seeds), `app/src/lib`, `app/src/repositories`, `app/src/components`, `app/src/types`, `app/tests`

## Contexte

Le cahier des charges (§6.5) définit `ChampEnrichissable` avec une nature à **deux** valeurs : `ENUM (SAISISSABLE, CALCULE)`. Les données brutes d'un acte vivent dans `TransactionSource` (§6.4) ; elles ne sont pas des champs enrichissables.

Dans le code actuel, une troisième nature `"SOURCE"` a été inventée :

- `app/prisma/schema.prisma` déclare `nature String` (aucun enum), ce qui autorise n'importe quelle valeur.
- `app/prisma/seed.ts` (bloc `sourceChamps`) et `app/prisma/seed.sql` insèrent les 10 colonnes de `TransactionSource` comme lignes `ChampEnrichissable` avec `nature: "SOURCE"` et des `code_machine` en **camelCase** (`numeroInscription`, `prixVente`, …).
- `app/src/components/filters-admin-form.tsx` découpe la liste des champs en « Champs sources » (nature `SOURCE`) et « Champs enrichis ».
- `app/src/lib/filters.ts` et `app/src/repositories/filters.repository.ts` branchent leur logique sur `nature === "SOURCE"`.

Conséquences observées :

1. La page **Admin → Champs enrichissables** liste les 10 données source comme s'il s'agissait de champs configurables, sans justification au cahier des charges.
2. Le badge de nature de ces lignes est vide (`NATURE_LABELS["SOURCE"]` n'existe pas) — l'interface affiche une nature non définie.
3. Un filtre visant une donnée source pointe une relation `champEnrichissableId` vers une ligne factice, alors que le §6.6 prévoit qu'un filtre peut viser « une donnée source pure » via `code_machine` (nullable), indépendamment de la relation champ.
4. Les identifiants source sont en camelCase (noms de colonnes Prisma), alors que le §7.3.2 impose des identifiants **snake_case** (`prix_vente`, `superficie_totale_hectare`) pour les règles de calcul et les filtres.

## Objectif

Aligner le code sur le cahier des charges :

- `nature` devient un **enum Prisma** à deux valeurs (`SAISISSABLE`, `CALCULE`) ; la notion de « champ source » disparaît du modèle.
- Un **catalogue unique** décrit les colonnes source : identifiant snake_case canonique ↔ colonne Prisma ↔ libellé ↔ type de données ↔ type de filtre recommandé.
- Les filtres visant une donnée source référencent ce catalogue (`code_machine` = identifiant snake_case, `champEnrichissableId` = `null`), au lieu d'une relation champ factice.

## Non-objectifs

- **Aucune migration de données réelles.** Décision prise : environnement de développement local uniquement → reset de la base + `db:seed`. La migration supprime les lignes non conformes (voir §7) mais aucune donnée de production n'est conservée.
- **Ne pas toucher** à la configuration d'affichage du tableau de transactions (`TRANSACTION_SOURCE_FIELDS` : `minWidth`, `priority`, `defaultVisible`) ni aux champs `latitude` / `longitude`, qui sont de vrais champs enrichissables (la migration `20260711120000_remove_source_coordinates` les a déjà sortis de `TransactionSource`).
- **Ne pas refondre** le calcul des règles de calcul ni le parser Excel.
- **Ne pas modifier** le comportement des filtres virtuels existants (`statut`) ni du filtre `TYPE_TRANSACTION`.

## Décisions

1. **Enum Prisma** `NatureChamp { SAISISSABLE, CALCULE }` (§6.5). La migration supprime d'abord les lignes non conformes et leurs dépendances, puis convertit la colonne.
2. **Catalogue `SOURCE_FIELDS`** dans `app/src/lib/transaction-source-fields.ts`, à côté de la configuration d'affichage.
3. **`recommendFilterType`** perd son paramètre `nature` et sa branche `SOURCE` ; la recommandation pour une donnée source vient du catalogue.
4. **Un filtre source** est identifié par `champEnrichissableId === null && isSourceFieldCode(codeMachine)`. Les options distinctes sont exposées au niveau `FilterConfig.optionsListe` (et non plus injectées dans `champEnrichissable.optionsListe`).
5. **UI admin des filtres** : les options « Champs sources » proviennent du catalogue (valeur `__SOURCE_<code>`), plus aucune lecture en base pour ces entrées.
6. **`lots_cadastraux`** figure dans le catalogue (pour le filtre `NUMERO_LOT` et la colonne `lotsCadastraux`) mais est **exclu** de `SOURCE_FIELD_CODES`, qui sert à valider la syntaxe des règles de calcul : une colonne tableau n'est pas calculable.

## Architecture

### 1. Catalogue des données source — `app/src/lib/transaction-source-fields.ts`

Nouveau descripteur, en regard de `TRANSACTION_SOURCE_FIELDS` (qui reste inchangé) :

```ts
import type { TypeDonneesChamp } from "@/types/champ"
import type { FilterType } from "@/types/filter"

export interface SourceField {
  /** Identifiant canonique snake_case (§7.3.2) : utilisé dans les regles_calcul et comme code_machine des filtres. */
  code: string
  /** Propriété correspondante du modèle Prisma TransactionSource. */
  column: string
  label: string
  typeDonnees: TypeDonneesChamp
  typeFiltreRecommande: FilterType
  /** true for a multi-valued column (String[]): excluded from rule-calculation codes. */
  array?: boolean
}

export const SOURCE_FIELDS: SourceField[] = [ /* tableau ci-dessous */ ]

export const SOURCE_FIELD_CODES = SOURCE_FIELDS.filter((f) => !f.array).map((f) => f.code)
export const SOURCE_FIELD_BY_CODE: Record<string, SourceField> =
  Object.fromEntries(SOURCE_FIELDS.map((f) => [f.code, f]))

export function isSourceFieldCode(code: string | null | undefined): boolean {
  return !!code && code in SOURCE_FIELD_BY_CODE
}
export function sourceColumnOf(code: string): string | undefined {
  return SOURCE_FIELD_BY_CODE[code]?.column
}
```

Contenu du catalogue (10 colonnes de `TransactionSource`) :

| `code` (snake_case) | `column` (Prisma) | `label` | `typeDonnees` | `typeFiltreRecommande` |
|---|---|---|---|---|
| `numero_inscription` | `numeroInscription` | N° d'inscription | `TEXTE` | `RECHERCHE_TEXTE` |
| `date_vente` | `dateVente` | Date de vente | `DATE` | `PLAGE_DATE` |
| `prix_vente` | `prixVente` | Prix à l'acte | `DECIMAL` | `PLAGE_NUMERIQUE` |
| `vendeur` | `vendeur` | Vendeur | `TEXTE` | `RECHERCHE_TEXTE` |
| `acheteur` | `acheteur` | Acheteur | `TEXTE` | `RECHERCHE_TEXTE` |
| `lots_cadastraux` | `lotsCadastraux` | Lots cadastraux | `TEXTE` | `NUMERO_LOT` (`array: true`) |
| `adresse` | `adresse` | Adresse | `TEXTE` | `RECHERCHE_TEXTE` |
| `municipalite` | `municipalite` | Municipalité | `TEXTE` | `LISTE` |
| `mrc` | `mrc` | MRC | `TEXTE` | `LISTE` |
| `superficie_totale_hectare` | `superficieTotaleHectare` | Superficie (ha) | `DECIMAL` | `PLAGE_NUMERIQUE` |

`SOURCE_FIELD_CODES` reproduit donc exactement l'ensemble actuel (9 identifiants, sans `lots_cadastraux`), mais dérivé du catalogue afin d'éviter toute duplication.

### 2. Construction de la clause `where` — `app/src/lib/filters.ts`

- Suppression du `Set` codé en dur `SOURCE_FIELDS` et de `isSourceField(field)` ; remplacés par `isSourceFieldCode(field)` du catalogue.
- Pour un champ source, la clé Prisma est obtenue par `sourceColumnOf(field)` (et non plus le nom de champ tel quel) :

  ```ts
  const column = sourceColumnOf(field) as keyof Prisma.TransactionSourceWhereInput | undefined
  ```

  La valeur de retour de `sourceColumnOf` étant bornée au catalogue, elle sert de liste blanche : aucune clé arbitraire ne peut atteindre Prisma.
- `RECHERCHE_TEXTE` source : la branche actuelle fait un `OR` sur cinq colonnes texte (`numeroInscription`, `vendeur`, `acheteur`, `municipalite`, `adresse`) quel que soit le champ visé. **Correction** : cibler uniquement `{ [column]: { contains: value, mode: "insensitive" } }`. Motif : aujourd'hui, cinq filtres distincts (un par champ texte source) produisent la même recherche globale, ce qui rend le choix du champ inopérant.
- `PLAGE_NUMERIQUE`, `PLAGE_DATE`, `LISTE`, `MULTI_SELECT`, `BOOLEEN` : même logique, sur `column` au lieu du nom de champ.
- `NUMERO_LOT` : si `isSourceFieldCode(field)` et que le descripteur est `array`, clause `{ [column]: { has: value } }` ; sinon clause d'enrichissement (inchangée).
- `RecommendFilterTypeInput` perd `nature` ; la branche `if (champ.nature === "SOURCE")` est supprimée.
- **Nettoyage associé** : les identifiants source en camelCase présents dans les `Set` codés en dur (`LISTE_FIELDS`, `PLAGE_NUMERIQUE_FIELDS`, `RECHERCHE_TEXTE_FIELDS`, `NUMERO_LOT_FIELDS` : `mrc`, `municipalite`, `numeroInscription`, `vendeur`, `acheteur`, `adresse`, `prixVente`, `superficieTotaleHectare`, `lotsCadastraux`) deviennent morts, la recommandation source venant désormais du catalogue. Ils sont retirés. `recommendFilterType` continue de servir les champs enrichis, avec repli sur `typeDonnees`.

### 3. Résolution des filtres — `app/src/repositories/filters.repository.ts`

- Un filtre est « source » si `champ === null && isSourceFieldCode(f.codeMachine)` ; un filtre virtuel si `champ === null && f.codeMachine` n'est pas un code source (ex. `statut`).
- `findDistinctSourceValues(organisationId, code)` prend un **code source** (plus un nom de colonne) et résout la colonne via `sourceColumnOf`. Garde : descripteur existant et `typeDonnees === "TEXTE"` et non `array`.
- `findFiltersByOrganisation` calcule les options et les expose au **niveau supérieur** :

  ```ts
  // type LISTE/MULTI_SELECT sans options statiques
  const optionsListe =
    champ ? (statiques ? champ.optionsListe : await findDistinctEnrichmentValues(champ.id))
          : isSourceFieldCode(f.codeMachine) ? await findDistinctSourceValues(organisationId, f.codeMachine!)
          : null
  ```

  Le résultat porte `optionsListe` sur `FilterConfig` (jamais plus injecté dans `champEnrichissable.optionsListe`).
- `findChampsByOrganisation` : `nature` retiré du `select` (plus consommé par le formulaire admin).

### 4. Types — `app/src/types/filter.ts`

- `FilterConfig` gagne `optionsListe?: string[] | null` au niveau supérieur.
- `FilterConfig.champEnrichissable.nature` est retiré (non consommé).

### 5. Interface admin des filtres — `app/src/components/filters-admin-form.tsx`

- Le type local `Champ` perd `nature`.
- `ChampSelect` : la section « Champs sources » est alimentée par `SOURCE_FIELDS` (valeur `__SOURCE_<code>`, libellé `descriptor.label`) ; la section « Champs enrichis » par la prop `champs` (inchangée) ; les filtres virtuels (inchangés).
- `handleCreate` distingue trois cas à partir de la valeur du select :

  | Préfixe | `nomFiltre` | `champEnrichissableId` | `codeMachine` |
  |---|---|---|---|
  | `__SOURCE_<code>` | `descriptor.label` | `null` | `descriptor.code` |
  | `__VIRTUAL_<code>` | libellé virtuel | `null` | code virtuel |
  | `<id>` (champ) | `champ.nomAffichage` | `champ.id` | `null` |

- Le contrôle « déjà ajouté » compare, selon le cas, `f.codeMachine` (source/virtuel) ou `f.champEnrichissable?.id` (champ).
- `recommendedTypeForNew` : source → `descriptor.typeFiltreRecommande` ; champ → `recommendFilterType({ codeMachine, nomAffichage, typeDonnees })`.
- `getFilterIcon` reste inchangé : il résout déjà `FIELD_CODE_ICONS["mrc"]`, etc. via `codeMachine`.

### 6. Filtres côté transaction — `app/src/components/transaction-filters.tsx`

- Le champ du filtre « N° de lot (revente) » devient `field: "lots_cadastraux"` (au lieu de `"lotsCadastraux"`).
- Les options de liste sont lues au niveau supérieur : `f.optionsListe` (au lieu de `f.champEnrichissable?.optionsListe`).
- La résolution `const field = config?.codeMachine || config?.champEnrichissable?.codeMachine || id` reste valide : un filtre source a `config.codeMachine = "mrc"`.

### 7. Schéma, migration et seeds

**`app/prisma/schema.prisma`**

```prisma
enum NatureChamp {
  SAISISSABLE
  CALCULE
}

model ChampEnrichissable {
  ...
  nature NatureChamp
  ...
}
```

**Migration** (générée avec `prisma migrate dev --create-only`, puis complétée à la main). L'ordre est impératif : supprimer les dépendances, supprimer les lignes non conformes, créer le type, convertir la colonne.

```sql
-- Dépendances des champs non conformes (filtres et valeurs d'enrichissement)
DELETE FROM "filtre_recherche"
 WHERE "id_champ_enrichissable" IN (
   SELECT "id" FROM "champ_enrichissable" WHERE "nature" NOT IN ('SAISISSABLE', 'CALCULE'));

DELETE FROM "valeur_enrichissement"
 WHERE "id_champ_enrichissable" IN (
   SELECT "id" FROM "champ_enrichissable" WHERE "nature" NOT IN ('SAISISSABLE', 'CALCULE'));

DELETE FROM "champ_enrichissable" WHERE "nature" NOT IN ('SAISISSABLE', 'CALCULE');

CREATE TYPE "NatureChamp" AS ENUM ('SAISISSABLE', 'CALCULE');

ALTER TABLE "champ_enrichissable"
  ALTER COLUMN "nature" TYPE "NatureChamp" USING ("nature"::"NatureChamp");
```

**Seeds** — `app/prisma/seed.ts` : suppression du bloc `sourceChamps` (lignes 46–65) et de sa boucle. `app/prisma/seed.sql` : suppression du bloc « Champs enrichissables sources » (lignes 27–43). Les blocs « Champs géo », « Type de transaction » et les filtres sont conservés.

**Base locale** : `prisma migrate dev` (applique la migration) puis `db:seed` (le script `db:migrate` lance déjà le seed via `postdb:migrate`).

## Flux de données

```
Création d'un filtre (admin)
    │
    ├─ __SOURCE_mrc ──► champEnrichissableId = null, codeMachine = "mrc"
    ├─ __VIRTUAL_statut ─► champEnrichissableId = null, codeMachine = "statut"
    └─ <id de champ> ────► champEnrichissableId = <id>, codeMachine = null
                                   │
                                   ▼
                        filtre_recherche (persisté)

Exécution d'un filtre (page transactions)
    │
    ▼
FilterInput.field = "mrc"  (snake_case, depuis config.codeMachine)
    │
    ▼
buildWhereClause
    │
    ├─ isSourceFieldCode("mrc") ─► column = sourceColumnOf("mrc") = "mrc"
    │                              clause = { mrc: { in, mode: "insensitive" } }
    │
    └─ sinon ─────────────────────► clause d'enrichissement (champEnrichissable.codeMachine)

Options de liste (repository)
    │
    ├─ champ enrichi ─► options statiques, sinon valeurs distinctes de valeur_enrichissement
    └─ code source ───► valeurs distinctes de la colonne TransactionSource
    │
    ▼
FilterConfig.optionsListe  (niveau supérieur)
```

## Cas limites

- **Filtre source existant en base pointant un champ `SOURCE`** : la migration supprime la ligne `filtre_recherche` correspondante (aucune donnée réelle à conserver).
- **`codeMachine` d'un filtre vide ou inconnu** : `isSourceFieldCode` renvoie `false` ; le filtre est traité comme virtuel (comportement actuel).
- **Colonne tableau (`lots_cadastraux`) dans une règle de calcul** : impossible, car exclue de `SOURCE_FIELD_CODES` ; `validateRuleSyntax` la rejette comme champ inconnu.
- **Options de liste pour une colonne non textuelle** : `findDistinctSourceValues` ne s'applique qu'aux descripteurs `TEXTE` non `array` ; les autres renvoient une liste vide, donc aucune option n'est proposée (l'utilisateur saisit une valeur).
- **Valeurs distinctes vides** : `distinctNonEmpty` filtre déjà les chaînes vides et trie le résultat (inchangé).

## Tests

- **`app/tests/lib/filters.test.ts`**
  - Retirer `nature` des appels à `recommendFilterType` ; retirer les cas source (`prixVente`, `mrc`, `numeroInscription`, `dateVente`, `lotsCadastraux`) du bloc `recommendFilterType`.
  - Ajouter un bloc sur le catalogue : `SOURCE_FIELD_BY_CODE["prix_vente"].typeFiltreRecommande === "PLAGE_NUMERIQUE"`, `...["mrc"].typeFiltreRecommande === "LISTE"`, `...["lots_cadastraux"].typeFiltreRecommande === "NUMERO_LOT"`, `isSourceFieldCode("lots_cadastraux") === true`, `isSourceFieldCode("statut") === false`, `sourceColumnOf("superficie_totale_hectare") === "superficieTotaleHectare"`.
  - Ajouter un test de `buildWhereClause` : un `FilterInput` `{ typeFiltre: "LISTE", field: "mrc", operator: "in", value: "Drummond" }` produit une clause référençant la clé Prisma `mrc` ; `{ typeFiltre: "NUMERO_LOT", field: "lots_cadastraux" }` produit `{ lotsCadastraux: { has: … } }`.
  - Vérifier que `SOURCE_FIELD_CODES` ne contient pas `lots_cadastraux`.
- **`app/tests/lib/champs.test.ts`** : inchangé (les entrées utilisent déjà `SAISISSABLE` / `CALCULE`).
- **Vérification globale** : `npm run typecheck` (`tsc --noEmit`), `npm test` (vitest), `npm run lint`, puis `npm run db:migrate` + `db:seed` sur la base locale.

## Notes d'implémentation

- `SOURCE_FIELDS` (catalogue domaine) et `TRANSACTION_SOURCE_FIELDS` (config d'affichage du tableau) cohabitent dans le même fichier ; un commentaire en tête de chaque export précise l'objet de chacun. Une unification est hors périmètre.
- La correspondance `code → column` est la seule source de vérité ; aucun `Set` de noms de colonnes ne doit subsister ailleurs.
- `enrichment.repository.ts` crée déjà ses champs avec `nature: "SAISISSABLE"` : compatible avec l'enum sans modification.
- La correction de `RECHERCHE_TEXTE` (§2) est un changement de comportement assumé : elle rend le choix du champ effectif. À valider lors de la relecture.
