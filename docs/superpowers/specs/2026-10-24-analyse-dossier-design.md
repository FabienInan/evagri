# Analyse de Dossier — indicateurs ajustés persistés (Beta)

**Date :** 2026-10-24
**Référence :** cahier des charges §5.1, §6, §7.8.2, §7.9

## Contexte

Les indicateurs ajustés dans le temps sont aujourd'hui calculés à la volée dans l'export Excel
(`app/src/lib/excel-export.ts`, `computeAdjustedValues`) à partir de paramètres saisis dans le formulaire
d'export à chaque fois. Le cahier exige qu'une **Analyse de Dossier** soit créée, stockée et réutilisée.
Les modèles Prisma `AnalyseDossier`, `ParametresAnalyseTransaction` et `IndicateursAjustes` existent mais
ne sont utilisés nulle part dans l'application.

## Décisions validées

1. **Valeurs de référence sur l'analyse**, une seule série par Analyse de Dossier (§7.8.2). La table
   `ParametresAnalyseTransaction` est supprimée.
2. **Rattachement au Dossier** (`AnalyseDossier.dossierId`). Le champ `panierId` est retiré.
3. **Calcul automatique** : à la création d'une analyse, et recalcul lorsqu'elle est modifiée ou qu'une
   transaction entre ou sort d'un panier du dossier.
4. **Export** : l'export Excel sélectionne une Analyse de Dossier stockée. Le taux de croissance et la
   date d'évaluation viennent de l'analyse, ils ne sont plus saisis dans le formulaire d'export.

## Points à confirmer avant implémentation

- **Transactions couvertes par l'analyse.** Proposition : toutes les transactions de tous les paniers du
  dossier (union, sans doublon). Alternative : une sélection de paniers à la création, ce qui impose une
  table de jointure supplémentaire.
- **Taux de croissance et date d'évaluation** : confirmer qu'ils sont portés par l'analyse (et non par
  l'export).

## Modèle de données

`AnalyseDossier` (table `analyse_dossier`) :

| Colonne | Type | Note |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK |
| `id_dossier` | UUID | FK, obligatoire |
| `date_evaluation` | DATE | obligatoire |
| `taux_croissance` | DECIMAL(5,4) | existant, en fraction |
| `taux_boise_ref` | DECIMAL(15,2) | nouveau, nullable |
| `taux_cultive_ref` | DECIMAL(15,2) | nouveau, nullable |
| `valeur_batiment_ref` | DECIMAL(15,2) | nouveau, nullable |
| `valeur_maison_ref` | DECIMAL(15,2) | nouveau, nullable |
| `valeur_terrain_residentiel_ref` | DECIMAL(15,2) | nouveau, nullable |
| `id_createur`, `date_creation` | | existants |

Supprimé : `id_panier`, relation `ParametresAnalyseTransaction`.

`IndicateursAjustes` : inchangé (une ligne par analyse et par transaction, colonnes déjà présentes).
Les indicateurs non ajustés (drainé, feuillu, zones humides, entaillage) ne sont pas stockés.

## Comportement

- **Création** (`createAnalyseDossier`) : valide les paramètres, puis calcule et écrit une ligne
  `IndicateursAjustes` par transaction du dossier. Le calcul réutilise `computeAdjustedValues` tel quel.
- **Modification** (`updateAnalyseDossier`) : met à jour les paramètres et recalcule toutes les lignes.
- **Changement de panier** (`addTransactionsToPanier`, `removeTransactionFromPanier`) : recalcule les
  analyses du dossier concerné. Une transaction retirée de tous les paniers voit sa ligne supprimée.
- **Suppression** (`deleteAnalyseDossier`) : supprime l'analyse et ses lignes.
- Les indicateurs ajustés ne sont **jamais** affichés sur la fiche transaction (§7.5.1).

## Interface

- Page dossier : section « Analyses » listant les analyses (date d'évaluation, taux, nombre de
  transactions), avec création, modification et suppression.
- Formulaire d'analyse : taux de croissance, date d'évaluation, les cinq valeurs de référence.
- Export Excel d'un panier : sélecteur d'analyse (obligatoire dès qu'une colonne ajustée est cochée).
  Les champs taux, date et références disparaissent du formulaire. Les colonnes ajustées lisent
  `IndicateursAjustes`, sans recalcul.

## Hors périmètre

- Export carte PNG (inchangé).
- Historique des analyses ou versionnement.
- Indicateurs ajustés affichés dans le tableau de résultats.

## Tests

- Tests unitaires : `computeAdjustedValues` (inchangé), et la fonction qui produit les lignes
  `IndicateursAjustes` à partir d'une analyse et de ses transactions.
- Tests d'intégration des actions : création, recalcul après ajout/retrait de panier, suppression en cascade.
- E2E : création d'une analyse sur un dossier, export Excel qui reprend ses valeurs.
- Migration Prisma : suppression de `ParametresAnalyseTransaction`, ajout des colonnes de référence.
  Aucune donnée existante à reprendre (les tables ne sont pas alimentées).
