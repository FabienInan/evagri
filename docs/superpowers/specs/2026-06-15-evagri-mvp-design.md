# EVAGRI — Spécification de design (MVP Phase 1)

> **Date :** 2026-06-15
> **Projet :** Plateforme de gestion des transactions comparables agricoles (EVAGRI)
> **Périmètre :** MVP Phase 1, découpé en 3 vagues

---

## 1. Contexte et objectifs

EVAGRI est une PME québécoise d’évaluation de biens agricoles. Le processus actuel repose sur un fichier Excel partagé alimenté manuellement à partir de données JLR, d’analyses terrain et d’un fichier historique interne (~1 600 transactions).

**Objectif du MVP :** remplacer ce fichier Excel par une application web centralisée, multi-utilisateurs et traçable, permettant :

- l’import et la consultation des transactions historiques et futures ;
- la configuration métier des champs d’analyse ;
- la saisie d’enrichissements avec calculs automatiques ;
- la constitution de dossiers et paniers de comparables ;
- l’export de rapports Excel et cartes PNG.

---

## 2. Décisions architecturales validées

| Sujet | Décision | Justification |
|---|---|---|
| **Stack** | Next.js 15 (App Router, TypeScript), Prisma ORM, PostgreSQL, Redis, BullMQ | Un seul langage, déploiement unifié, performances et maintenabilité pour une app CRUD métier dense. |
| **UI / CSS** | Tailwind CSS + shadcn/ui + typographie Montserrat | Reproduction rapide des maquettes existantes et respect de la charte graphique. |
| **Carte** | OpenStreetMap via Leaflet ou React-Map-GL | Tuiles libres, pas de dépendance commerciale, conforme au cahier. |
| **Auth** | Auth.js (NextAuth v5) avec credentials + JWT | Adapté au modèle d’invitation par administrateur et au setup initial. |
| **Hébergement** | Coolify auto-hébergé sur VPS OVHcloud Canada (Beauharnois) | Interface web de maintenance pour un technicien non-développeur, conformité Loi 25 (données au Québec), budget ~25–30 CAD/mois. |
| **Backups** | `pg_dump` automatisé via conteneur Docker, stocké sur Object Storage OVHcloud Canada + rétention paramétrable | Simple pour le technicien, résilient, conforme rétention minimale 30 jours. |
| **Fichiers** | Object Storage S3-compatible OVHcloud Canada pour PDF d’actes et exports générés | Stockage canadien, extensible, séparé de l’application. |

---

## 3. Découpage en vagues

### Vague 1 — Fondations + Données + Exploration

Livrable : l’équipe peut consulter et explorer toutes les transactions sur une carte et dans un tableau.

- Setup technique (Docker, PostgreSQL, Next.js, Prisma, auth, déploiement Coolify).
- Import initial de la base Excel historique (~1 600 transactions).
- Tableau dynamique des transactions avec filtres configurables.
- Carte interactive OSM avec pins et clustering.

### Vague 2 — Fiche transaction + Configuration champs

Livrable : l’évaluateur peut analyser une transaction et faire calculer les indicateurs de base.

- Configuration admin des champs enrichissables (saisissables et calculés) avec règles arithmétiques.
- Fiche transaction en deux zones : champs saisissables + indicateurs calculés latéraux.
- Recalcul automatique des champs calculés à la perte de focus.
- Statut Analysée / Non analysée + Contributeur.
- Upload et association des PDF d’actes.

### Vague 3 — Dossiers, Analyses, Exports et Administration avancée

Livrable : production de rapports de comparables complets.

- Dossiers et Paniers (création, partage, ajout de transactions analysées).
- Analyse de Dossier avec paramètres de marché et indicateurs ajustés dans le temps.
- Export Excel calé sur le modèle EVAGRI.
- Export carte PNG statique.
- Administration : utilisateurs, filtres de recherche, suivi des imports JLR, journal d’audit.

---

## 4. Modèle de données (entités clés)

Le modèle reprend les entités du cahier des charges, avec ajustements pour le MVP.

### Entités fondamentales

| Entité | Rôle |
|---|---|
| `Organisation` | Multi-location ; EVAGRI sera la première organisation créée via l’écran de setup. |
| `Utilisateur` | Comptes avec rôles `ADMIN`, `EVALUATEUR`, `DEVELOPPEUR`. |
| `TransactionSource` | Données brutes immuables issues de l’Excel historique ou du CSV JLR. |
| `Typologie` | Types de transaction : Terres cultivées, Terres boisées, Érablières, Bâtiments agricoles, Ferme. |
| `ChampEnrichissable` | Champs configurables par l’admin : saisissables ou calculés, avec règles arithmétiques. |
| `TransactionEnrichie` | État d’analyse d’une transaction (statut, contributeur). |
| `ValeurEnrichissement` | Valeurs saisies ou calculées pour chaque champ enrichissable. |
| `VueFicheEvaluation` | Layout drag-and-drop de la fiche transaction (sections et ordre des champs saisissables). |
| `FiltreRecherche` | Filtres configurables affichés dans le panneau de recherche. |
| `Dossier` | Regroupement métier (mission/client). |
| `Panier` | Sous-ensemble d’un dossier, lié à un type de transaction. |
| `PanierTransaction` | Association entre panier et transaction analysée. |
| `AnalyseDossier` | Paramètres d’instant T pour les indicateurs ajustés. |
| `ParametresAnalyseTransaction` | Valeurs de marché de référence par transaction dans une analyse. |
| `IndicateursAjustes` | Résultats de calcul ajustés dans le temps. |
| `DocumentActe` | PDF d’acte associé à une transaction source. |
| `JournalAudit` | Traçabilité des actions importantes. |
| `Importation` | Traçabilité des imports de fichiers (JLR, Excel). |

