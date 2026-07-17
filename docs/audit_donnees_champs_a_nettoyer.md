# Audit des données — Colonnes et champs à nettoyer

**Date :** 2026-07-12
**Base analysée :** `evagri` (PostgreSQL)
**Objet :** Identifier les champs dont les valeurs nécessitent un nettoyage, une normalisation ou une refonte du type de données, afin d'améliorer la qualité des filtres et des analyses.

---

## Méthodologie

L'audit porte sur les tables `champ_enrichissable` et `valeur_enrichissement`. Pour chaque champ enrichi ayant au moins une valeur renseignée, nous avons mesuré :

- le nombre de valeurs renseignées (`values_count`)
- le nombre de valeurs distinctes (`distinct_count`)
- le taux de valeurs uniques (`uniqueness_pct`)
- la longueur moyenne des valeurs (`avg_length`)
- la présence de combinaisons (`,`, `/`, `;`, `&`, `et`)
- la cohérence de la casse et des accents

Un champ est signalé comme "à nettoyer" lorsqu'il présente au moins un des problèmes suivants :

1. Valeurs uniques très majoritaires → le champ est quasiment du texte libre et ne peut pas servir de liste de filtres.
2. Variantes de casse / accents / orthographe pour la même valeur sémantique.
3. Combinaisons de valeurs dans une même cellule (ex. `"Maïs / Soya / Foin"`).
4. Mélange de formats (ex. décimales et plages texte dans un même champ).
5. Valeurs parasites qui ne correspondent pas au sens métier du champ.
6. Doublons de champs portant des noms ou codes machine quasi identiques.
7. Type de données incohérent avec le contenu réel.
8. Transactions sans identifiant principal : une transaction devrait idéalement posséder un numéro d'inscription ou, à défaut, un numéro SIA. L'absence des deux rend la déduplication et l'audit impossible.

---

## Résumé exécutif

- **60 champs** au total dans `champ_enrichissable`.
- **43 champs texte**, dont **18 n'ont jamais été renseignés**.
- **7 champs texte** présentent des problèmes de normalisation significatifs.
- **3 champs numériques** ont une cardinalité très faible et pourraient être convertis en listes.
- **3 champs numériques** semblent être des doublons ou des anciennes versions.
- **1 champ liste** (`typeTransaction`) est propre et bien normalisé.
- **5 transactions** (0,3 %) n'ont pas de numéro d'inscription mais possèdent un SIA ; elles sont conservées mais fragilisent la fiabilité des doublons et de l'identification.
- **172 transactions** (10,1 %) sont en statut `"A_ANALYSER"` et toutes manquent de municipalité, ce qui empêche leur géocodage et leur affichage sur la carte.

---

## 1. Champs texte avec problèmes de normalisation

### 1.1 `topographie` — Topographie

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 1 146 |
| Valeurs distinctes | 47 |
| Taux d'unicité | 4,1 % |
| Longueur moyenne | 8,8 caractères |

**Problèmes constatés :**

- Variantes de casse : `"Plane"` (274), `"plane"` (241), `"déclivité"` (125), `"Déclivité"` (48), `"Pente"` (34), `"pente"` (26).
- Fautes d'orthographe et accents inconsistants : `"Déclvité"`, `"decivite"`, `"legere declivite"`, `"Legere pente"`.
- Combinaisons : `"Plane, déclivité dans le boisé"`, `"Pente (2/3), plane (1/3)"`, `"plane et déclivité"`.
- Espaces en début/fin : `" Déclivité"`, `" Plane"`.

**Impact :** Ce champ devrait idéalement être une liste fermée (`plane` / `déclivité` / `pente` / `forte pente`), mais le manque de normalisation empêche un filtre par liste efficace.

**Recommandation :**

1. Normaliser la casse et les accents.
2. Fusionner les variantes proches (`"plane"` + `"Plane"` → `"Plane"`).
3. Séparer les combinaisons en plusieurs champs booléens ou en un champ liste multi-sélection. Voici les différents choix possibles: Plane, Légère déclivité, Déclivité modérée, Forte déclivité

