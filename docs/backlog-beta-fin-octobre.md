# Backlog — fin octobre 2026 (beta)

Points identifiés lors de la revue du périmètre beta après implémentation de la
réouverture des fiches analysées. Chaque point indique le constat vérifié dans le
code, l'impact sur le cahier des charges et un critère d'acceptation.

Le terme « lot 2 » n'apparaît pas dans le cahier ; ce backlog couvre le 2e
livrable daté de fin octobre au §9 : fiches transaction détaillées, admin des
champs à enrichir, paniers de comparables, exports Excel et carte.

---

## 2. Contributeur non enregistré au passage à « Analysée »

**Constat** : `Transaction.contributeurId` existe en base (`prisma/schema.prisma:71`)
mais n'est écrit nulle part dans `app/src`. `updateFicheStatut` ne persiste que
`statut` et `dateStatut` (`app/src/repositories/fiche.repository.ts:45-54`).

**Impact** : §7.5.5 exige que le passage à « Analysée » enregistre l'évaluateur
comme Contributeur, et que la réouverture conserve ce contributeur historique.

**Dépendance** : l'identité utilisateur arrive avec la version gamma (Auth.js).
Le cookie d'authentification actuel ne porte pas d'utilisateur.

**Décision à prendre** : livrer avec gamma, ou introduire une identité minimale
avant beta (saisie du nom de l'évaluateur, ou utilisateur unique configuré) pour
respecter §7.5.5 dès la beta.

**Critère d'acceptation** : après passage à « Analysée », `contributeurId` est
renseigné ; après réouverture puis nouvelle analyse, le contributeur historique
reste consultable.

---

## 3. Warnings non bloquants absents

**Constat** : seules les règles bloquantes V-001 à V-007 sont implémentées
(`app/src/lib/validation.ts`, `app/src/lib/fiche.ts`). Aucun code ne détecte
l'écart inhabituel entre prix de vente et évaluation municipale, ni l'écart entre
superficie totale et somme des composantes, ni la sauvegarde forcée.

**Impact** : §7.8.3 demande ces deux avertissements, avec possibilité pour
l'évaluateur de forcer la sauvegarde.

**Critère d'acceptation** : un écart déclenche un avertissement visible mais non
bloquant ; « forcer la sauvegarde » persiste les valeurs sans changer les règles
V-001 à V-007.

---

## 4. Analyse de Dossier (§7.8.2) non implémentée

**Constat** : les modèles `AnalyseDossier` et `IndicateursAjustes` existent dans
`prisma/schema.prisma:233-280` mais ne sont utilisés par aucun code applicatif.
L'export Excel redemande le taux de croissance, la date et les valeurs de
référence à chaque ouverture de la modale, puis calcule côté client
(`app/src/components/dossier/panier-excel-export.tsx`, `app/src/lib/excel-export.ts`).

**Impact** : §7.8.2 décrit une analyse propre au Dossier, enregistrée, dont les
paramètres de référence sont réutilisés pour toutes ses transactions. Aujourd'hui
rien n'est conservé : l'évaluateur ressaisit tout à chaque export, et les
indicateurs ajustés ne sont jamais stockés ni affichables dans le panier.

**Critère d'acceptation** : création d'une analyse de dossier (date, taux,
valeurs de référence), persistance des indicateurs ajustés par transaction du
panier, réutilisation automatique des paramètres lors d'un export ultérieur.

---

## 5. Personnalisation du panier : tri non persisté

**Constat** : les colonnes visibles et leur ordre sont mémorisés par panier en
localStorage via `storageKey={panier-table:${panierId}}`
(`app/src/components/dossier/panier-view.tsx:119`). En revanche `sortField` et
`sortOrder` sont des `useState` initialisés à `date_vente`/`desc` à chaque
chargement (`panier-view.tsx:83-84`).

**Impact** : §7.7.3 exige que le tri des colonnes soit sauvegardé par panier.

**Écart complémentaire** : le cahier prévoit une sauvegarde par utilisateur en
base pour la liste des transactions (§7.6.3) ; l'application utilise localStorage.

**Critère d'acceptation** : après rechargement, le panier rouvre avec le dernier
tri appliqué, isolé par panier.

---

## 6. Polygone → panier — déjà couvert (vérifié le 2026-10-18)

**Correction de l'analyse initiale** : ce point était erroné. Le polygone filtre
le tableau (`app/src/components/transaction-map.tsx:65-86`) **et** ouvre la modale
d'ajout au panier avec les transactions sélectionnées
(`transaction-map.tsx:118-136`). Le parcours est couvert par un test E2E
(`e2e/map.spec.ts:16`, « dessine un polygone et ajoute la sélection au panier »).

**Reste éventuel** : rien d'identifié côté §7.6.4. Le dialogue propose le
dossier et le panier, avec préremplissage du dernier panier utilisé.

---

## 7. Traçabilité des modifications absente sur la fiche

**Constat** : `createAuditLog` n'est appelé que pour les imports et les actes PDF
(`app/src/server/actions/import.ts`, `app/src/server/actions/actes.ts`). Les
sauvegardes de fiche (`saveFiche`) et les changements de statut
(`setFicheStatut`) ne créent aucune entrée d'audit.

**Impact** : §7.12.3 exige la traçabilité des modifications, notamment la
correction d'une valeur importée — cas central de l'enrichissement.

**Critère d'acceptation** : chaque sauvegarde de fiche et chaque changement de
statut produit une entrée d'audit avec transaction, champ concerné, ancienne
valeur, nouvelle valeur et date.

---

## 8. Type de données d'un champ IMPORTE modifiable

**Constat** : le panneau d'édition admin laisse changer `typeDonnees` quel que
soit `nature` (`app/src/components/admin/champs/champ-edit-panel.tsx:68-69`).

**Impact** : un champ importé est la référence factuelle de l'acte (§6.5) et doit
rester en lecture seule. Changer son type peut rendre illisibles des valeurs déjà
importées et fausser les filtres et le formatage.

**Critère d'acceptation** : pour un champ `IMPORTE`, le type de données est
affiché mais non modifiable ; les champs `SAISISSABLE` et `CALCULE` restent
libres dans les limites des types supportés.
