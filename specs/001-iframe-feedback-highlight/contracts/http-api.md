# Contract: API HTTP

Schémas de référence : `packages/contracts/src/feedback.ts`. Chaque cas ci-dessous fait l'objet d'un
test de contrat (principe I). L'API est servie sur la même origine que l'interface : aucun CORS.
Corps JSON limité à 64 Kio. Aucune authentification (FR-019).

## Types partagés

`Feedback`, `Anchor` et `DisplayContext` : voir [data-model.md](../data-model.md).

```text
Feedback = {
  id: uuid, productOrigin: string, pagePath: string, body: string, authorName: string,
  anchor: Anchor, displayContext: DisplayContext, createdAt: ISO 8601 UTC
}
ApiError = {
  code: "VALIDATION_ERROR" | "ORIGIN_NOT_ALLOWED" | "INTERNAL_ERROR",
  issues?: [{ path: string, code: string }]
}
```

`ApiError` ne contient pas de texte destiné à l'utilisateur : l'interface traduit `code` et `issues`
via son i18n (principe III). Une erreur `INTERNAL_ERROR` n'expose aucun détail technique.

## `GET /api/feedback?origin={origin}`

Liste tous les retours d'un produit, du plus récent au plus ancien (FR-014), départagés par `id`.

| Cas | Statut | Corps |
|-----|--------|-------|
| Site autorisé, avec retours | 200 | `{ "items": Feedback[] }` |
| Site autorisé, sans retour | 200 | `{ "items": [] }` |
| `origin` absent, mal formé, non canonique ou hors http/https | 400 | `ApiError` `VALIDATION_ERROR` |
| Site hors liste | 403 | `ApiError` `ORIGIN_NOT_ALLOWED` |
| Base indisponible | 500 | `ApiError` `INTERNAL_ERROR` |

L'interface s'appuie sur cette route pour décider du chargement du produit :

| Réponse | Comportement |
|---------|--------------|
| 403 | Produit non chargé, message « site non autorisé » (US1) |
| 500 ou réseau | Produit chargé quand même, erreur et bouton « Réessayer » dans la liste. `frame-src` continue d'appliquer la liste de sites |

## `POST /api/feedback`

Enregistre un retour. Le serveur fixe `createdAt`.

```text
Requête = { id, productOrigin, pagePath, body, authorName, anchor, displayContext }
```

| Cas | Statut | Corps |
|-----|--------|-------|
| Nouveau retour valide | 201 | `Feedback` |
| `id` déjà enregistré | 200 | `Feedback` existant, sans rien écraser |
| Champ invalide | 400 | `ApiError` `VALIDATION_ERROR`, `issues` indique les champs |
| Corps de plus de 64 Kio | 413 | `ApiError` `VALIDATION_ERROR` |
| Site hors liste | 403 | `ApiError` `ORIGIN_NOT_ALLOWED` |
| Base indisponible | 500 | `ApiError` `INTERNAL_ERROR` ; une nouvelle tentative avec le même `id` est sûre |

Le texte du retour et le nom sont conservés après suppression des espaces de début et de fin ; la
réponse renvoie les valeurs effectivement enregistrées.

## Ressources statiques

| Route | Contenu | En-têtes notables |
|-------|---------|-------------------|
| `/` | Interface de l'outil (`?url={adresse du produit}`) | Voir ci-dessous |
| `/connector.js` | Script à intégrer aux produits | `Cache-Control: public, max-age=300` |

## En-têtes de sécurité (tests de contrat)

Sur chaque réponse HTML :

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self';
  img-src 'self'; font-src 'self'; frame-src {ALLOWED_PRODUCT_ORIGINS}; frame-ancestors 'none';
  base-uri 'none'; form-action 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

## Configuration

Validée au démarrage ; le processus s'arrête avec un message explicite si elle est invalide.

| Variable | Exemple | Règle |
|----------|---------|-------|
| `DATABASE_URL` | `postgres://...` | URL PostgreSQL ; ne jamais la versionner |
| `ALLOWED_PRODUCT_ORIGINS` | `https://app.example.com,https://rec.example.com` | Au moins une origine, chacune canonique, sans joker |
| `PORT` | `3000` | Entier, 3000 par défaut |