---

### 1.2 `feuillusrsineux` — Feuillus/Résineux

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 627 |
| Valeurs distinctes | 22 |
| Taux d'unicité | 3,5 % |
| Longueur moyenne | 7,9 caractères |

**Problèmes constatés :**

- Variantes de casse : `"Feuillus"` (304), `"feuillus"` (78), `"Résineux"` (53), `"résineux"` (33), `"Mixte"` (45), `"mixte"` (23).
- Abréviations non normalisées : `"F"` (14), `"R"` (3), `"M"` (1), `"MR"` (2), `"MF"` (2), `"Resineux"` (43) sans accent.
- Valeurs composées : `"Mixte (dominance feuillus)"`, `"Mixte (dominance résineux)"`, `"Mixte feuillus"`.
- Espaces parasites : `" Résineux"`, `"Feuillus"` (avec espaces en début/fin).

**Impact :** Le champ devrait contenir 3 à 5 valeurs maximum (`Feuillus` / `Résineux` / `Mixte`). Actuellement, le filtre par liste afficherait 22 options confusantes.
Ce champ est lié aux champs % de Feuillus et % de Résineux
Règle que je suggère
- Taux de Feuillus 0-40% alors
Résineux
- Taux de Feuillus 40-60% alors
Mixte
- Taux de Feuillus 60-100% alors
Feuillus

**Recommandation :**

1. Appliquer une règle de normalisation stricte : ignorer la casse, supprimer les espaces, corriger les accents.
2. Créer un mapping des abréviations (`F → Feuillus`, `R → Résineux`, `M/MF/MR → Mixte`).
3. Regrouper `"Mixte (dominance feuillus)"` et `"Mixte (dominance résineux)"` sous `"Mixte"`.

---

### 1.3 `zone_agricole_cptaq` — Zone agricole (CPTAQ)

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 1 177 |
| Valeurs distinctes | 37 |
| Taux d'unicité | 3,1 % |
| Longueur moyenne | 3,6 caractères |

**Problèmes constatés :**

- Concept du champ pollué : ce champ est censé indiquer si la terre est en zone agricole (`oui` / `non` / `partiel`), mais il contient des numéros d'autorisation CPTAQ complets.
- Exemples de valeurs parasites :
  - `038376 Résultat Autorisation Détail Utilisation/non/agricole/seule`
  - `148330 : autorisation, Article 16 LATANR. Autorisation d'acquisition par un non résident (France)`
  - `323189 Autorisation_Aliénation / lotissement,Morcellement de ferme`
  - `444408 ; En traitement ; Coupe d'érables`
- Variantes de casse pour les réponses simples : `"oui"` (672), `"Oui"` (171), `"OUI"` (2), `"non"` (240), `"Non"` (6), `"non"` avec espaces.
- Valeurs intermédiaires mal formatées : `"Oui (partie)"`, `"partiel"`, `"Partiel"`, `"Majeure partie"`, `"En partie"`, `"en partie"`, `"un tiers"`, `"0.5"`.
- Valeur technique erronée : `"0"` (6 occurrences) qui devrait être `"non"`.

**Impact :** Ce champ est inutilisable en l'état comme filtre booléen ou liste. Les numéros d'autorisation devraient être dans un champ séparé.

**Recommandation :**

1. Extraire les numéros d'autorisation dans un nouveau champ dédié (`numero_autorisation_cptaq`). Oui. Nouveau champ enrichissable plutot: 'Autorisation CPTAQ'
2. Convertir les réponses en type booléen ou liste fermée : `Oui` / `Non` / `Partiel`.
3. Normaliser la casse et supprimer les variantes.

---

### 1.4 `sousclasse_dominante` — Sous-classe dominante

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 502 |
| Valeurs distinctes | 57 |
| Taux d'unicité | 11,4 % |
| Longueur moyenne | 1,5 caractère |

**Problèmes constatés :**

