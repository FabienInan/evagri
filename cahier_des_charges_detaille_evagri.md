# Outil de gestion des transactions comparables agricoles — Cahier des charges
---

## 1. Introduction et contexte stratégique

EVAGRI est une PME québécoise spécialisée dans l’évaluation de biens agricoles (terres cultivées, terres boisées, érablières, fermes complètes). Son processus repose actuellement sur un fichier Excel partagé alimenté manuellement à partir de données JLR, d’analyses terrain et d’un fichier historique interne.

Le présent document constitue la spécification fonctionnelle exhaustive de la plateforme à développer. Il ne préjuge d’aucune décision technique d’implémentation (stack, framework, infrastructure) qui relève de la responsabilité du prestataire informatique.

---

## 2. Glossaire métier

| Terme | Définition |
|---|---|
| **Transaction** | Vente enregistrée d’un bien agricole. Toutes ses informations (données de l’acte importées, analyse EVAGRI saisie, indicateurs calculés) sont portées par des **valeurs de champ**. |
| **Champ** | Unité d’information paramétrée dans l’application et pouvant être affichée sur la fiche transaction. Chaque champ porte une **nature** (libellé de provenance) : **Importé**, **Saisissable** (enrichi) ou **Calculé**. Il n’existe plus de notion distincte de « champ source » : les données de l’acte sont des champs de nature Importé. |
| **Nature d’un champ** | Libellé définissant la provenance de la valeur : `IMPORTE` (issue d’un fichier d’import), `SAISISSABLE` (saisie par l’évaluateur — enrichissement) ou `CALCULE` (déterminée par une règle de calcul). |
| **Champ importé** | Champ dont la valeur provient d’un import (fichier CSV JLR hebdomadaire ou fichier Excel EVAGRI) et constitue la référence factuelle de l’acte de vente (n° d’inscription, date de vente, prix, vendeur, acheteur, lots, MRC, municipalité, adresse, superficie totale, latitude, longitude). En lecture seule par défaut. |
| **Enrichissement** | Couche analytique propre à EVAGRI, constituée des champs saisissables et calculés. |
| **Champ saisissable** | Champ enrichi par l’évaluateur. Peut être initialisé par une règle de calcul ou par l’import du fichier EVAGRI, et reste éditable sauf s’il est configuré en lecture seule. |
| **Champ calculé (Indicateur de base)** | Champ toujours en lecture seule, dont la valeur est recalculée automatiquement par le système à chaque modification d’un champ impactant. Affiché dans la section latérale des indicateurs de la fiche. |
| **Lecture seule** | Attribut d’un champ, configurable par l’administrateur : le champ est affiché sur la fiche mais ne peut pas être modifié par l’évaluateur. Coché par défaut pour les champs importés, décoché pour les champs saisissables, toujours actif pour les champs calculés. |
| **Règle de calcul** | Expression arithmétique simple (`+`, `-`, `*`, `/`, `(`, `)`) composée de codes de champs de toute nature (importés, saisissables ou calculés). Permet d’initialiser ou de recalculer automatiquement la valeur d’un champ saisissable ou calculé. |
| **Contributeur** | Dernier évaluateur ayant passé une transaction au statut « Analysée ». |
| **Dossier** | Regroupement métier représentant une mission ou un client. Identifié par un numéro formel. Un Dossier contient un ou plusieurs Paniers. |
| **Panier** | Liste de transactions sélectionnées par un évaluateur au sein d’un Dossier. Relation hiérarchique : **Dossier → Panier → Transactions**. |
| **Analyse de Dossier** | Snapshot temporel d’un Dossier comprenant une date d’évaluation, un taux de croissance et des valeurs de marché de référence. Permet de calculer les indicateurs ajustés dans le temps. |
| **Résultat d’analyse par transaction** | Enregistrement stockant les valeurs des indicateurs ajustés calculés pour une transaction donnée, au sein d’une Analyse de Dossier spécifique. |
| **Indicateur ajusté dans le temps** | **Résultat de calcul** appliqué à une transaction dans le contexte d’une Analyse de Dossier (instant T). Il n’est pas un champ (ni importé, ni saisissable, ni calculé). Stocké séparément. |
| **Organisation** | Entité propriétaire des données. Dans le MVP, EVAGRI constitue l’organisation unique, mais l’architecture doit isoler les données par organisation. |
| **MRC** | Municipalité régionale de comté. |
| **Loi 25** | Loi québécoise sur la protection des renseignements personnels. |

---

## 3. Acteurs, rôles et permissions

| Acteur | Rôle fonctionnel | Permissions clés |
|---|---|---|
| **Administrateur** | Gère la configuration métier de l’organisation. | CRUD champs saisissables et calculés, configuration des champs importés (libellé, affichage, lecture seule, section — sans création ni suppression), CRUD filtres de recherche, CRUD utilisateurs de son organisation, relance des imports en échec, consultation des journaux d’audit, paramétrage des listes déroulantes. |
| **Évaluateur (Utilisateur)** | Effectue les analyses terrain et constitue les rapports. | Recherche multicritères, saisie des champs non en lecture seule, consultation des champs importés et calculés, création de Dossiers et Paniers (partagés), export Excel et carte, consultation des fiches. |
| **Développeur** | Supervise les flux techniques et l’infrastructure applicative. | Accès à l’interface de relance des imports, aux logs système, à la supervision du connecteur JLR. |

**Règle de partage** : Tous les évaluateurs d’une même organisation accèdent librement à l’ensemble des Dossiers et Paniers de cette organisation. Il n’existe pas de restriction de propriété sur les Dossiers (un évaluateur peut créer un panier dans un dossier qu’il n’a pas créé, et modifier un panier existant).

---

