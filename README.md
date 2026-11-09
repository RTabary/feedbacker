# Feedbacker

Outil de retours visuels : des stakeholders ouvrent un produit dans l'outil via un lien, surlignent un
élément de son interface et y associent un commentaire, enregistré dans PostgreSQL.

```text
https://feedback.example.com/?url=https://app.example.com/commandes
```

## Démarrer

Prérequis : Node.js 22.18 ou plus, pnpm 10, Docker.

```bash
pnpm install
```

```bash
docker compose up -d db --wait
```

```bash
cp .env.example .env
```

```bash
pnpm db:migrate
```

```bash
pnpm dev:fixture
```

Ouvrir ensuite <http://feedback.fixture.localhost:3000/?url=http://app.fixture.localhost:3001/>.

## Vérifier

```bash
pnpm lint && pnpm typecheck && pnpm build && pnpm test
```

```bash
pnpm test:e2e
```

Le guide de validation complet est dans
[quickstart.md](specs/001-iframe-feedback-highlight/quickstart.md).

## Ajouter un produit

Chaque produit doit intégrer un script, autoriser l'outil dans ses en-têtes et figurer dans
`ALLOWED_PRODUCT_ORIGINS` : voir
[product-integration.md](specs/001-iframe-feedback-highlight/contracts/product-integration.md).

## Déployer

Un seul processus Node.js sert l'API, l'interface et le script des produits.

```bash
pnpm install --frozen-lockfile && pnpm build && pnpm db:migrate && pnpm --filter @feedbacker/api start
```

| Variable | Rôle |
|----------|------|
| `DATABASE_URL` | URL PostgreSQL |
| `ALLOWED_PRODUCT_ORIGINS` | Origines exactes des produits autorisés, séparées par des virgules |
| `PORT` | Port d'écoute, 3000 par défaut |

- **HTTPS obligatoire**, pour l'outil comme pour les produits : un navigateur bloque un produit `http` dans
  un outil `https`, et la génération des identifiants exige un contexte sécurisé.
- **Même domaine parent** que les produits qui demandent une connexion, sinon leur session est bloquée.

## Risques acceptés

- **Aucun contrôle d'accès** : toute personne qui atteint l'outil peut lire et déposer des retours, et le nom
  de l'auteur·rice n'est pas vérifié. Déployer sur un réseau privé ou un VPN si les retours sont sensibles.
- **Données personnelles** : les 120 premiers caractères du texte de l'élément annoté sont enregistrés. Les
  valeurs de champs de formulaire ne le sont jamais, mais un nom de client affiché sur la page peut l'être.
- **Suppression** : il n'y a pas d'écran de suppression ; la procédure SQL est dans le quickstart.