- Codes mélangés sans signification claire : `W`, `F`, `FW`, `FM`, `FT`, `T`, `PT`, `P`, `X`, `DW`, `WF`, `PW`...
- Casse inconsistante : `"W"` (159), `"w"` (11), `"F"` (58), `"p"` (7), `"tp"` (3), `"Tp"` (2).
- Combinaisons multiples : `"FM"`, `"FWP"`, `"MFWP"`, `"PFMW"`, `"W et F"`, `"W & RT"`, `"P , Dw"`.
- Valeur technique : `"0"` (1 occurrence).
- Manque de légende : les codes ne sont pas décodés pour l'utilisateur final.

**Impact :** Le champ est incompréhensible sans dictionnaire. Le filtre par liste afficherait 57 codes, dont beaucoup n'ont qu'une occurrence.

**Recommandation :**

1. On garde tel quelle, entrée libre texte.

---

### 1.5 `type_de_culture` — Type de culture

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 51 |
| Valeurs distinctes | 26 |
| Taux d'unicité | 51,0 % |
| Longueur moyenne | 7,2 caractères |

**Problèmes constatés :**

- Combinaisons de cultures : `"Blé, maïs, soya"`, `"Maïs / Soya / Foin"`, `"Foin, soya"`, `"avoine, soya"`.
- Séparateurs variés : virgules, slashs, espaces.
- Casse et orthographe : `"mais fourrager"` vs `"Maïs fourrager"`, `"Mais-grain"` vs `"mais-grain"`, `"avoine "` avec espace.
- Valeurs sans signification : `""`, `"-"`, `"Aucune précision"`, espaces insécables.

**Impact :** Avec 51 % de valeurs uniques et beaucoup de combinaisons, ce champ ne peut pas être utilisé comme liste de filtres. Il est pertinent comme recherche texte ou doit être normalisé.

**Recommandation :**

1. Créer une liste fermée de cultures de base (Maïs, Soya, Blé, Orge, Foin, Avoine, Prairie, etc.).
2. On va devoir simplifier
Idéalement, résultats attendus: Prairie, cultures annuelles, Vigne, Arboriculture, Maraîchage, Petits fruits, Horticulture, Autres
Ici pour l'import:
- Foin, Prairie devient Prairie
- Mais, soya, soja, avoine, blé devient Culture annuelle
3. Normaliser la casse, les accents et les séparateurs.

---

### 1.6 `densit_plantation` — Densité plantation

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 425 |
| Valeurs distinctes | 30 |
| Taux d'unicité | 7,1 % |
| Longueur moyenne | 4,0 caractères |

**Problèmes constatés :**

- Mélange de formats numériques et textuels :
  - Décimales : `0.75`, `0.85`, `0.8`, `0.7`, `0.65`...
  - Plages : `"70-79%"`, `"80-89%"`, `"60-69%"`, `"90-100%"`, `"50-59%"`.
  - Espaces parasites : `"60-69 %"`, `"80-90 %"`, `"90-100 %"`.
  - Plages incomplètes : `"85-94"`, `"85-94%"`.
  - Valeurs isolées : `"70"`, `"75-84%"`.

**Impact :** Ce champ est stocké en texte alors qu'il représente une densité numérique. Le mélange décimal / plage empêche tout filtre par plage numérique.

**Recommandation :**

1. Convertir en champ numérique (`DECIMAL`).
2. Convertir les plages en une valeur médiane (ex. `"70-79%" → 0.745`).
3. Supprimer les espaces et normaliser le format.

---

### 1.7 `type_de_sol` — Type de sol

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 26 |
| Valeurs distinctes | 9 |
| Taux d'unicité | 34,6 % |
| Longueur moyenne | 10,3 caractères |

**Problèmes constatés :**

- Combinaisons : `"Argile, loam sableux"`, `"Loam sableux, limoneux"`.
- Variantes proches : `"Loam"`, `"Loam sableux"`, `"Argileux"`, `"Sableux"`.
- Faible volume de données : seulement 26 valeurs sur tout le corpus.

**Impact :** Ce champ est relativement propre mais pourrait être enrichi par une liste fermée de types de sol de base.

**Recommandation :**