## 4. Vue d’ensemble des processus métier

    Import JLR hebdo (CSV) + Import Excel EVAGRI
             │
             ▼
    Transaction ──── valeurs des champs IMPORTE (données de l'acte) ──┐
             │                                                         │
             │    ┌────────────────────────────────────────────────────┘
             │    │ (référencés par règles de calcul)
             ▼    ▼
    Configuration Admin (Champs : Importés / Saisissables / Calculés, Lecture seule, Filtres)
             │
             ├──────────▶ Champs importés + saisissables ────▶ Fiche transaction (Drag-and-drop zone principale)
             │
             └──────────▶ Champs calculés ──────────▶ Section Indicateurs (fixe, latérale droite)
                               │
                               ▼
                       Transaction analysée (+ Contributeur)
                               │
                               ├─── Sélection ────▶ Dossier & Panier
                               │
                               ├─── Paramètres d'analyse (Date, taux, valeurs réf.)
                               │              │
                               │              ▼
                               │      Analyse de Dossier (Instant T)
                               │              │
                               │              ├─── Calcule ────▶ Résultats d'analyse (Indicateurs ajustés)
                               │              │
                               │              └─── Génère ────▶ Export Excel (Modèle EVAGRI)
                               │
                               └─── Visualise ────▶ Carte interactive OSM

---

## 5. Périmètre fonctionnel MVP

### 5.1 Dans le périmètre Phase 1

- Import manuel et automatique des données de l’acte : **fichier CSV JLR hebdomadaire** (incluant MRC, latitude et longitude) + fichier Excel EVAGRI (migration initiale et compléments futurs via template téléchargeable). Les valeurs importées alimentent les **champs de nature Importé**.
- Migration de la base Excel existante d’EVAGRI (~1 600 transactions) incluant les **documents d’acte (PDF)** associés.
- Modèle de champs unifié : tous les champs (importés, saisissables, calculés) sont décrits par une même entité **Champ**, distingués par leur **nature**.
- Configuration par l’administrateur des champs saisissables et calculés (création, modification, suppression), et des champs importés (libellé, affichage, lecture seule, section). Un champ saisissable ou calculé peut être configuré avec une **règle de calcul arithmétique**.
- Configuration par l’administrateur des **filtres de recherche**.
- Fiche transaction affichant **deux zones distinctes** :
  - **Zone principale (gauche/centre)** : champs **importés** et **saisissables** affichés (configurables par drag-and-drop multi-niveaux).
  - **Zone latérale (droite)** : champs **calculés** (indicateurs de base), position fixe, affichage configurable par l’administrateur (coché par défaut).
- Attribut **Lecture seule** par champ : un champ en lecture seule est affiché sur la fiche sans être modifiable (par défaut : champs importés).
- Pré-remplissage automatique des champs saisissables dotés d’une règle de calcul.
- Statut de transaction : Non analysée / Analysée, avec enregistrement du Contributeur.
- Typologie transactionnelle : Terres cultivées, Terres boisées, Érablières, Bâtiments agricoles, Ferme.
- Recherche multicritères avec filtres configurables, logique ET/OU, recherche textuelle fuzzy.
- Tableau dynamique de résultats (tri, pagination 10 lignes, colonnes masquables, ordre persistant par utilisateur).
- **Carte interactive** du Québec (OpenStreetMap).
- Structure hiérarchique **Dossier → Panier → Transactions**.
- Indicateurs ajustés dans le temps (stockés séparément via Analyse de Dossier + Résultat d’analyse).
- Contrôles de qualité bloquants.
- Export Excel calé sur le modèle de rapport EVAGRI (prix actualisés, indicateurs de base et/ou ajustés).
- **Export carte statique PNG** avec pins.
- Authentification multi-rôles.
- Traçabilité et conformité Loi 25.

### 5.2 Hors périmètre Phase 2

- Module mandats formalisés.
- Trouver l'activité à partir du nom des proprios (si entité/compagnie) et du REQ
- Recommandation automatique ou intelligence artificielle.
- Rapport Word automatisé.
- Application mobile.

---

## 6. Modèle de données fonctionnel (entités métier)

### 6.1 Entité : Organisation

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `nom` | VARCHAR(255) | NOT NULL |
| `actif` | BOOLEAN | DEFAULT `true` |

### 6.2 Entité : Utilisateur

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK → Organisation, NOT NULL |
| `email` | VARCHAR(255) | NOT NULL, UNIQUE(org) |
| `nom` | VARCHAR(255) | |
| `rôle` | ENUM | `ADMIN`, `EVALUATEUR`, `DEVELOPPEUR` |
| `mot_de_passe` | VARCHAR(255) | hash |
| `consentement_politique_date` | TIMESTAMPTZ | |
| `actif` | BOOLEAN | DEFAULT `true` |
| `date_creation` | TIMESTAMPTZ | DEFAULT `now()` |

### 6.3 Entité : Référentiel géographique (Municipalité)

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `nom_municipalite` | VARCHAR(255) | NOT NULL, UNIQUE |
| `mrc` | VARCHAR(100) | NOT NULL |
| `region_administrative` | VARCHAR(100) | NOT NULL |
| `code_postal_prefix` | VARCHAR(10) | |

### 6.4 Entité : Transaction

*Fusionne les anciennes entités « Transaction Source » et « TransactionEnrichie ». La transaction ne porte plus de colonnes métier : toutes ses informations (données de l’acte importées, enrichissement, indicateurs calculés) sont stockées dans **ValeurChamp** (§6.8).*

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK → Organisation, NOT NULL |
| `id_importation` | UUID | FK → Importation, NULLABLE (importation d’origine) |
| `systeme_source` | VARCHAR(20) | `JLR`, `EXISTANT_EVAGRI` |
| `statut` | ENUM | `NON_ANALYSEE`, `ANALYSEE` |
| `id_contributeur` | UUID | FK → Utilisateur, NULLABLE |
| `date_statut` | TIMESTAMPTZ | |
| `date_creation` | TIMESTAMPTZ | DEFAULT `now()` |
| `date_modification` | TIMESTAMPTZ | DEFAULT `now()` |

**Unicité** : le couple (`numero_inscription`, `date_vente`) — valeurs des champs importés correspondants — est unique par organisation. Cette unicité n’est pas garantie par une contrainte de base de données : elle est **vérifiée par le processus d’import avant insertion** (§7.1.3), en s’appuyant sur les index de **ValeurChamp**.

### 6.5 Entité : Champ

*Unifié : champs importés, saisissables et calculés partagent la même entité, différenciés par leur `nature`. La notion de « champ source » distincte disparaît.*

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK → Organisation, NOT NULL |
| `code_machine` | VARCHAR(50) | NOT NULL, UNIQUE(org, code), snake_case |
| `nom_affichage` | VARCHAR(100) | NOT NULL |
| `type_donnees` | ENUM | `DECIMAL`, `ENTIER`, `LISTE`, `MULTI_SELECT`, `TEXTE`, `TEXTE_MULTIPLE`, `BOOLEAN`, `DATE` |
| `nature` | ENUM | `IMPORTE`, `SAISISSABLE`, `CALCULE` — libellé affiché : « Importé », « Saisissable », « Calculé » |
| `unite` | VARCHAR(20) | Obligatoire si `DECIMAL`/`ENTIER`, sinon `N/A` |
| `plage_min` | NUMERIC(18,4) | |
| `plage_max` | NUMERIC(18,4) | |
| `options_liste` | JSONB | |
| `regle_calcul` | TEXT | Expression `+ - * / ( )` avec codes de champs de toute nature. Obligatoire si `nature = CALCULE`. Optionnel si `nature = SAISISSABLE`. Interdit si `nature = IMPORTE`. |
| `entetes_import` | JSONB | Pertinent uniquement si `nature = IMPORTE`. Correspondance des en-têtes de colonnes par système source, ex. : `{ "JLR": ["MRC"], "EXISTANT_EVAGRI": ["MRC"] }`. |
| `applicable_a_types` | JSONB | NOT NULL |
| `ordre_affichage` | INTEGER | DEFAULT `0`. Pertinent pour `IMPORTE` et `SAISISSABLE` (ordre par défaut avant personnalisation drag-and-drop). |
| `est_affiche` | BOOLEAN | DEFAULT `true`. Détermine si le champ apparaît sur la fiche transaction. |
| `est_lecture_seule` | BOOLEAN | DEFAULT `true` si `IMPORTE`, `false` si `SAISISSABLE`, toujours `true` si `CALCULE`. Un champ en lecture seule est affiché sur la fiche mais n’est pas modifiable par l’évaluateur. |
| `est_obligatoire` | BOOLEAN | DEFAULT `false`. Pertinent uniquement pour un champ non en lecture seule. |
| `actif` | BOOLEAN | DEFAULT `true` |

**Règles métier sur cette entité** :
- Si `nature = IMPORTE` : le champ est créé par le système (catalogue ci-dessous) ; l’administrateur ne peut ni le supprimer, ni modifier son `code_machine`, sa `nature` ou son `type_donnees`. Il peut modifier `nom_affichage`, `est_affiche`, `est_lecture_seule`, `ordre_affichage` et la section d’appartenance. `regle_calcul` est interdite.
- Si `nature = SAISISSABLE` et `regle_calcul` est renseigné, la valeur initiale est calculée à la création de la transaction mais reste modifiable (sauf si `est_lecture_seule = true`).
- Si `nature = SAISISSABLE` et `regle_calcul` est NULL, le champ est vierge à l’ouverture (ou initialisé par l’import EVAGRI).
- Si `nature = CALCULE`, alors `est_lecture_seule` est forcé à `true`, `regle_calcul` est obligatoire, `est_obligatoire` est ignoré.
- Si `est_lecture_seule = true`, `est_obligatoire` est ignoré.
- Les champs `CALCULE` sont exclus du drag-and-drop de la fiche transaction ; leur affichage est conditionné par `est_affiche`. Les champs `IMPORTE` et `SAISISSABLE` participent au drag-and-drop.

**Catalogue initial des champs importés** (données de l’acte communes aux imports JLR et EVAGRI) :

| `code_machine` | Libellé | Type | En-tête(s) fichier EVAGRI | En-tête(s) fichier JLR |
|---|---|---|---|---|
| `numero_inscription` | N° d’inscription | `TEXTE` | `No d'enregistrement`, `No d'enr.` | À confirmer selon le format JLR |
| `date_vente` | Date de vente | `DATE` | `Date de L'acte`, `Date de l'acte ou de l'avant contrat` | À confirmer |
| `vendeur` | Vendeur | `TEXTE` | `Vendeur` | À confirmer |
| `acheteur` | Acheteur | `TEXTE` | `Acheteur` | À confirmer |
| `lots_cadastraux` | Lots cadastraux | `TEXTE_MULTIPLE` | `Lots` | À confirmer |
| `prix_vente` | Prix à l’acte | `DECIMAL` ($) | `Prix de vente`, `Prix de vente ($)` | À confirmer |
| `mrc` | MRC | `TEXTE` | `MRC` | `MRC` (à confirmer) |
| `municipalite` | Municipalité | `TEXTE` | `Ville/Municipalité` | À confirmer |
| `adresse` | Adresse | `TEXTE` | `Adresse complete`, `Adresse complète` | À confirmer |
| `superficie_totale_hectare` | Superficie totale | `DECIMAL` (ha) | `Superficie Totale (ha)` | À confirmer |
| `latitude` | Latitude | `DECIMAL` (°) | `Latitude`, `Lat` | `Latitude` (à confirmer) |
| `longitude` | Longitude | `DECIMAL` (°) | `Longitude`, `Long`, `Lng` | `Longitude` (à confirmer) |

### 6.6 Entité : Configuration des filtres de recherche (FiltreRecherche)

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK → Organisation, NOT NULL |
| `id_champ` | UUID | FK → Champ, NULLABLE (NULL uniquement pour les filtres virtuels, ex. statut) |
| `nom_filtre` | VARCHAR(100) | NOT NULL |
| `type_filtre` | ENUM | `PLAGE_NUMERIQUE`, `PLAGE_DATE`, `LISTE`, `MULTI_SELECT`, `RECHERCHE_TEXTE`, `BOOLEEN` |
| `operateurs_disponibles` | JSONB | |
| `ordre_affichage` | INTEGER | DEFAULT `0` |
| `est_actif` | BOOLEAN | DEFAULT `true` |
| `applicable_a_types` | JSONB | |

### 6.7 Entité : Type de transaction (Typologie)

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK → Organisation, NOT NULL |
| `code` | VARCHAR(50) | NOT NULL, UNIQUE(org, code) |
| `nom` | VARCHAR(100) | NOT NULL |
| `id_type_parent` | UUID | FK → Typologie (auto-référence), NULLABLE |
| `est_type_mere` | BOOLEAN | DEFAULT `false` |
| `est_feuille` | BOOLEAN | DEFAULT `true` |
| `ordre` | INTEGER | DEFAULT `0` |
| `actif` | BOOLEAN | DEFAULT `true` |

### 6.8 Entité : Valeur de champ (ValeurChamp)

*Stocke toutes les valeurs d’une transaction, quelle que soit la nature du champ : importées (`IMPORTE`), saisies (`SAISISSABLE`) ou calculées automatiquement (`CALCULE`).*

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_transaction` | UUID | FK → Transaction, NOT NULL |
| `id_champ` | UUID | FK → Champ, NOT NULL |
| `valeur_nombre` | NUMERIC(18,4) | |
| `valeur_texte` | TEXT | |
| `valeur_texte_multiple` | TEXT[] | Valeurs multiples (ex. : lots cadastraux) |
| `valeur_booleen` | BOOLEAN | |
| `valeur_date` | DATE | |
| `date_modification` | TIMESTAMPTZ | DEFAULT `now()` |
| `id_modifie_par` | UUID | FK → Utilisateur, NULL si valeur issue d’un import ou d’un calcul automatique |

**Contraintes et index** :
- `UNIQUE(id_transaction, id_champ)`.
- Index sur (`id_champ`, `valeur_texte`) et (`id_champ`, `valeur_date`) : permettent la vérification rapide de l’unicité (`numero_inscription`, `date_vente`) lors de l’import et la recherche des reventes par lot.
- Index GIN sur `valeur_texte_multiple` (recherche par numéro de lot).

### 6.9 Entité : Personnalisation vue evaluation (VueFicheEvaluation)

*Stocke l'ordre drag-and-drop et les sections créées par l'administrateur. Concerne les champs IMPORTE et SAISISSABLE (les champs CALCULE restent dans la zone latérale).*

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation`  | UUID | FK → Organisation, NOT NULL |
| `type_vue` | VARCHAR(50) | `FICHE_TRANSACTION` |
| `contenu` | JSONB | NOT NULL — structure : `{ sections: [{ nom, ordre, champs: [id_champ...] }] }` |

### 6.10 Entité : Dossier

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK → Organisation, NOT NULL |
| `numero_dossier` | VARCHAR(10) | NOT NULL, UNIQUE(org), format `AA-RR-DDD` |
| `nom` | VARCHAR(255) | |
| `id_createur` | UUID | FK → Utilisateur |
| `date_creation` | TIMESTAMPTZ | DEFAULT `now()` |
| `actif` | BOOLEAN | DEFAULT `true` |

### 6.11 Entité : Panier

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK → Organisation, NOT NULL |
| `id_dossier` | UUID | FK → Dossier, NOT NULL |
| `nom` | VARCHAR(255) | NOT NULL |
| `id_type_transaction` | UUID | FK → Typologie |
| `id_createur` | UUID | FK → Utilisateur |
| `date_creation` | TIMESTAMPTZ | DEFAULT `now()` |

### 6.12 Entité : Lien Panier-Transaction (PanierTransaction)

| Attribut | Type | Contrainte |
|---|---|---|
| `id_panier` | UUID | FK → Panier |
| `id_transaction` | UUID | FK → Transaction |
| `date_ajout` | TIMESTAMPTZ | DEFAULT `now()` |

**Contrainte** : transaction au statut `ANALYSEE` uniquement.

### 6.13 Entité : Analyse de Dossier (AnalyseDossier)

*Ne contient que les paramètres globaux de l’analyse. Les valeurs de marché de référence par transaction ont été extraites vers une entité dédiée (section 6.14).*

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK → Organisation, NOT NULL |
| `id_dossier` | UUID | FK → Dossier, NOT NULL |
| `id_panier` | UUID | FK → Panier |
| `date_evaluation` | DATE | NOT NULL |
| `taux_croissance` | NUMERIC(5,4) | NOT NULL |
| `id_createur` | UUID | FK → Utilisateur |
| `date_creation` | TIMESTAMPTZ | DEFAULT `now()` |

---

### 6.14 Entité : Paramètres d’analyse par transaction (ParametresAnalyseTransaction)


| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_analyse_dossier` | UUID | FK → AnalyseDossier, NOT NULL |
| `id_transaction` | UUID | FK → Transaction, NOT NULL |
| `taux_boise_ref` | NUMERIC(15,2) | |
| `taux_cultive_ref` | NUMERIC(15,2) | |
| `valeur_batiment_ref` | NUMERIC(15,2) | |
| `valeur_maison_ref` | NUMERIC(15,2) | |
| `valeur_terrain_residentiel_ref` | NUMERIC(15,2) | |
| | | **UNIQUE** (`id_analyse_dossier`, `id_transaction`) |

---

### 6.15 Entité : Résultat d’analyse par transaction (IndicateursAjustes)


| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_analyse_dossier` | UUID | FK → AnalyseDossier, NOT NULL |
| `id_transaction` | UUID | FK → Transaction, NOT NULL |
| `prix_vente_ajuste` | NUMERIC(15,2) | |
| `taux_global_ajuste` | NUMERIC(15,2) | |
| `taux_residuel_cultive_ajuste` | NUMERIC(15,2) | |
| `taux_residuel_boise_ajuste` | NUMERIC(15,2) | |
| `taux_residuel_batiment_ajuste` | NUMERIC(15,2) | |
| `taux_par_entaille_ajuste` | NUMERIC(15,2) | |


### 6.16 Entité : Document (DocumentActe)

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_transaction` | UUID | FK → Transaction, NOT NULL |
| `nom_fichier` | VARCHAR(255) | NOT NULL |
| `chemin_stockage` | VARCHAR(500) | NOT NULL |
| `date_upload` | TIMESTAMPTZ | DEFAULT `now()` |
| `id_uploadeur` | UUID | FK → Utilisateur |

### 6.17 Entité : Journal d’audit (JournalAudit)

| Attribut | Type | Contrainte |
|---|---|---|
| `id` | UUID | PK |
| `id_organisation` | UUID | FK → Organisation, NOT NULL |
| `table_cible` | VARCHAR(100) | NOT NULL |
| `id_enregistrement` | UUID | |
| `id_utilisateur` | UUID | FK → Utilisateur |
| `action` | ENUM | `INSERT`, `UPDATE`, `DELETE`, `LOGIN`, `LOGOUT`, `EXPORT_EXCEL`, `EXPORT_CARTE`, `ACCESS_DENIED` |
| `diff` | JSONB | |
| `adresse_ip` | INET | |
| `date_action` | TIMESTAMPTZ | DEFAULT `now()` |

---

## 7. Spécifications fonctionnelles détaillées par module

### 7.1 Module Import des données de l’acte

#### 7.1.1 Sources et fréquences

- **JLR (CSV)** : import automatique **hebdomadaire** nocturne.
- **Excel EVAGRI** : import manuel (migration + compléments futurs).

#### 7.1.2 Champs alimentés par l’import

Chaque ligne importée crée une **Transaction** et une **ValeurChamp** pour chaque champ de nature `IMPORTE` dont la colonne est présente et non vide dans le fichier. La correspondance colonne → champ est définie par l’attribut `entetes_import` du champ (catalogue §6.5).

Champs importés depuis le **fichier JLR** : n° d’inscription, date de vente, vendeur, acheteur, lots cadastraux, prix de vente, **MRC**, municipalité, adresse, superficie totale, **latitude** et **longitude**.

Champs importés depuis le **fichier EVAGRI** : les mêmes champs (la colonne `MRC` est déjà lue par l’import EVAGRI ; la latitude et la longitude sont lues si les colonnes sont présentes).

#### 7.1.3 Traitement des doublons

Si une transaction possédant les mêmes valeurs de champs importés `(numero_inscription, date_vente)` existe déjà dans l’organisation, la ligne est **silencieusement ignorée**. Cette vérification est effectuée **par le processus d’import avant insertion** (il n’existe pas de contrainte d’unicité en base, les valeurs étant stockées dans **ValeurChamp**) ; elle s’appuie sur les index de ValeurChamp (§6.8).

#### 7.1.4 Déduction géographique

- **MRC** : lue dans le fichier d’import. Si elle est absente, elle est déduite de la municipalité par croisement avec le **Référentiel géographique**.
- **Latitude / longitude** : lues dans le fichier d’import. Si elles sont absentes, elles sont calculées par géocodage à partir des lots cadastraux, à défaut à partir de l’adresse.
- Une valeur déduite ou géocodée est stockée comme valeur du champ importé correspondant.

#### 7.1.5 Suivi

Interface Admin + Dev : statut, lignes, erreurs, relance, template vierge.

### 7.2 Module Migration de la base Excel

#### 7.2.1 Mapping des données et documents

- **Colonnes de l’acte** (n° d’inscription, date, vendeur, acheteur, lots, prix, MRC, municipalité, adresse, superficie totale, latitude, longitude) : importées comme valeurs des **champs de nature `IMPORTE`** du catalogue (§6.5).
- **Autres colonnes** : initialisent des **champs de nature `SAISISSABLE`** et sont importées comme **ValeurChamp** initiales (modifiables ensuite par l’évaluateur). Les types de transaction possibles sont : Terres cultivées, Terres boisées, Érablières, Bâtiments agricoles, Ferme. Pour l'import Evagri, on définit le type en fonction de l'onglet :
Erablières -> type érablière
Bois -> type terre boisée
Terre  -> type terre cultivée
- **Colonnes vides**: les colonnes vides sont ignorées et aucun champ n'est ajouté dans le modèle si la colonne est vide. La latitude/longitude est géocodée (§7.1.4) seulement si elle n'est pas présente dans le fichier d'import.
- **Documents d'acte (PDF)** : lors de la migration initiale, les fichiers PDF d'actes de vente associés aux transactions historiques d'EVAGRI sont importés en masse. Ils se trouvent dans le dossier Base de données\Actes. Le système tente l'association automatique par correspondance `numero_inscription` avec le nom de fichier (selon une convention à définir, ex. : `numero_inscription.pdf`). Les PDF non appariés sont listés dans un rapport pour association manuelle. 

#### 7.2.2 Rapport

Rapport détaillé : traitées, insérées, échecs, incohérences, documents associés, appariements réussis/échoués.

### 7.3 Module Configuration des champs

#### 7.3.1 Interface administrateur

L’administrateur gère les entités **Champ** dans un écran unique, qui liste les champs des trois natures. Chaque champ y est présenté avec le libellé de sa nature : **Importé**, **Saisissable** ou **Calculé**.

Pour chaque champ, l’administrateur définit :
- **Nature** : `IMPORTE`, `SAISISSABLE` ou `CALCULE`. Les champs `IMPORTE` sont créés par le système (catalogue §6.5) : l’administrateur ne peut ni en créer, ni en supprimer, ni changer leur nature, leur code ou leur type. Il crée, modifie et supprime librement les champs `SAISISSABLE` et `CALCULE`.
- **Règle de calcul** : obligatoire si `CALCULE` ; optionnelle si `SAISISSABLE` (pré-remplissage) ; interdite si `IMPORTE`.
- **Est affiché** : case à cocher, `true` par défaut. Détermine si le champ apparaît sur la fiche transaction.
  - Pour un champ `IMPORTE` ou `SAISISSABLE`, masquer le champ le retire de la zone principale.
  - Pour un champ `CALCULE`, masquer le champ le retire de la section latérale des indicateurs.
- **Lecture seule** : case à cocher. Cochée par défaut pour un champ `IMPORTE`, décochée par défaut pour un champ `SAISISSABLE`, toujours cochée (non modifiable) pour un champ `CALCULE`. Un champ en lecture seule est affiché sur la fiche mais ne peut pas être modifié par l’évaluateur.
- **Est obligatoire** : actif uniquement si le champ n’est pas en lecture seule.

#### 7.3.2 Règles de calcul arithmétiques

Expression utilisant :
- Les **codes des champs**, quelle que soit leur nature : importés (ex. : `prix_vente`, `superficie_totale_hectare`), saisissables ou calculés.
- Les opérateurs : **+, -, *, /, (, )**.

Les champs de type `TEXTE_MULTIPLE` (ex. : `lots_cadastraux`) ne sont pas utilisables dans une règle de calcul.

**Exemples de règles valides** :
- `prix_vente / superficie_totale_hectare` — pour un champ calculé « Taux global ».
- `(superficie_cultivee + superficie_boisee) / superficie_totale_hectare * 100` — pour un champ calculé.
- `superficie_drainee / superficie_cultivee` — pour un champ calculé « Terres drainées ».

**Comportement des champs calculés (`CALCULE`)** :
- La règle est évaluée à chaque modification d’un champ impactant (perte de focus).
- La valeur est stockée dans **ValeurChamp**.
- L’évaluateur **ne peut pas modifier** cette valeur directement sur la fiche.

#### 7.3.3 Champs saisissables sans règle de calcul

Si `nature = SAISISSABLE` et `regle_calcul` est NULL, le champ est vierge à l’ouverture (ou porte la valeur initialisée par l’import EVAGRI).

#### 7.3.4 Champs importés rendus modifiables

Si l’administrateur décoche « Lecture seule » sur un champ `IMPORTE`, l’évaluateur peut corriger la valeur importée. Toute modification est tracée dans le journal d’audit (ancienne valeur importée, nouvelle valeur, auteur, date) afin que la valeur d’origine reste consultable (§7.12.2).

### 7.4 Module Configuration des filtres de recherche

#### 7.4.1 Interface administrateur

CRUD des entités **FiltreRecherche**. Un filtre référence un **Champ** de toute nature (importé, saisissable ou calculé). Seuls les filtres virtuels (ex. : statut) n’ont pas de champ associé.

#### 7.4.2 Types de contrôle

| Type de filtre | Opérateurs | Exemple |
|---|---|---|
| `PLAGE_NUMERIQUE` | `+` (plus que), `-` (moins que), `entre`, `=` | `200+`, `200-`, `200-400`, `200` |
| `PLAGE_DATE` | `+` (après), `-` (avant), `entre`, `=` | `20230101+`, `20230101-20231231` |
| `LISTE` | `=` | Sélection d’une valeur |
| `MULTI_SELECT` | `dans` | Sélection multiple |
| `RECHERCHE_TEXTE` | `contient` | Fuzzy search |
| `BOOLEEN` | `est vrai` / `est faux` | Case à cocher |

#### 7.4.3 Logique

Par défaut : **ET**. Groupes **OU** possibles.

### 7.5 Module Fiche transaction détaillée

#### 7.5.1 Structure de la fiche (deux zones)

##### A analyser

La fiche transaction est divisée en **deux zones visuelles distinctes** :

1. **Zone principale (gauche/centre)** : contient les champs de nature **`IMPORTE`** et **`SAISISSABLE`** actifs dont `est_affiche = true`, organisés en sections selon la configuration drag-and-drop de l’administrateur (ex. : une section « Données de l’acte » regroupant prix, vendeur, acheteur, MRC, municipalité, superficie totale…). Les champs en lecture seule y sont affichés sans pouvoir être modifiés.
2. **Zone latérale (droite)** : panneau fixe affichant **uniquement les champs de nature `CALCULE`** (indicateurs de base) dont `est_affiche = true`. Cette zone n’est **pas** réorganisable par drag-and-drop. Son titre est « Indicateurs ».

L’**en-tête** de la fiche affiche en permanence :
- **Numéro d’inscription**
- **Numéro de lot**

**Important** : Les indicateurs ajustés dans le temps ne sont **pas affichés** sur cette fiche.

##### Analysée

Contient la même structure (zone principale et zone latérale), entièrement en lecture seule.

#### 7.5.2 Affichage des valeurs

- **Champ importé** : affiche la valeur issue de l’import. En lecture seule par défaut (modifiable seulement si l’administrateur a décoché « Lecture seule »).
- **Champ saisissable avec règle de calcul** : affiche la valeur pré-calculée. L’évaluateur peut conserver ou modifier.
- **Champ saisissable sans règle** : vierge, valeur initialisée par l’import ou valeur précédemment saisie.
- **Champ en lecture seule** (importé, saisissable configuré en lecture seule, ou calculé) : affiché grisé / en lecture seule visuelle, **non modifiable**.
- **Champ calculé (`CALCULE`)** : affiche la valeur calculée en temps réel.

**Aucun badge de provenance** n’est affiché sur la fiche (la nature n’est visible que dans l’administration des champs).

#### 7.5.3 Ergonomie

- Type de transaction : obligatoire. Plusieurs types/sous-types possibles.
- Tabulation : passe d’un champ **modifiable** au suivant selon l’ordre du drag-and-drop. Ignore les champs en lecture seule et la zone latérale calculée.
- Listes déroulantes : empêchent la saisie de valeurs arbitraires.
- Numériques : décimales selon config.

#### 7.5.4 Recalcul des champs calculés (perte de focus)

Dès qu’un champ modifiable (saisissable, ou importé non en lecture seule) est modifié et quitté (`onBlur`), le système recalcule **tous les champs `CALCULE`** dont la règle dépend de ce champ modifié.

Les champs calculés affichés en zone latérale comprennent (liste non exhaustive, configurable par l’administrateur) :

| Champ calculé (exemple) | Formule de la règle |
|---|---|
| **Taux global ($/ha)** | `prix_vente / superficie_totale_hectare` |
| **Terres drainées (%)** | `superficie_drainee / superficie_cultivee` |
| **Peuplement feuillu (%)** | `superficie_feuillu / superficie_boisee` |
| **Zones humides potentielles (%)** | `zones_humides / superficie_boisee` |
| **Potentiel acéricole (%)** | `superficie_acéricole / superficie_boisee` |
| **Densité d’entaillage** | `nombre_entailles / superficie_acéricole` |

**Précision** : arrondi systématique à l'entier au stockage.

#### 7.5.5 Statut et Contributeur

Chaque fiche possède un statut binaire :
- **Non analysée** : saisie en cours.
- **Analysée** : l’évaluateur a validé son analyse.

**Règles** :
- Bascule à « Analysée » : enregistre l’évaluateur comme **Contributeur** et la date.
- Retour à « Non analysée » : possible, le Contributeur historique est conservé.

#### 7.5.6 Vue consultation après analyse

Affichage lecture seule :
- Champs importés, saisissables et calculés affichés (`est_affiche = true`).
- Positionnement conservé : zone principale (sections drag-and-drop) vs zone latérale.

**Les indicateurs ajustés n’y figurent pas.**

#### 7.5.7 Retour en arrière et réouverture

Une transaction « Analysée » peut être réouverte. Statut → « Non analysée » sans perdre le Contributeur historique.

#### 7.5.8 Documents associés

- Upload unitaire PDF.
- Import masse par convention `numero_inscription_date.pdf`.

#### 7.5.9 Navigation contextuelle

Boutons **Précédent / Suivant**. Ajout au panier → auto passage à la suivante.

### 7.6 Module Recherche, tableau dynamique et cartographie

#### 7.6.1 Formulaire de filtres

Panneau latéral alimenté par **FiltreRecherche**. Les filtres peuvent cibler des champs importés, saisissables ou calculés.

#### 7.6.2 Recherche des reventes

Fonction dédiée permettant de saisir un numéro de lot pour lister l’ensemble des **Transactions** dont le champ importé `lots_cadastraux` contient ce lot.

#### 7.6.3 Tableau de résultats

- 10 lignes/page.
- Tri : sauvegardé **par utilisateur** en base.
- Colonnes masquables : session navigateur.
- Colonnes réordonnables : sauvegardé **par utilisateur** en base.
- Largeur scrollbar supérieure au standard.

#### 7.6.4 Carte interactive OpenStreetMap

Affichage des résultats sous forme de pins, positionnés selon les champs importés `latitude` / `longitude`. Popup : taux/ha, année, superficie, type de bâtiment (si enrichi), prix de vente, types/sous-types. Clustering automatique si concentration de points. Il est possible de sélectionner plusieurs pins en traçant un polygone, quand le polygone sera tracé, on pourra ajouter les transactions circonscrits dans le polygone  dans un des paniers du dossier en cours

### 7.7 Module Dossiers et Paniers de comparables

#### 7.7.1 Structure hiérarchique

- **Dossier** : niveau supérieur, correspondant à un numéro de dossier.
- **Panier** : niveau intermédiaire, correspondant à une catégorie d’analyse au sein du dossier. Un dossier contient un ou plusieurs paniers. Un panier ne contient que des transactions analysées.
- **Transaction** : une transaction peut être présente dans plusieurs Paniers.

#### 7.7.2 Gestion des Dossiers

L’évaluateur peut :
- Créer un Dossier (numéro obligatoire `AA-RR-DDD`, regex stricte).
- Consulter la liste de tous les dossiers.
- Accéder à un dossier pour voir les paniers qu’il contient.

#### 7.7.3 Gestion des Paniers

Au sein d’un Dossier, l’évaluateur peut :
- Créer un Panier (nom + type optionnel).
- Ajouter une transaction. Seules les transactions au statut **ANALYSEE** sont éligibles.
- Retirer une transaction.
- Consulter la vue synthétique du Panier sous forme de tableau triable.

**Personnalisation de la vue Panier** :
- Choix des colonnes affichées : **sauvegardé par panier** (champs saisissables + calculés sélectionnables).
- Tri des colonnes : **sauvegardé par panier**.
- Colonnes masquées : **sauvegardé par panier**.
- Pas de réordonnancement manuel par glisser-déposer. L’ordre est piloté par le tri.
- Largeur scrollbar supérieure au standard.

**Partage** : un évaluateur peut créer/modifier un panier dans un dossier qu’il n’a pas créé.

#### 7.7.4 Architecture évolutive

La structure Dossier/Panier est conçue pour permettre, en Phase 2, l’association formelle d’un Dossier à un mandat client.

### 7.8 Module Calculs automatiques et contrôles de qualité

#### 7.8.1 Indicateurs de base = Champs calculés

Les indicateurs de base ne sont pas des entités séparées. Ils sont des **champs** de nature `CALCULE` configurés par l’administrateur. Le système les recalcule à chaque modification d’un champ impactant (perte de focus) et stocke le résultat dans **ValeurChamp**.

Le catalogue initial proposé à l’administrateur (coché par défaut, modifiable) :

| Type / Sous-type | Champ calculé | Règle de calcul |
|---|---|---|
| **Tous** | Taux global ($/ha) | `prix_vente / superficie_totale_hectare` |
| **Cultivée** | Taux résiduel cultivé ($/ha) | `(prix_vente – superficie_boisee * taux_boise_ref – valeur_batiments – valeur_maison – valeur_terrain_residentiel) / superficie_cultivee` |
| **Boisée** | Taux résiduel boisée ($/ha) | `(prix_vente – superficie_cultivee * taux_cultive_ref – valeur_batiments – valeur_maison – valeur_terrain_residentiel) / superficie_boisee` |
| **Bâtiment** | Taux résiduel bâtiment ($/pi²) | `(prix_vente – superficie_cultivee * taux_cultive_ref – superficie_boisee * taux_boise_ref – valeur_maison – valeur_terrain_residentiel) / superficie_batiment` |
| **Cultivée** | Terres drainées (%) | `superficie_drainee / superficie_cultivee` |
| **Boisée** | Peuplement feuillu (%) | `superficie_feuillu / superficie_boisee` |
| **Boisée** | Zones humides potentielles (%) | `zones_humides / superficie_boisee` |
| **Érablière** | Densité d’entaillage | `nombre_entailles / superficie_acéricole` |
| **Érablière** | Taux par entaille ($/entaille) | `(prix_vente – superficie_cultivee * taux_cultive_ref – valeur_batiments – valeur_maison – valeur_terrain_residentiel) / nombre_entailles` |

**Précision** : arrondi systématique à l'entier.

**Déclenchement** : recalc à la perte de focus (`onBlur`) sur un champ saisissable modifié.

#### 7.8.2 Indicateurs ajustés dans le temps

Les indicateurs ajustés ne sont pas des champs enrichis. Ils dépendent d’un **instant T** et de valeurs de marché de référence propres au Dossier.

L’évaluateur crée une **Analyse de Dossier** en renseignant :
- Date d’évaluation
- Taux de croissance (%)
- Taux boisé de référence ($/ha)
- Taux cultivé de référence ($/ha)
- Valeur bâtiment de référence ($)
- Valeur maison de référence ($)
- Valeur terrain résidentiel de référence ($)

Le système calcule et stocke alors les indicateurs ajustés suivants pour chaque transaction du Panier :

| Indicateur ajusté | Formule |
|---|---|
| **Prix de vente ajusté** | `prix_vente × (1 + taux_croissance) ^ ((date_evaluation – date_vente) / 365)` |
| **Taux global ajusté ($/ha)** | `prix_vente_ajuste / superficie_totale_hectare` |
| **Taux résiduel cultivé ajusté ($/ha)** | `(prix_ajuste – superficie_boisee * taux_boise_ref – …) / superficie_cultivee` |
| **Taux résiduel boisée ajustée ($/ha)** | `(prix_ajuste – superficie_cultivee * taux_cultive_ref – …) / superficie_boisee` |
| **Taux résiduel bâtiment ajusté ($/pi²)** | `(prix_ajuste – …) / superficie_batiment` |
| **Taux par entaille ajusté ($/entaille)** | `(prix_ajuste – …) / nombre_entailles` |

**Indicateurs NON ajustés** (car sans unité de prix dans le taux) : Terres drainées (%), Peuplement feuillu (%), Zones humides (%), Densité d’entaillage.

#### 7.8.3 Règles de validation bloquantes

Le système interdit la sauvegarde d’un champ ou de la fiche si l’une des règles suivantes est violée :

| Code | Règle | Portée |
|---|---|---|
| **V-001** | Superficie cultivée + superficie boisée + superficie constructible ≤ superficie totale. | Saisie fiche (champs modifiables) |
| **V-002** | Superficie drainée ≤ superficie cultivée. | Saisie fiche (champs modifiables) |
| **V-003** | Les champs exprimés en pourcentage ne peuvent excéder 100 %. | Saisie fiche (champs modifiables) |
| **V-004** | La date de vente ne peut être postérieure à la date du jour. | Import / Saisie |
| **V-005** | Superficie acéricole ≤ superficie boisée. | Saisie fiche (champs modifiables) |
| **V-006** | Les valeurs numériques ne peuvent être négatives (sauf la longitude). | Import / Saisie numérique |
| **V-007** | La valeur saisie doit être comprise dans la plage configurée (min / max) si une plage est définie pour le champ. | Saisie fiche (champs modifiables) |

**Warning non bloquant** : superficie totale très différente de la somme des composantes (superficie cultivée + boisée + constructible), c’est-à-dire un écart supérieur à 10 % de la superficie totale. L’évaluateur peut forcer la sauvegarde.

### 7.9 Module Export Excel pour rapports

#### 7.9.1 Paramètres

L’évaluateur définit obligatoirement :
- Le **taux de croissance** (%, ex. : 5 %).
- La **date d’évaluation** (date du rapport).

Le système calcule alors le **prix actualisé** pour chaque transaction du Panier :

    Prix actualisé = Prix de vente × (1 + Taux de croissance) ^ ((Date d’évaluation – Date de vente) / 365)

#### 7.9.2 Contenu de l’export

L’export produit un fichier au format Excel respectant la mise en page du modèle de rapport EVAGRI. L’évaluateur choisit préalablement les colonnes à inclure parmi :
- Les champs importés (données de l’acte).
- Les champs saisissables.
- Les champs calculés (indicateurs de base).
- Les indicateurs ajustés dans le temps (issus d’une Analyse de Dossier sélectionnée).

#### 7.9.3 Taux résiduel dans l’export

Le taux résiduel est calculé spécifiquement dans le contexte de l’export car il dépend de valeurs externes à la transaction (taux de marché du moment, valeur des constructions). L’évaluateur dispose d’une section « Paramètres d’analyse » dans l’interface d’export pour renseigner ces valeurs de référence avant génération.

### 7.10 Module Export carte statique PNG

L’export produit une image statique (PNG) de la carte du Québec avec les pins du Panier. Seul le **numéro de vente** est affiché à l’intérieur du pin.

### 7.11 Module Administration

#### 7.11.1 Gestion des utilisateurs

L’administrateur est le seul habilité à créer des comptes (invitation manuelle) :
- Nom, courriel, rôle (Administrateur, Évaluateur, Développeur).
- Choix de l’organisation.
- Mot de passe temporaire transmis au nouvel utilisateur, avec changement obligatoire à la première connexion.
- Un utilisateur peut être supprimé. Ses données appartiennent toujours à l’organisation.

#### 7.11.2 Gestion des champs

Interface unique listant tous les champs, chacun accompagné du libellé de sa nature (**Importé**, **Saisissable**, **Calculé**) :
- Les champs **importés** apparaissent avec le libellé « Importé ». Ils ne peuvent être ni créés ni supprimés ; l’administrateur configure leur libellé, leur affichage (coché par défaut), leur lecture seule (cochée par défaut) et leur section.
- Les champs **saisissables** (nature, type, plage, règle optionnelle, obligation, lecture seule, drag-and-drop activé implicitement).
- Les champs **calculés** (nature, type, règle obligatoire, affichage par défaut coché, toujours en lecture seule).
- L'administrateur peut glisser-déposer les champs importés et saisissables pour :
  - Réordonner les champs à l’intérieur d’une section.
  - Créer, renommer, réordonner des **sections** (ex. : « Superficies », « Bâtiments », « Acéricole »).
  - Déplacer un champ d’une section à une autre.
  - Les champs **calculés** (`CALCULE`) sont **absents** de ce mécanisme. Ils restent figés dans la zone latérale droite.

#### 7.11.3 Gestion des filtres de recherche

Activation / désactivation de chaque champ (importé, saisissable ou calculé) comme critère de recherche.

#### 7.11.4 Suivi des imports

Interface réservée à l’Administrateur et au Développeur :
- Historique des traitements (statut, nombre de lignes, erreurs).
- Détail des erreurs.
- Bouton de relance manuelle.
- Téléchargement du template Excel vierge.
- Erreurs possibles : problème de connexion, pas de fichier déposé par JLR, format modifié.

### 7.12 Module Conformité, traçabilité et sécurité

#### 7.12.1 Localisation des données

Conformément à la Loi 25, les données personnelles et professionnelles sont hébergées sur le territoire canadien. Le système ne fait pas transiter les données d’identification ni les transactions vers des infrastructures situées en dehors du Canada sans accord explicite et analyse d’impact préalable.

#### 7.12.2 Provenance et intégrité des données importées

Chaque valeur est rattachée à un champ dont la **nature** (`IMPORTE`, `SAISISSABLE`, `CALCULE`) identifie sa provenance. Les valeurs des champs importés sont en lecture seule par défaut ; si l’administrateur rend un champ importé modifiable, toute correction est tracée dans le journal d’audit (§7.12.3) de sorte que la valeur importée d’origine reste conservée et auditable.

#### 7.12.3 Traçabilité des modifications

Le système conserve un registre horodaté des modifications importantes :
- Identité de l’utilisateur.
- Date et heure.
- Objet modifié (transaction, champ, utilisateur).
- Ancienne valeur et nouvelle valeur.
- Action réalisée (création, modification, suppression, export, connexion, échec de connexion).
- Adresse de connexion (adresse IP) si techniquement disponible.

Ce registre est consultable par l’Administrateur. L’Évaluateur peut consulter l’historique de ses propres modifications.

#### 7.12.4 Consentement

Chaque utilisateur accepte la politique de confidentialité de l’organisation lors de sa première connexion. La date d’acceptation est enregistrée.

#### 7.12.5 Anonymisation

L’Administrateur peut désactiver un compte utilisateur. Sur demande, il peut anonymiser les données d’identification d’un ancien utilisateur tout en conservant l’historique des actions réalisées dans le système pour les besoins d’audit.

---

## 8. Exigences non fonctionnelles (SMART)

| Exigence | Objectif chiffré | Moyen de mesure |
|---|---|---|
| Temps de chargement initial | Écran de connexion et tableau de bord visibles en moins de 2 secondes. | Test de performance depuis un navigateur standard. |
| Temps de réponse recherche | Résultats affichés en moins de 1 seconde pour une base de plusieurs milliers de transactions. | Scénario de recherche multicritères. |
| Temps de réponse saisie | Recalcul des indicateurs et validation affichés en moins de 500 ms après modification d’un champ. | Test en saisie réelle sur fiche transaction. |
| Génération export Excel | Fichier Excel généré en moins de 3 secondes pour un panier de 50 transactions. | Test de charge. |
| Génération export carte | Image PNG générée en moins de 5 secondes. | Test de charge. |
| Disponibilité import hebdo | L’import nocturne doit se terminer avec un statut déterminé dans les 4 heures, 99,5 % du temps. | Suivi mensuel des logs d’import. |
| Capacité évolutive | L’application doit supporter plusieurs dizaines de milliers de transactions sans dégradation fonctionnelle visible. | Test de charge sur base extrapolée. |
| Précision des calculs | Arrondi systématique à 2 décimales pour tous les indicateurs monétaires et unitaires. | Vérification formelle des formules. |
| Rétention des archives | Fichiers sources conservés sans maximum. Sauvegardes de la base conservées 30 jours minimum. | Politique de rétention documentée. |

## 9 . Priorités de livraison

| Livrable | Contenu | Date de livraison |
|---|---|---|
| **Version alpha** | import evagri,<br>bd des transactions : vue dynamique et vue carte,<br>écran administrateur filtre, ecran administratif des imports | 17 juillet 2026 |
| **Version beta** | Fiches transaction détaillé,<br>écran administrateur champs à enrichir,<br>Panier de dossiers comparables,<br>export Excel et export carte | fin octobre 2026 |
| **Version gamma** | authentification et rôles,<br>écran administrateur gestion des utilisateurs | mi novembre 2026 |
| **Version RC** | import JLR (incluant MRC, latitude et longitude) | fin novembre 2026 |

Phase de test intense la semaine du 19 au 23 décembre (import la fds, test en condition reelle de Simon et correction eventuelle des bugs)