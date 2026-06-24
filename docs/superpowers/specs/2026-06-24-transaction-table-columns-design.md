# Affichage responsive des colonnes du tableau de transactions

**Date :** 2026-06-24
**Portée :** `app/src/components/transaction-table.tsx` et fichiers de tests associés

## Contexte

Le tableau de transactions (`TransactionTable`) affiche déjà un sélecteur manuel de colonnes via le bouton **Colonnes**. Cependant, les colonnes visibles par défaut sont codées en dur (`defaultVisible`). Sur un écran étroit ou quand le panneau de filtres est ouvert, le tableau déclenche un scroll horizontal car trop de colonnes s'affichent.

## Objectif

Faire en sorte que, par défaut, seules les colonnes qui rentrent dans la largeur disponible soient affichées. L'utilisateur garde la main via le sélecteur **Colonnes** et son choix est conservé s'il intervient manuellement.

## Non-objectifs

- Refondre le design visuel du tableau ou du sélecteur de colonnes.
- Modifier le comportement de tri, de filtre ou du chargement infini.
- Rendre les colonnes redimensionnables par l'utilisateur.

## Comportement attendu

1. **Affichage par défaut adaptatif :** au premier affichage client, le tableau mesure la largeur réelle de son conteneur et masque les colonnes les moins prioritaires jusqu'à ce qu'il n'y ait plus de scroll horizontal.
2. **Sélecteur inchangé :** l'utilisateur peut toujours afficher/masquer des colonnes via le menu **Colonnes** existant.
3. **Mémorisation du choix manuel :** dès que l'utilisateur coche ou décoche une colonne, le nouvel ensemble est sauvegardé dans `localStorage` et devient la source de vérité. Le calcul automatique s'arrête.
4. **Réinitialisation possible :** un lien **Réinitialiser l'affichage auto** dans le menu de colonnes efface la préférence et relance le calcul adaptatif.
5. **Recalcul au redimensionnement :** tant qu'aucun choix manuel n'est mémorisé, le tableau recalcule les colonnes visibles quand le conteneur change de largeur.

## Architecture

- On enrichit `TransactionTable` avec un hook dédié, par exemple `useResponsiveColumns`.
- La configuration `COLUMNS` est complétée de deux nouvelles propriétés :
  - `minWidth` : largeur minimale estimée de la colonne en pixels.
  - `priority` : ordre d'importance (du plus faible au plus fort). Les colonnes de faible priorité sont masquées en premier.
- Le hook reçoit la configuration des colonnes et une `ref` sur le conteneur du tableau. Il retourne :
  - `visibleColumns` : `Set<string>` des clés visibles.
  - `toggleColumn(key)` : bascule une colonne (active la mémorisation).
  - `resetColumns()` : efface la préférence et relance le calcul.
  - `hasUserOverride` : indique si un choix manuel est actif (utile pour l'UI).

## Algorithme de calcul

1. Lire `localStorage` au montage client. Si une préférence existe, l'utiliser et ignorer le calcul.
2. Sinon, mesurer `clientWidth` du conteneur du tableau via `ResizeObserver`.
3. Trier les colonnes par `priority` décroissante (la plus importante en premier).
4. Initialiser la largeur totale avec la largeur obligatoire de la colonne **Actions**.
5. Parcourir les colonnes triées et ajouter leur `minWidth` à la largeur totale. Si la nouvelle largeur dépasse le conteneur, marquer cette colonne et toutes les suivantes comme masquées.
6. Retourner l'ensemble des colonnes visibles.

### Priorités et largeurs proposées

| Colonne | `priority` | `minWidth` (px) |
|---|---|---|
| Municipalité | 1 | 150 |
| Type | 2 | 100 |
| Statut | 3 | 110 |
| MRC | 4 | 120 |
| Superficie (ha) | 5 | 130 |
| Taux global ($/ha) | 6 | 140 |
| Prix à l'acte | 7 | 140 |
| Date | 8 | 110 |
| Numéro d'acte | 9 | 140 |
| Actions | 10 (toujours visible) | 80 |

Les largeurs sont des estimations initiales à affiner après test visuel.

## Flux de données

```
Montage client
    │
    ▼
localStorage a une préférence ?
    │
    ├─ Oui ──► utiliser ce Set, hasUserOverride = true
    │
    └─ Non ──► ResizeObserver sur le conteneur
                  │
                  ▼
              Calculer les colonnes visibles
                  │
                  ▼
              hasUserOverride = false

Redimensionnement du conteneur
    │
    ▼
hasUserOverride ?
    │
    ├─ Oui ──► ne rien faire
    │
    └─ Non ──► recalculer

Clic sur une case à cocher du menu Colonnes
    │
    ▼
toggleColumn(key)
    │
    ▼
Mettre à jour le Set, hasUserOverride = true
    │
    ▼
Sauvegarder dans localStorage

Clic sur Réinitialiser l'affichage auto
    │
    ▼
resetColumns()
    │
    ▼
Effacer localStorage, hasUserOverride = false
    │
    ▼
Recalculer depuis le conteneur
```

## Clé de stockage

```text
evagri:transaction-table:visible-columns
```

Valeur : tableau JSON des clés de colonnes visibles.

## Cas limites

- **Colonnes obligatoires trop larges :** si même `Actions` + `Numéro d'acte` ne rentrent pas, on les garde quand même et on accepte un scroll horizontal minimal.
- **Conteneur de 0 px :** si `clientWidth` est 0 au montage (onglet masqué ou élément caché), on attend la première mesure positive avant de calculer.
- **Hydratation :** le rendu serveur conserve les `defaultVisible` actuels. Le client ajuste après le montage. Un léger flash de colonnes masquées est acceptable ; on évite un état vide au premier rendu.
- **localStorage corrompu :** si la valeur lue n'est pas un tableau valide, on l'ignore et on recalcule.

## Tests

- Test unitaire de l'algorithme de calcul avec plusieurs largeurs de conteneur et vérification de l'ordre de masquage.
- Test que la présence d'une préférence `localStorage` surcharge le calcul.
- Test que `toggleColumn` active `hasUserOverride` et persiste.
- Test que `resetColumns` efface la clé `localStorage` et relance le calcul.
- Test visuel rapide : ouvrir la page avec le panneau de filtres ouvert/fermé, vérifier l'absence de scroll horizontal en mode par défaut.

## Notes d'implémentation

- Le hook reste un *client-side* hook : pas de mesure côté serveur.
- Le sélecteur de colonnes actuel (cases à cocher natives) peut rester tel quel ; on ajoute seulement le lien de réinitialisation.
- Les `minWidth` sont des constantes de configuration pour pouvoir être ajustées sans toucher à la logique.