1. Créer une liste fermée: Argileux, Argilo-limoneux, Limoneux, Loam, Loam argileux, Loam limoneux, Loam sableux, Sableux, Graveleux, Terre noire (organique).
2. Utiliser un champ multi-sélection pour les combinaisons.

---

### 1.8 `source_superficie_draine` — Source superficie drainée

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 194 |
| Valeurs distinctes | 40 |
| Taux d'unicité | 20,6 % |
| Longueur moyenne | 9,2 caractères |

**Problèmes constatés :**

- Champ censé indiquer la source d'une information, avec 40 sources différentes.
- Peu de standardisation : certaines sources sont probablement des noms de fichiers, des documents, ou des mentions libres.

**Recommandation :**

1. Supprimer ce champ.

---

### 1.9 `source_superficie_cultive` — Source superficie cultivée

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 356 |
| Valeurs distinctes | 19 |
| Taux d'unicité | 5,3 % |
| Longueur moyenne | 6,7 caractères |

**Problèmes constatés :**

- Même problème que `source_superficie_draine` mais avec moins de variété.
- Quelques combinaisons (9,6 %).

**Recommandation :**

1. Supprimer ce champ

---

### 1.10 `dcisions_cptaq` — Décisions CPTAQ

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 73 |
| Valeurs distinctes | 65 |
| Taux d'unicité | 89,0 % |
| Longueur moyenne | 32,4 caractères |

**Problèmes constatés :**

- Champ presque entièrement unique : chaque valeur semble être un numéro / une décision spécifique.
- 31,5 % des valeurs contiennent des combinaisons (`,`, `/`, `;`).

**Impact :** Ce champ est du texte libre et ne doit pas être proposé comme liste de filtres.

**Recommandation :**

1. Ce champ est libre: Numéro de décision et entre parenthèses l'objet de la décision


---

### 1.11 `btiments_agricoles` — Bâtiments agricoles

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 74 |
| Valeurs distinctes | 62 |
| Taux d'unicité | 83,8 % |
| Longueur moyenne | 22,3 caractères |

**Problèmes constatés :**

- 28,4 % des valeurs contiennent des combinaisons.
- Valeurs très longues et quasi uniques.

**Impact :** Texte libre. Pas adapté à un filtre par liste.

**Recommandation :**

1. Conserver comme recherche texte.
2. Si besoin d'analyse, créer des champs structurés (présence bâtiment, nombre, type).

---

### 1.12 `observations` — Observations

| Métrique | Valeur |
|----------|--------|
| Valeurs renseignées | 845 |
| Valeurs distinctes | 703 |
| Taux d'unicité | 83,2 % |
| Longueur moyenne | 44,8 caractères |

**Problèmes constatés :**

- Champ de commentaires libres.
- 83 % de valeurs uniques, longueur moyenne élevée.

**Impact :** Ce champ est pertinent comme recherche texte mais ne doit jamais être proposé comme liste de filtres.

**Recommandation :**

