# Fiche transaction (édition et consultation) — conception

**Date :** 2026-09-22
**Portée :** `app/src/app/(app)/transactions`, `app/src/components/fiche`, `app/src/server/actions`, `app/src/repositories`, `app/src/lib`, `app/src/serializers`, `app/tests`
**Cahier des charges :** §7.5 (fiche transaction détaillée), §6.5–6.10 (modèle), §7.8.3 (validation bloquante)

## Contexte

La fiche transaction est le cœur métier d'EVAGRI : l'évaluateur y saisit les champs enrichissables d'une transaction puis la marque « Analysée ». Les briques de données existent déjà :

- `ChampEnrichissable` (§6.5) avec `nature` enum `SAISISSABLE | CALCULE`, `est_affiche`, `est_obligatoire`, `regleCalcul`, `applicableATypes`, `plageMin`/`plageMax`, `typeDonnees`.
- La disposition de la fiche est configurable par l'administrateur dans **Admin → Champs enrichissables** et persistée dans `VueFicheEvaluation.contenu = { sections: FicheSection[] }` (§6.10). `findFicheLayout(organisationId)` la relit ; `sections-editor.tsx` l'édite.
- `TransactionEnrichie` (§6.8) porte `statut` et `contributeurId` ; `ValeurEnrichissement` (§6.9) stocke une valeur par champ (`valeurNombre` / `valeurTexte` / `valeurBooleen`).
- `lib/calculator.ts` (moteur de règles, isomorphe), `lib/validation.ts` (règles V-001…V-007), `lib/transaction-source-fields.ts` (catalogue source), `lib/file-storage.ts` (`saveActePDF`), `repositories/typologie.repository.ts` sont en place.

Il manque la page elle-même : aucune route `/transactions/[id]`, et les boutons « Analyser » / « Voir » de `transaction-table.tsx` n'ont pas de `onClick`.

## Objectif

Livrer la **fiche transaction** :

1. Une route unique `/transactions/[id]` dont le **mode dérive du statut** : `"A analyser"` → **édition**, `"Analysée"` → **consultation** (lecture seule).
2. La disposition reflète **exactement** celle enregistrée dans l'admin (`VueFicheEvaluation.contenu.sections`).
3. Deux zones : **principale** (champs `SAISISSABLE`) et **latérale « Indicateurs »** (champs `CALCULE`, non réordonnables).
4. En consultation : une section **« Données sources »** en tête, affichant les données brutes.
5. Recalcul **instantané côté client** des champs `CALCULE` au `onBlur`, sauvegarde serveur.
6. Validation **bloquante** (§7.8.3), documents PDF (§7.5.8), type de transaction (§7.5.3).
7. Des **composants réutilisables** (un contrôle par `typeDonnees`), logique pure testable dans `lib/fiche.ts`.

## Décisions

1. **Une seule route, mode dérivé du statut.** Pas de route distincte pour la consultation : `/transactions/[id]` rend la fiche en édition ou en consultation selon `TransactionEnrichie.statut`.
2. **Seuls les champs placés dans une section enregistrée sont affichés.** La disposition (`contenu.sections`) est la source de vérité : un champ non placé dans une section (pool « non assignés » du `SectionsEditor`) **n'apparaît pas** sur la fiche. Décision explicite du propriétaire du produit (contestation d'un repli « Non classés »). Conséquence assumée : l'admin contrôle ce qui figure sur la fiche ; un champ oublié dans le pool est invisible (voir *Cas limites*).
3. **Filtrage par `applicableATypes`.** Un champ dont `applicableATypes` est **non vide** et ne contient pas le **code** du type de la transaction est **masqué**. `applicableATypes` vide = applicable partout. Si la transaction n'a pas encore de type, aucun filtrage n'est appliqué (formulaire complet).
4. **Type de transaction : une seule typologie feuille, obligatoire.** Le type est porté par le champ de `codeMachine = "typeTransaction"` (voir §6.7/seed). La valeur enregistrée est le **code** de la typologie (canonique, §7.3.2) ; à la lecture, la fiche résout la valeur via `code` puis, en repli, via `nom` (tolérance pour les valeurs écrites par l'importeur, qui stocke actuellement le `nom`). La comparaison `applicableATypes` se fait code à code.
5. **Statuts conservés en l'état** : `"A analyser"` et `"Analysée"` (pas de migration, pas d'alignement sur les libellés du CDD « Non analysée »).
6. **Contributeur différé à la phase gamma.** `contributeurId` / `dateStatut` / `id_modifie_par` ne sont pas écrits (restent `null`). Le passage « Analysée » n'enregistre pas l'évaluateur pour l'instant (pas d'utilisateur de session réel — `lib/auth.ts` est mono-utilisateur codé en dur).
7. **Recalcul client instantané.** Les champs `CALCULE` sont recalculés dans le navigateur via `calculator.evaluateRule` au `onBlur` de chaque champ modifié ; la persistance se fait à l'enregistrement serveur.
8. **Arrondi à l'entier au stockage** des champs `CALCULE` (`roundToInteger`, §7.5.4/§7.8.1).
9. **Indicateurs ajustés non affichés** (§7.5.1 / §7.5.6) — aucune lecture de `IndicateursAjustes`.
10. **Aucun badge de provenance** (§7.5.2).