### Contraintes métier clés

- `TransactionSource` est immuable après insertion.
- Unicité organisation + `numero_inscription` + `date_vente`.
- Une transaction est liée à une seule `TransactionEnrichie`.
- Seules les transactions au statut `ANALYSEE` peuvent entrer dans un panier.
- Les champs `CALCULE` ne sont pas modifiables par l’utilisateur ; leur valeur est recalculée à la perte de focus d’un champ saisissable impactant.

---

## 5. Modules fonctionnels

### 5.1 Authentification et setup initial

- Écran de setup unique accessible au premier démarrage : création de l’Organisation + du premier administrateur.
- Connexion par email/mot de passe.
- Invitation d’utilisateurs par l’administrateur avec mot de passe temporaire et changement obligatoire à la première connexion.
- Consentement politique de confidentialité enregistré.
- Déconnexion.

### 5.2 Import des données

#### Import Excel historique (Vague 1)

- Upload d’un fichier `.xlsx` via interface admin.
- Sélection des feuilles à importer (`Terre`, `Bois`, `Ventes erablière`).
- Mapping automatique proposé :
  - `Terre` → Typologie « Terres cultivées »
  - `Bois` → Typologie « Terres boisées »
  - `Ventes erablière` → Typologie « Érablières »
- Colonnes sources → `TransactionSource`.
- Colonnes enrichies → création automatique de `ChampEnrichissable` (saisissables par défaut) et insertion des valeurs dans `ValeurEnrichissement`.
- Règles de calcul typiques pré-chargées pour les indicateurs courants (Taux global, etc.).
- Rapport d’import : lignes traitées, insérées, ignorées (doublons), erreurs.
- Traçabilité dans la table `Importation` et le `JournalAudit`.

#### Connecteur JLR (Vague 3)

- Abstraction d’un connecteur d’import CSV.
- Fréquence hebdomadaire nocturne planifiée via BullMQ.
- Canal configurable (dépôt manuel, SFTP, API, email) dès que le prestataire fournira les accès.
- Dédoublonnage par `(numero_inscription, date_vente)`.

### 5.3 Configuration des champs enrichissables (Vague 2)

- Interface admin unique pour créer/éditer/supprimer des champs.
- Attributs : code machine, nom d’affichage, type de données, nature (SAISISSABLE / CALCULE), unité, plage, options de liste, règle de calcul, types applicables, ordre, affichage, obligatoire.
- Règles arithmétiques : opérateurs `+ - * / ( )`, codes des champs sources et codes des autres champs enrichissables.
- Catalogue par défaut pré-chargé lors de l’import initial, modifiable ensuite.
- Drag-and-drop admin pour organiser les champs saisissables en sections dans la fiche transaction.

### 5.4 Fiche transaction (Vague 2)

- En-tête fixe : numéro d’inscription, numéro de lot, type de transaction, statut, contributeur, dates.
- Zone principale : champs saisissables organisés selon `VueFicheEvaluation`.
- Zone latérale droite : champs calculés affichés (indicateurs de base).
- Recalcul automatique des champs calculés à la perte de focus d’un champ saisissable modifié.
- Validation bloquante et warnings.
- Boutons Précédent / Suivant, Ajouter au panier, Enregistrer, Valider l’analyse.
- Section Documents pour upload/association PDF.

### 5.5 Recherche et tableau dynamique (Vague 1)

- Panneau latéral de filtres alimenté par `FiltreRecherche`.
- Filtres sur données sources et champs enrichis (logique ET par défaut, groupes OU possibles).
- Types de filtres : plage numérique, plage date, liste, multi-select, recherche texte fuzzy, booléen.
- Tableau : tri, pagination 10 lignes par défaut, colonnes masquables, largeur scrollbar renforcée.
- Recherche de reventes par numéro de lot.

### 5.6 Carte interactive (Vague 1)

- Carte OpenStreetMap du Québec.
- Pins des transactions issues des résultats de recherche.
- Clustering automatique.
- Popup : taux/ha, année, superficie, type, prix de vente.
- Filtre géographique optionnel.

### 5.7 Dossiers et Paniers (Vague 3)

- Création de Dossier avec numéro formel `AA-RR-DDD`.
- Création de Panier dans un Dossier (nom + type optionnel).
- Ajout/retrait de transactions analysées.
- Vue synthétique du Panier sous forme de tableau triable.
- Personnalisation de la vue sauvegardée par panier.