1. Conserver en `RECHERCHE_TEXTE`.
2. Ne pas normaliser (c'est du texte libre intentionnel).

---

## 2. Champs numériques avec anomalies

### 2.1 Doublons / champs redondants

| Code machine | Nom affiché | Explication |
|--------------|-------------|-------------|
| `proportion_feuillus` | Proportion feuillus | Champ actif, 613 valeurs, 26 distinctes |
| `proporition_rsineux` | Proporition résineux | Champ actif, 613 valeurs, 25 distinctes — faute d'orthographe dans le code machine |
| `proportion_rsineux` | Proportion résineux | Champ vide, 0 valeur, code machine corrigé par rapport au précédent |
| `superficie_boise` | Superficie boisée | Champ vide, 0 valeur |
| `superficie_boise_ha` | Superficie boisée (ha) | Champ actif, 987 valeurs, 692 distinctes |

**Problème :** Des champs apparaissent en double (ex. `proportion_rsineux` vs `proporition_rsineux` — faute d'orthographe dans le code machine). Le champ vide est probablement un ancien champ abandonné au profit du nouveau.

**Recommandation :**

1. Supprimer ou désactiver les champs vides (`proportion_rsineux`, `superficie_boise`).
2. Migrer les éventuelles valeurs de l'ancien champ vers le nouveau.

---

### 2.2 Champs numériques à faible cardinalité (candidates LISTE)

| Code machine | Nom affiché | Type actuel | Distinctes | Recommandation |
|--------------|-------------|-------------|------------|----------------|
| `proportion_feuillus` | Proportion feuillus | DECIMAL | 26 | Peut être LISTE si les proportions sont discrètes, ou PLAGE_NUMERIQUE sinon. oui pour feuillus ou résineux: ntre 0 et 100, avec intervalle de 5
exemple 15, 20, 25, etc  (%)|
| `proporition_rsineux` | Proporition résineux | DECIMAL | 25 | Idem |
| `zones_humides_ha` | Zones humides (ha) | DECIMAL | 21 | PLAGE_NUMERIQUE. ce sera un chiffre tout le temps différent |
| `classe_de_sol_dominante` | Classe de sol dominante | ENTIER | 7 | LISTE |
| `entaille` | $/entaille | ENTIER | 6 | champ texte libre |
| `sia` | SIA | ENTIER | 18 | c'Est comme MLS. Numéro unique permettant d'identifier la vente (par courtier), associé également à un numéro d'enregistrement, champ libre |
| `maisons` | Maison(s) | ENTIER | 1 | LISTE (booléen compteur) |

**Remarque :** Les superficies (cultivée, acéricole, drainée, boisée) ont une cardinalité trop élevée pour être des listes. Elles doivent rester des plages numériques.

---

### 2.3 Champs numériques vides potentiellement inutiles

| Code machine | Nom affiché | Remarque |
|--------------|-------------|----------|
| `entaillesha` | Entailles/ha | c'Est un calcul. NOmbre d'entailles / Superficie (potentiel) acéricole, on garde |
| `mls` | # MLS | on garde equivalent au SIA|
| `quotas_livres` | Quotas (Livres) | on garde, utilisé pour 'Terres boisées' ou 'Érablières', on garde|

**Recommandation :** Vérifier si ces champs sont encore utilisés. Sinon, les supprimer ou les masquer.

---

## 3. Transactions sans numéro d'inscription ni SIA

Lors de l'import, le système accepte une transaction si elle possède au moins un numéro d'inscription ou un numéro SIA. Si les deux sont absents, la ligne est rejetée. Dans la base actuelle :

| Métrique | Valeur |
|----------|--------|
| Total transactions | 1 706 |
| Avec numéro d'inscription | 1 701 |
| Sans numéro d'inscription | 5 |
| Dont avec SIA compensatoire | 5 |
| Sans numéro d'inscription ni SIA | 0 |

Les 5 transactions sans numéro d'inscription ont toutes un SIA renseigné, ce qui les a maintenues dans la base.

| Date de vente | MRC | Municipalité | Adresse | Lots | SIA |
|-----------------|-----|--------------|---------|------|-----|
| 2018-06-04 | L'Ile-d'Orléans | Saint-François-de-l'Île-d'Orléans | Chemin Royal | 106-P, Paroisse St-François et suivants | 24079958 |
| 2020-11-10 | L'Islet | Saint-Adalbert | 281 Route 204 O. | | 5347394 26189122 |
| 2022-03-12 | Chaudière-Appalaches | Saint-Adalbert | 251 Route 204 O. | 5 347 386, 5 347 388, 5 347 389 | 17965296 |
| 2022-03-16 | Lévis | Lévis | Route St-André | 3644308 | 20696619 |
| 2023-03-27 | Chaudière-Appalaches | Saint-Léon-de-Standon | 123 Rg Ste-Anne | 4577228 | 19511791 |

**Problèmes constatés :**

- Ces transactions ne peuvent pas être dédupliquées par numéro d'inscription lors des imports futurs.
- Elles fragilisent la règle métier selon laquelle une transaction identifiable doit avoir un numéro d'inscription.
- Le SIA n'est pas un identifiant public stable : il peut être réutilisé, réattribué ou mal saisi.

**Recommandation :**

1. Vérifier auprès des notaires ou du client si le numéro d'inscription peut être retrouvé pour ces 5 transactions.=> ne pas passer de temps pour des problèmes concernant un très faible effectif, peut être tout simplement effacé
2. Si le numéro d'inscription est introuvable, évaluer si le SIA suffit comme identifiant principal à long terme.
3. Si le SIA est jugé insuffisant, envisager de marquer ces transactions comme "à vérifier" ou de les exclure des analyses comparatives.
4. À l'avenir, renforcer l'import pour signaler les transactions sans numéro d'inscription comme "incomplètes" plutôt que de les intégrer silencieusement avec seulement un SIA.

---

## 4. Transactions non analysées sans municipalité (impossibles à géocoder)

Le géocodage des transactions se fait à partir de l'adresse complète et/ou de la municipalité. Lorsque les deux sont absentes, il est impossible de calculer une latitude/longitude. Ce phénomène concerne principalement les transactions marquées comme `"A_ANALYSER"`.

| Statut | Total | Sans municipalité | Sans adresse | Sans adresse ni municipalité |
|--------|-------|-------------------|--------------|------------------------------|
| `A_ANALYSER` | 172 | 172 | 172 | 172 |
| `ANALYSEE` | 1 534 | 101 | 488 | 101 |

**Constat clé :** toutes les transactions `"A_ANALYSER"` (172) manquent de municipalité. Par conséquent, aucune d'entre elles ne possède de coordonnées latitude/longitude.

| Statut | Sans latitude/longitude mais avec adresse ou municipalité | Sans latitude/longitude et sans adresse ni municipalité |
|--------|-----------------------------------------------------------|----------------------------------------------------------|
| `A_ANALYSER` | 0 | 172 |
| `ANALYSEE` | 344 | 101 |

**Explication technique :**

- Les transactions sont marquées `A_ANALYSER` quand seules les informations minimales sont présentes : numéro d'inscription, date de vente, MRC, lots.
- Dans la pratique, les 172 transactions `A_ANALYSER` n'ont ni adresse, ni municipalité renseignées.
- Sans municipalité, le service de géocodage (Nominatim) ne dispose d'aucune information géographique exploitable.

**Impact :**

- Impossibilité de les afficher sur la carte des transactions.
- Impossibilité d'appliquer des filtres géographiques sur ces ventes.
- Biais dans les analyses : les ventes sans localisation sont exclues des comparaisons spatiales.

**Recommandation :**

1. Rendre la municipalité obligatoire pour toute transaction importée, ou au minimum pour les transactions destinées à être analysées.
2. Ajouter un contrôle qualité à l'import : signaler les lignes sans adresse ni municipalité comme incomplètes plutôt que de les marquer simplement `"A_ANALYSER"`.
3. Permettre une saisie manuelle ultérieure de l'adresse ou de la municipalité depuis l'interface de détail d'une transaction.
4. Différencier le statut : introduire un statut `"INCOMPLETE"` pour les transactions sans localisation, distinct de `"A_ANALYSER"` qui devrait signifier "données minimales présentes mais analyse non encore faite".
5. Pour les 172 transactions actuelles : demander au client ou aux notaires de compléter la municipalité, ou les exclure des analyses cartographiques en attendant

---

## 5. Champs sources avec potentiel

Les champs sources n'ont pas de valeurs dans `valeur_enrichissement`, donc leur cardinalité n'est pas mesurable ici. Cependant, leur type de filtre peut être prédéterminé par convention :

| Code machine | Nom affiché | Type actuel | Filtre suggéré | Raison |
|--------------|-------------|-------------|----------------|--------|
| `dateVente` | Date de vente | DATE | PLAGE_DATE | Naturel pour une date |
| `prixVente` | Prix de vente | DECIMAL | PLAGE_NUMERIQUE | Valeur continue |
| `superficieTotaleHectare` | Superficie totale (ha) | DECIMAL | PLAGE_NUMERIQUE | Valeur continue |
| `acheteur` | Acheteur | TEXTE | RECHERCHE_TEXTE | Noms propres, variabilité élevée |
| `vendeur` | Vendeur | TEXTE | RECHERCHE_TEXTE | Noms propres |
| `adresse` | Adresse | TEXTE | RECHERCHE_TEXTE | Adresses uniques |
| `numeroInscription` | N° d'inscription | TEXTE | RECHERCHE_TEXTE | Identifiants |
| `lotsCadastraux` | Lots | TEXTE | NUMERO_LOT | Format spécifique |
| `mrc` | MRC | TEXTE | LISTE | Valeurs répétées, liste fermée connue |
| `municipalite` | Municipalité | TEXTE | LISTE | Valeurs répétées, liste fermée connue |

**Recommandation :** Créer une table de référence des MRC et municipalités pour valider les valeurs à l'import.

---

## 6. Synthèse des actions prioritaires

| Priorité | Action | Champs concernés |
|----------|--------|------------------|
| Haute | Nettoyer les valeurs texte avec mapping de normalisation | `feuillusrsineux`, `topographie` |
| Haute | Séparer les numéros d'autorisation CPTAQ du champ oui/non | `zone_agricole_cptaq`, `dcisions_cptaq` |
| Moyenne | Créer des listes fermées et normaliser les combinaisons | `type_de_culture`, `type_de_sol`, `sousclasse_dominante` |
| Moyenne | Convertir les champs numériques stockés en texte | `densit_plantation` |
| Moyenne | Supprimer/désactiver les champs doublons ou vides | `proportion_rsineux`, `superficie_boise`, `entaillesha`, `mls`, `quotas_livres` |
| Moyenne | Traiter les transactions sans numéro d'inscription | `transaction_source.numero_inscription` |
| Moyenne | Compléter les municipalités des transactions non analysées | `transaction_source.municipalite` pour les 172 lignes en statut `A_ANALYSER` |
| Basse | Documenter les champs source et leurs formats attendus | `mrc`, `municipalite`, `lotsCadastraux` |

---

## 7. Annexes

### A. Exemples de valeurs problématiques par champ

#### `topographie`

- `"Plane"` / `"plane"` / `"Plane,"` / `" Plane"`
- `"déclivité"` / `"Déclivité"` / `"Déclvité"` / `"decivite"` / `"legere declivite"`
- `"Pente"` / `"pente"` / `"Forte pente"` / `"pente importante au nord des terres"`

#### `feuillusrsineux`

- `"Feuillus"` / `"feuillus"` / `"FEUILLUS"` / `"Feuillis"`
- `"Résineux"` / `"résineux"` / `"Resineux"` / `" Résineux"`
- `"Mixte"` / `"mixte"` / `"Mixte (dominance feuillus)"` / `"Mixte feuillus"`
- Abréviations : `"F"`, `"R"`, `"M"`, `"MF"`, `"MR"`

#### `zone_agricole_cptaq`

- `"oui"` / `"Oui"` / `"OUI"` / `"ouii"` / `"Oui (partie)"`
- `"non"` / `"Non"` / `" non"` / `"non dispo"`
- `"038376 Résultat Autorisation Détail Utilisation/non/agricole/seule"`
- `"148330 : autorisation, Article 16 LATANR..."`

#### `sousclasse_dominante`

- `"W"` / `"w"`, `"F"`, `"FW"`, `"FM"`, `"FT"`, `"T"`, `"PT"`, `"P"`, `"X"`
- `"W et F"`, `"W & RT"`, `"P , Dw"`
- `"MFWP"`, `"PFMW"`, `"FPW"`, `"PWT"`

#### `type_de_culture`

- `"Blé, maïs, soya"`, `"Maïs / Soya / Foin"`
- `"Foin"` / `"Foin "` (avec espace) / `"Foin / Soya"` / `"Foin, soya"`
- `"mais fourrager"` / `"Maïs fourrager"` / `"Mais-grain"` / `"mais-grain"`

#### `densit_plantation`

- `"0.75"` / `"70-79%"` / `"60-69 %"` / `"85-94"`