## Non-objectifs

- **Précédent / Suivant** et l'auto-passage à la transaction suivante à l'ajout au panier (§7.5.9).
- **Ajout au panier** depuis la fiche (le bouton « Ajouter au panier » du tableau reste inerte).
- **Contributeur** et journalisation de l'évaluateur (phase gamma).
- **Réouverture** d'une transaction « Analysée » (bouton de bascule retour ; §7.5.7) — l'action serveur le supportera, mais l'entrée d'interface pour rouvrir sera traitée avec la phase gamma.
- **Import masse des PDF** par convention `numero_inscription_date.pdf` (§7.5.8) — relève du module d'import ; ici, upload unitaire seulement.
- **Refonte** du parser, du moteur de calcul ou du module d'import.
- **Alignement de l'importeur** sur le stockage du `code` de typologie (le repli de lecture suffit).

## Architecture

### 1. Logique pure — `app/src/lib/fiche.ts`

Toute la logique de composition est isolée dans des fonctions pures, testables sans React ni Prisma.

```ts
import type { ChampEnrichissableConfig, FicheSection } from "@/types/champ"
import type { TypeDonneesChamp } from "@/types/champ"

export type FicheMode = "edition" | "consultation"
export type FicheValeur = string | number | boolean | null

/** Champ + valeur résolue, prêt à rendre. */
export interface FicheChamp {
  config: ChampEnrichissableConfig
  valeur: FicheValeur
}

export interface FicheSectionChamps {
  section: FicheSection
  champs: FicheChamp[]
}

export interface FicheViewModel {
  mainSections: FicheSectionChamps[]   // SAISISSABLE, sections enregistrées, dans l'ordre
  indicateurs: FicheChamp[]            // CALCULE, est_affiche, ordreAffichage
}
```

Fonctions :

- `isChampApplicable(champ, typeCode)` → `boolean` (décision 3).
- `buildFicheViewModel({ sections, champs, valeurs, typeCode })` → `FicheViewModel`. Filtre successivement : champ présent dans une section (`sections[i].champs`), `actif`, `estAffiche`, `isChampApplicable` ; puis répartit : `SAISISSABLE` → dans sa section (ordre `section.ordre`), `CALCULE` → `indicateurs` (tri `ordreAffichage`). Les sections vides après filtrage sont omises.
- `buildCalculationContext(champs, valeursSource, valeursEnrichies)` → `CalculationContext` (`calculator.ts`) : `source` indexé par code source (catalogue `SOURCE_FIELDS`), `enrichi` indexé par `codeMachine`.
- `recomputeIndicateurs(champs, context)` → `Record<string, number | null>` : évalue `regleCalcul` de chaque champ `CALCULE` puis `roundToInteger`.
- `validateFiche(...)` → `ValidationError[]` : assemble `EnrichmentValidationInput` (§7.8.3) depuis les valeurs + la config des champs et appelle `validateEnrichment` ; ajoute la règle « type de transaction obligatoire » (§7.5.3), les champs `estObligatoire` non remplis, et `validateSaleDate` (V-004) si `dateVente` est présente.
- Gestion des valeurs par type : `toStorageValue(typeDonnees, valeur)` et `fromStorageValue(typeDonnees, valeur)` — convertissent vers/depuis `valeurNombre` / `valeurTexte` / `valeurBooleen`.
- `resolveTypeTransaction(valeur, typologies)` → `{ id, code, nom } | null` (repli code → nom, décision 4).

### 2. Accès aux données — `app/src/repositories/fiche.repository.ts`

```ts
findTransactionFiche(organisationId, id)   // TransactionSource + enrichie + valeurs + champEnrichissable
listDocuments(transactionSourceId)         // DocumentActe, tri dateUpload desc
createDocument(transactionSourceId, { nomFichier, cheminStockage, uploadeurId })
deleteDocument(documentId)
upsertValeurEnrichissement(transactionEnrichieId, champEnrichissableId, value)  // clé unique §6.9
updateStatut(transactionEnrichieId, statut, dateStatut)
```

