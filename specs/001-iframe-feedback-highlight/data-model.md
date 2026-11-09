# Data Model: Retours visuels annotés sur un produit embarqué

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Les schémas exécutables sont définis une seule fois dans `packages/contracts` (principe IV). Ce
document en décrit le sens.

## Correspondance avec les entités de la spec

| Entité de la spec | Représentation | Pourquoi |
|-------------------|----------------|----------|
| Retour (Feedback) | Table `feedback` | Seule donnée à créer et à relire |
| Produit évalué | Colonne `product_origin` | Identifié par son site ; la liste des sites vient de la configuration, pas de la base |
| Page | Colonne `page_path` | Aucun attribut propre |
| Élément annoté | Colonne JSONB `anchor` | Jamais filtré ni modifié, toujours lu avec le retour |
| Contexte d'affichage | Colonne JSONB `display_context` | Idem |
| Stakeholder | Colonne `author_name` | Nom déclaratif, sans compte ni identité partagée entre retours |

Une seule table suffit (principe II) : Produit, Page et Stakeholder n'ont aucun cycle de vie propre.

## Table `feedback`

| Colonne | Type PostgreSQL | Contraintes | Origine de la valeur |
|---------|-----------------|-------------|----------------------|
| `id` | `uuid` | clé primaire | Générée par le client (`crypto.randomUUID()`), pour des nouvelles tentatives sans doublon |
| `product_origin` | `text` | `NOT NULL` | Origine de l'adresse du lien, vérifiée par rapport à la liste de sites |
| `page_path` | `text` | `NOT NULL`, commence par `/`, 2048 caractères au plus | `location.pathname`, envoyé par le connecteur |
| `body` | `text` | `NOT NULL`, 1 à 5000 caractères | Saisi par la personne |
| `author_name` | `text` | `NOT NULL`, 1 à 100 caractères | Saisi par la personne |
| `anchor` | `jsonb` | `NOT NULL`, objet | Connecteur |
| `display_context` | `jsonb` | `NOT NULL`, objet | Connecteur |
| `created_at` | `timestamptz` | `NOT NULL` | Horloge du serveur, injectable pour les tests |

**Index** : `(product_origin, created_at DESC, id DESC)`, pour la liste d'un site. `id` départage
les retours créés au même instant, ce qui rend le tri déterministe.

Les contraintes `CHECK` en base répètent les limites du schéma Zod : elles protègent des écritures
faites hors de l'API (corrections manuelles en SQL, par exemple).

## Objets JSON

### `anchor`

| Champ | Type | Règle |
|-------|------|-------|
| `selector` | string | 1 à 4000 caractères |
| `tagName` | string | 1 à 64 caractères, en minuscules |
| `textExcerpt` | string | 0 à 120 caractères ; jamais la valeur d'un champ de formulaire |
| `rect` | objet | `x`, `y`, `width`, `height` : nombres finis, `width` et `height` ≥ 0, coordonnées du document |

### `display_context`

| Champ | Type | Règle |
|-------|------|-------|
| `viewportWidth`, `viewportHeight` | entier | > 0 |
| `scrollX`, `scrollY` | nombre | fini |

## Règles de validation

Appliquées par le même schéma à l'interface, au connecteur et à l'API (FR-013).

| Règle | Exigence | Détail |
|-------|----------|--------|
| Texte du retour | FR-007, US2 | Obligatoire après suppression des espaces de début et de fin, 5000 caractères au plus |
| Nom | FR-012 | 1 à 100 caractères après suppression des espaces de début et de fin |
| Chaînes sûres | R14 | Aucun `\u0000`, chaîne bien formée (`isWellFormed()`), sur tous les champs texte |
| Origine | FR-003, FR-003a | `http` ou `https`, sous forme canonique (`new URL(x).origin === x`), présente dans la liste de sites |
| Chemin | FR-010 | Commence par `/`, 2048 caractères au plus |
| Identifiant | R14 | UUID valide |

## Cycle de vie

Un retour n'a qu'un seul état : créé. Il n'est ni modifié ni supprimé par l'interface, et n'a pas de
statut (FR-014). Un enregistrement renvoyé avec le même `id` retourne le retour existant, sans rien
écraser.

## Données hors base

| Donnée | Stockage | Durée |
|--------|----------|-------|
| Nom de l'auteur·rice pour les retours suivants | `localStorage` du navigateur, clé `feedbacker.authorName` | Jusqu'à modification ; si le stockage est indisponible, le nom est redemandé |
| Brouillon en cours | État React | Durée de la page : survit à la navigation et à l'expiration de session du produit, pas au rechargement de l'outil |
| Statut d'un élément (`exact`, `approximate`, `notFound`) | Calculé par le connecteur | Jamais stocké : il dépend de l'état actuel du produit |
| Liste de sites autorisés | Variable d'environnement `ALLOWED_PRODUCT_ORIGINS` | Configuration de déploiement |