### 5.8 Analyse de Dossier et indicateurs ajustés (Vague 3)

- Création d’une Analyse de Dossier : date d’évaluation, taux de croissance, valeurs de marché de référence.
- Saisie des valeurs de marché par transaction (optionnel, avec valeurs par défaut de l’analyse).
- Calcul des indicateurs ajustés dans le temps (prix actualisé, taux global ajusté, taux résiduels, etc.).
- Stockage séparé dans `IndicateursAjustes`.

### 5.9 Exports (Vague 3)

- Export Excel d’un Panier : colonnes sélectionnables (sources, saisissables, calculés, ajustés), mise en page calée sur le modèle EVAGRI.
- Export carte PNG statique : carte du Québec avec les pins du Panier et numéro de vente dans chaque pin.

### 5.10 Administration avancée (Vague 3)

- Gestion des utilisateurs (CRUD, invitation, désactivation, anonymisation).
- Configuration des filtres de recherche.
- Suivi des imports JLR (historique, erreurs, relance).
- Journal d’audit consultable.

---

## 6. Interface utilisateur — Écrans principaux

| Écran | Rôles | Vague |
|---|---|---|
| Setup initial | Aucun (premier démarrage) | 1 |
| Connexion | Tous | 1 |
| Tableau de bord / Liste des transactions | Tous | 1 |
| Carte interactive | Tous | 1 |
| Fiche transaction (saisie) | Évaluateur, Admin | 2 |
| Fiche transaction (consultation sources) | Évaluateur, Admin | 2 |
| Admin — Champs enrichissables | Admin | 2 |
| Admin — Layout fiche transaction | Admin | 2 |
| Dossiers et Paniers | Évaluateur, Admin | 3 |
| Analyse de Dossier | Évaluateur, Admin | 3 |
| Export Excel / Carte | Évaluateur, Admin | 3 |
| Admin — Utilisateurs | Admin | 3 |
| Admin — Filtres de recherche | Admin | 3 |
| Admin — Suivi des imports | Admin, Développeur | 3 |
| Journal d’audit | Admin | 3 |

---

## 7. Sécurité et conformité

### Loi 25 et localisation

- Données hébergées exclusivement au Canada (OVHcloud Beauharnois + Object Storage Canada).
- Pas de transit vers des infrastructures hors Canada sans accord explicite et analyse d’impact.
- Consentement de la politique de confidentialité enregistré par utilisateur.

### Sécurité applicative

- Mots de passe hachés avec bcrypt/argon2.
- Authentification par JWT côté serveur, cookies httpOnly, secure.
- CSRF protégé par les Server Actions Next.js.
- Validation systématique des entrées côté serveur (Zod).
- Séparation stricte des données par `id_organisation` dans chaque requête.
- Rôles et permissions appliqués côté API.

### Traçabilité

- `JournalAudit` enregistre : création, modification, suppression, export, connexion/déconnexion, échecs, accès refusés.
- Diff JSON pour les modifications importantes.
- Adresse IP si techniquement disponible.

---

## 8. Performance et non-fonctionnel

| Exigence | Cible | Moyen |
|---|---|---|
| Chargement initial | < 2 s | SSR Next.js, images optimisées, bundle raisonnable. |
| Recherche multicritères | < 1 s | Index PostgreSQL sur champs filtrés, pagination côté serveur. |
| Recalcul indicateurs | < 500 ms | Calcul côté serveur, cache des dépendances, pas de recalc global inutile. |
| Export Excel 50 transactions | < 3 s | Génération asynchrone BullMQ si nécessaire. |
| Export carte PNG | < 5 s | Rendu côté serveur via Sharp/node-canvas. |
| Import hebdo JLR | Statut déterminé en < 4 h, 99,5 % | BullMQ + retry + alerting. |
| Évolutivité | Dizaines de milliers de transactions | PostgreSQL indexé, pagination, pas de chargement full dataset. |
| Précision | 2 décimales monétaires, entiers pour indicateurs unitaires | Arrondis explicites côté serveur. |

---

## 9. Risques et points en suspens

| Risque | Impact | Mitigation |
|---|---|---|
| Qualité des données Excel historiques | Import incomplet ou erroné | Rapport d’import détaillé, mapping flexible, corrections possibles en admin. |
| Connecteur JLR non défini | Blocage import automatique | Abstraction générique ; démarrage avec import manuel. |
| PDF d’actes non reçus | Migration documentaire incomplète | Prévoir association manuelle post-import dès réception. |
| Formules de calcul complexes | Erreurs de recalcul | Tests unitaires sur le moteur d’expressions, validation des dépendances. |
| Multi-organisation future | Refactor coûteux si mal isolé | `id_organisation` dans toutes les requêtes dès le départ. |

---

## 10. Questions en attente (à relancer plus tard)

- **Documents PDF d’actes** : emplacement et convention de nommage à confirmer.
- **Connecteur JLR** : canal technique (SFTP, API, email, dépôt manuel) et accès à confirmer.

---

## 11. Approbation

Cette spécification de design est prête à être transformée en plan d’implémentation détaillé pour la **Vague 1**.