- Les champs enrichissables proviennent de `listChampsEnrichissablesByOrganisation` (`champs.repository.ts`, déjà utilisé par l'admin) : aucune lecture dupliquée.
- L'écriture des valeurs se fait dans un `prisma.$transaction`, avec suppression des `ValeurEnrichissement` dont la valeur devient vide (même logique de filtrage que `createImportedTransaction`).
- `upsertValeurEnrichissement` s'appuie sur la contrainte unique `[transactionEnrichieId, champEnrichissableId]`.

### 3. Actions serveur — `app/src/server/actions/fiche.ts`

`"use server"`. **Aucune exception ne remonte au client** : toute action renvoie `{ ok: true, ... } | { ok: false, error }` (Next masque les messages des actions lancées en production ; voir `champs.ts`).

```ts
saveFiche(input): Promise<{ ok: true } | { ok: false; error: string }>
setFicheStatut(id, statut): Promise<{ ok: true } | { ok: false; error: string }>
uploadDocument(transactionSourceId, formData): Promise<{ ok: true } | { ok: false; error: string }>
deleteDocument(documentId): Promise<{ ok: true } | { ok: false; error: string }>
```

Aucune action de lecture : la page (server component) charge les données via les repositories et les passe en props ; les mutations déclenchent `revalidatePath` puis le rafraîchissement serveur.

- `saveFiche(input)` : `input = { id, valeurs: { [codeMachine]: FicheValeur }, typeTransactionId }`. Entrée validée par Zod ; `validateFiche` applique les règles bloquantes et, en cas d'erreur, renvoie le **premier** message (`{ ok: false, error }`).
- `setFicheStatut` : seule la bascule vers `"Analysée"` est câblée dans cette passe (validation bloquante requise avant succès). `dateStatut = now()`, `contributeurId` reste `null` (décision 6). `revalidatePath("/transactions")`.

### 4. Sérialisation — `app/src/serializers/fiche.serializer.ts`

`SerializedFiche = { transaction, champs, sections, typologies, documents, statut, mode }` — **forme des props** passées de la page au client. Réutilise `serializeTransaction` (`transaction.serializer.ts`) pour la transaction source ; les `Decimal` sont convertis en `number` via `decimal.js` (cohérent avec le reste du dépôt).

### 5. Route — `app/src/app/(app)/transactions/[id]/page.tsx`

Server component, `export const dynamic = "force-dynamic"`. Charge en parallèle `findTransactionFiche`, `listChampsEnrichissables`, `findFicheLayout`, `listTypologiesByOrganisation`, `listDocuments`. Rend `<FicheTransactionClient fiche={...} />`. `notFound()` si la transaction est absente ou hors organisation.

### 6. Composants réutilisables — `app/src/components/fiche/`

| Composant | Rôle |
|---|---|
| `fiche-transaction.tsx` | Client ; détient l'état (valeurs, mode, statut), le recalcul, la validation, les appels d'actions. Orchestrateur. |
| `fiche-header.tsx` | En-tête : N° d'inscription + N° de lot (`lotsCadastraux` joints, §7.5.1), sélecteur **Type de transaction**, badge de statut, actions **Enregistrer** / **Analyser** (masquées en consultation). |
| `section-card.tsx` | Carte réutilisable : titre + grille de champs. Utilisée pour chaque section principale **et** pour la zone latérale. |
| `field-control.tsx` | Contrôle **éditable** selon `typeDonnees` (DECIMAL / ENTIER → `Input` numérique ; TEXTE → `Input` ; DATE → `Input date` ; BOOLEAN → `Switch`/case à cocher ; LISTE → `Select` depuis `optionsListe`). `onBlur` remonte la valeur. Gère `estObligatoire`, `plageMin`/`plageMax`, `estModifiable`. |
| `field-value.tsx` | Affichage **lecture seule** selon `typeDonnees` (réutilise `formatValue` / `formatNumber` de `transaction-table.tsx` ; dates formatées en `fr-CA` comme `defaultCellValue`). Utilisé en consultation et pour la zone latérale. |
| `indicateurs-panel.tsx` | Zone latérale « Indicateurs » : liste de `FicheChamp` `CALCULE` via `field-value`, non réordonnable. |
| `source-data-panel.tsx` | Section « Données sources » (consultation uniquement) : les 10 entrées de `SOURCE_FIELDS` avec leur `label` et la valeur de la colonne correspondante (`sourceColumnOf`). |
| `documents-panel.tsx` | Liste des `DocumentActe`, upload unitaire PDF (`input type=file accept=application/pdf` → `uploadDocument`), suppression. |

Réutilisation : `section-card`, `field-control`, `field-value` sont les briques partagées entre les deux modes et les deux zones. `ui/` existants (`Button`, `Input`, `Select`, `Switch`, `Badge`, `Label`, `Tabs`) sont réutilisés.

### 7. Câblage navigation — `app/src/components/transaction-table.tsx`

`Actions` reçoit l'`id` de la ligne et navigue via `useRouter().push(`/transactions/${id}`)` :
- bouton **Analyser** (statut `"A analyser"`) → `/transactions/[id]` (mode édition) ;
- bouton **Voir** (statut `"Analysée"`) → `/transactions/[id]` (mode consultation) ;
- bouton **Ajouter au panier** : inchangé (hors périmètre).

## Flux de données

```
Page (server) ──► findTransactionFiche / findFicheLayout / listChamps / listTypologies / listDocuments
                        │
                        ▼
              buildFicheViewModel(sections, champs, valeurs, typeCode)
                        │
        ┌───────────────┴───────────────┐
        ▼                               ▼
  mainSections (SAISISSABLE)      indicateurs (CALCULE)
        │                               │
        ▼                               ▼
  section-card → field-control     indicateurs-panel → field-value
  (édition) / field-value (consultation)

Enregistrement (client → serveur)
  onBlur ──► recomputeIndicateurs (calculator.ts, instantané)
  bouton Enregistrer ──► saveFiche ──► Zod ──► validateFiche (V-001…V-007, obligatoires, type)
                                   ──► upsertValeurEnrichissement ($transaction) ──► { ok }
  bouton Analyser ──► saveFiche puis setFicheStatut("Analysée") ──► { ok } / { ok:false, error }
```

## Cas limites

- **Champ non placé dans une section** : non affiché (décision 2). L'administrateur doit le placer via l'éditeur de sections ; c'est un comportement voulu, pas un défaut.
- **`applicableATypes` non vide, transaction sans type** : pas de filtrage (décision 3) — l'utilisateur peut renseigner le type et les champs obligatoires.
- **Type stocké en `nom` par l'importeur** : résolu par le repli de lecture (`resolveTypeTransaction`), donc `applicableATypes` (codes) reste cohérent.
- **`regleCalcul` référençant un champ vide ou division par zéro** : `evaluateRule` renvoie `null` → indicateur laissé vide (pas d'erreur).
- **Champ `CALCULE`** : jamais éditable, quelle que soit la config (`est_modifiable` dérivé de la nature).
- **Champ `SAISISSABLE` avec `regleCalcul`** : pré-calculé à l'ouverture, l'évaluateur peut conserver ou modifier (§7.5.2).
- **Section dont tous les champs sont filtrés** (`estAffiche=false`, non applicable) : section omise.
- **Transaction inexistante / hors organisation** : `notFound()`.
- **Valeur vidée** : la ligne `ValeurEnrichissement` correspondante est supprimée (pas de valeur nulle persistée).
- **PDF non-`application/pdf`** : rejeté par `uploadDocument` (`{ ok: false, error }`).

## Tests

Fichier `app/tests/lib/fiche.test.ts` (Vitest, environnement `node`, alias `@` — exécuter depuis `app/`) :

- `isChampApplicable` : vide → true ; contient le code → true ; ne contient pas → false ; sans type → true.
- `buildFicheViewModel` : un champ **non placé** dans une section n'apparaît pas ; `estAffiche=false` exclu ; `SAISISSABLE` en zone principale dans sa section ; `CALCULE` en indicateurs triés par `ordreAffichage` ; section vidée par filtrage omise ; `applicableATypes` masque le champ non applicable ; ordre des sections respecté.
- `recomputeIndicateurs` : `prix_vente / superficie_totale_hectare` arrondi à l'entier ; division par zéro → `null`.
- `validateFiche` : V-001 (cultivée+boisée+constructible > totale), V-002 (drainée > cultivée), type manquant, champ obligatoire vide, V-004 (date future).
- `toStorageValue` / `fromStorageValue` pour CHAQUE `typeDonnees`.
- `resolveTypeTransaction` : par code ; repli par nom.

Vérification globale : `npm run typecheck` (`tsc --noEmit`), `npm test` (vitest), `npm run lint`.

## Notes d'implémentation

- Toute la composition/filtrage/validation vit dans `lib/fiche.ts` (pur) ; les composants ne font que rendre et remonter des événements.
- `saveFiche` réutilise le motif `{ ok, error }` de `champs.ts` (jamais de `throw`).
- Le sélecteur « Type de transaction » est traité à part de `field-control` : il n'est pas dans une section, il vit dans l'en-tête, et ses options viennent des typologies feuilles (pas de `optionsListe`).
- `lotsCadastraux` étant un tableau, l'en-tête joint les lots par « , » ; il n'est pas un champ calculable.
- `Tabs` de `ui/` est disponible si un basculement « Saisie / Consultation » s'avère utile, mais le mode est déduit du statut, donc aucune bascule manuelle n'est prévue dans cette passe.
