# Quickstart: valider la fonctionnalité

Guide de validation de bout en bout, une fois `/speckit-implement` terminé. Les commandes supposent
les scripts définis par [plan.md](./plan.md). Contrats : [http-api.md](./contracts/http-api.md),
[connector-protocol.md](./contracts/connector-protocol.md),
[product-integration.md](./contracts/product-integration.md).

## Prérequis

- Node.js 22, pnpm 10, Docker.
- Navigateurs Playwright, après l'installation : `pnpm --filter @feedbacker/e2e exec playwright install`.

## Installation

```bash
pnpm install
```

```bash
docker compose up -d db
```

```bash
cp .env.example .env
```

```bash
pnpm db:migrate
```

## Contrôles automatisés

Ce sont les mêmes que ceux qu'impose la constitution pour fusionner.

```bash
pnpm lint && pnpm typecheck && pnpm test
```

```bash
pnpm test:e2e
```

`pnpm test:e2e` démarre ses propres serveurs sur une base dédiée : arrêter `pnpm dev:fixture` avant de le lancer.

**Résultat attendu** : tout passe, y compris le budget de taille du connecteur et les audits axe sans
violation de niveau A ou AA (SC-007).

## Essai manuel

```bash
pnpm dev:fixture
```

Démarre l'outil sur `http://feedback.fixture.localhost:3000` et le produit de démonstration sur
`http://app.fixture.localhost:3001`.

Ouvrir ensuite les liens ci-dessous, sous la forme
`http://feedback.fixture.localhost:3000/?url=<adresse>` :

| # | Adresse ou action | Résultat attendu | Exigence |
|---|-------------------|------------------|----------|
| 1 | `http://app.fixture.localhost:3001/` | Produit affiché et utilisable | US1, FR-002 |
| 2 | Aucun paramètre `url` | Message expliquant comment obtenir un lien | US1 |
| 3 | `javascript:alert(1)` | Refusé, produit non chargé, aucune alerte | FR-003 |
| 4 | `http://other.fixture.localhost:3002/` | Refusé : site non autorisé | FR-003a |
| 5 | `http://app.fixture.localhost:3001/no-connector` | Message unique après 10 s, produit à l'écran, annotation indisponible | FR-004 |
| 6 | `http://app.fixture.localhost:3001/refuses-framing` | Même message après 10 s | FR-004 |
| 7 | `http://app.fixture.localhost:3001/slow-connector` | Message après 10 s, puis disparition automatique et annotation disponible | US2 |
| 8 | `http://app.fixture.localhost:3001/login` | Connexion possible dans l'outil, session reconnue au rechargement | FR-002a |

**Déposer un retour**, à partir du lien 1 :

1. Activer le mode annotation, survoler les éléments : l'élément survolé est pré-signalé.
2. Cliquer sur un bouton du produit : il ne réagit pas, il est mis en évidence et le formulaire s'ouvre.
3. Valider sans texte : refus avec message (US2).
4. Saisir un texte, valider : le nom est demandé la première fois, puis confirmation (FR-011, FR-012).
5. Faire défiler et redimensionner : la mise en évidence et le repère suivent l'élément (FR-006).
6. Recharger : retour et repère présents à l'identique (SC-003).
7. Déposer un second retour : le nom n'est plus redemandé.

**Consulter** :

1. Sur une autre page du produit, le retour reste listé mais sans repère, et n'est pas signalé (FR-015).
2. Le sélectionner : l'outil propose d'aller sur sa page, puis y met l'élément en évidence.
3. Activer un repère dans le produit : le retour est mis en évidence dans la liste.

**Élément modifié** : sur `/changing-content`, déposer un retour puis utiliser le bouton qui modifie la
page. L'indicateur « élément approximatif » ou « élément introuvable » apparaît (FR-016).

**Clavier seul, sans souris** : refaire le dépôt avec la barre d'outils et les flèches. Les parents et
enfants sont atteignables, et chaque déplacement est annoncé (FR-009).

**Mobile** : en vue 375 × 812, refaire le dépôt au toucher (FR-018).

**Échec d'enregistrement** : arrêter la base avec `docker compose stop db`, valider un retour. Une
erreur s'affiche, le texte est conservé, et « Réessayer » réussit après `docker compose start db`, sans
doublon (FR-011).

**Hors outil** : ouvrir directement `http://app.fixture.localhost:3001/`. Aucun repère, aucune
différence visible, aucune erreur en console (FR-006b).

## Requêtes d'exploitation

Il n'y a pas d'écran de suppression (hors périmètre). Pour répondre à une demande de suppression de
données :

```sql
SELECT id, page_path, created_at FROM feedback WHERE author_name = '<nom>';
DELETE FROM feedback WHERE id = '<id>';
```

Pour contrôler un déploiement :

```bash
curl -sI https://feedback.example.com/ | grep -i content-security-policy
```

**Résultat attendu** : `frame-src` liste exactement `ALLOWED_PRODUCT_ORIGINS`.
