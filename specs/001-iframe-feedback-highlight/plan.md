# Implementation Plan: Retours visuels annotés sur un produit embarqué

**Branch**: `claude/feedback-tool-interface-highlight-284490` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-iframe-feedback-highlight/spec.md`

## Summary

Une application web React affiche dans une iframe le produit dont l'adresse est passée dans le lien,
si son site figure dans la configuration. Un script fourni par l'outil, intégré au produit, permet de
sélectionner et de surligner un élément. L'échange se fait par `postMessage` validé par schéma. Le
retour est enregistré dans une seule table PostgreSQL via une petite API Fastify qui sert aussi
l'interface et le script, sur une même origine.

Choix structurants : voir [research.md](./research.md). Le dessin se fait dans le produit (R3), le
clavier reste géré depuis l'outil (R5), et le message d'absence de réponse repose sur un minuteur, car
la cause n'est pas observable (R2).

## Technical Context

**Language/Version**: TypeScript 6.0 en mode `strict`, Node.js 22 LTS (voir R11 pour TS 7)

**Primary Dependencies**: React 19, Vite 8, Fastify 5, @fastify/static 10, pg 8, node-pg-migrate 9, Zod 4

**Storage**: PostgreSQL 17, une table `feedback` ([data-model.md](./data-model.md))

**Testing**: Vitest 5, Testing Library, axe-core, Playwright avec @axe-core/playwright

**Target Platform**: serveur Node.js derrière HTTPS ; navigateurs récents (Chromium, Firefox, WebKit), bureau et mobile

**Project Type**: application web (interface, API, script intégré aux produits)

**Performance Goals**: SC-004 (moins de 3 s de plus que le produit seul, 95 % des cas) ; SC-005 (confirmation en moins de 2 s, 95 % des cas) ; `connector.js` ≤ 25 Kio gzip

**Constraints**: WCAG 2.2 AA ; FR-004 (10 s) ; même domaine parent pour les produits avec connexion ; aucun contrôle d'accès (FR-019) ; le connecteur ne doit avoir aucun effet hors de l'outil (FR-006b)

**Scale/Scope**: quelques centaines de retours par site, usage entre parties de confiance, une seule langue au départ, pas de pagination (R15)

Aucun point ne reste à clarifier : voir [research.md](./research.md). Deux hypothèses restent marquées
« À valider » (R5 et R9) et sont couvertes par les premiers tests e2e.

### Dépendances d'exécution (constitution, « Dépendances »)

| Paquet | Besoin | Licence | Alternative écartée |
|--------|--------|---------|---------------------|
| react, react-dom | Imposé par la demande | MIT | — |
| fastify | API, `inject`, limite de corps | MIT | Express |
| @fastify/static | Interface et script sur une même origine | MIT | Serveur statique séparé |
| pg | Accès à PostgreSQL | MIT | ORM |
| node-pg-migrate | Migrations SQL versionnées | MIT | Exécuteur maison |
| zod | Validation et types uniques (principe IV) | MIT | Gardes de type écrites à la main |

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Vérification | Avant Phase 0 | Après Phase 1 |
|----------|--------------|---------------|---------------|
| I. Test-First | Tests de contrat pour chaque cas HTTP et chaque message ; tests d'acceptation e2e indépendants par user story ; horloge injectée ; pas de réseau externe (produit de démonstration local) | ✅ | ✅ |
| II. Simplicité | Une table, pas d'ORM, pas de routeur, pas d'état global, pas de bibliothèque i18n ni de composants ; pagination, temps réel et limitation de débit écartés | ✅ | ✅ avec justifications ci-dessous |
| III. Accessibilité | Clavier complet via la barre d'outils, `aria-live`, `<dialog>` natif, axe sur les parcours « déposer » et « consulter » (y compris le cadre du produit) ; textes via i18n imposé par `react/jsx-no-literals` ; connecteur sans texte ; états de chargement, vide, erreur ; mobile testé | ✅ | ✅ |
| IV. Typage strict | `strict`, `any` et `@ts-ignore` interdits par ESLint ; types dérivés des schémas de `packages/contracts`, partagés par l'interface, l'API et le connecteur ; validation à l'entrée de l'API, des messages et de l'environnement | ✅ | ✅ |
| Contraintes techniques | TypeScript partout ; PostgreSQL ; code en anglais ; dépendances justifiées ci-dessus ; secrets uniquement en variables d'environnement validées au démarrage | ✅ | ✅ |
| Quality gates | CI : lint, `tsc --noEmit`, tests unitaires, de contrat, d'intégration et d'accessibilité | ✅ | ✅ |

Le parcours « traiter un feedback » cité par le principe III n'existe pas dans cette spec (pas de
statut) : rien à auditer pour celui-ci.

## Project Structure

### Documentation (this feature)

```text
specs/001-iframe-feedback-highlight/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── http-api.md
│   ├── connector-protocol.md
│   └── product-integration.md
├── checklists/requirements.md
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
apps/
├── api/
│   ├── migrations/                 # SQL node-pg-migrate
│   ├── src/
│   │   ├── config.ts               # environnement validé
│   │   ├── app.ts                  # buildApp({ pool, allowedOrigins, now, staticRoot })
│   │   ├── migrate.ts              # exécution des migrations (commande et tests)
│   │   ├── server.ts
│   │   ├── securityHeaders.ts
│   │   └── feedback/{routes,queries}.ts
│   └── tests/{contract,integration,unit,helpers}/
└── web/
    ├── public/                     # connector.js copié au build (ignoré par git)
    ├── src/
    │   ├── main.tsx, App.tsx, layout.css
    │   ├── api/feedbackClient.ts
    │   ├── i18n/{fr,t}.ts
    │   ├── ui/                     # Button, Field, Alert, Spinner, tokens.css
    │   └── features/
    │       ├── product-frame/      # adresse, iframe, poignée de main, minuteur
    │       ├── annotation/         # barre d'outils, formulaire, session d'annotation
    │       ├── feedback-list/      # liste, repères, sélection, changement de page
    │       └── author/             # nom, localStorage, dialog
    └── tests/

packages/
├── contracts/src/{feedback,protocol,text}.ts   # zod/mini, source unique des types
└── connector/
    ├── src/{index,bridge,picker,cursor,anchor,overlay,pageTracker,markerTracker}.ts
    └── tests/

e2e/
├── fixtures/product-site/          # serveur node:http : pages avec ou sans script, refus, connexion, contenu changeant
└── tests/                          # une suite par user story, axe

.github/workflows/ci.yml
compose.yaml                        # PostgreSQL pour le développement et les tests
.env.example
pnpm-workspace.yaml
```

**Exécution du TypeScript** : aucune étape de compilation côté serveur. Node.js 22.18 et plus exécute
directement les fichiers `.ts` (`erasableSyntaxOnly` garantit la compatibilité) et `tsc --noEmit` vérifie les
types. Cela retire `tsx` et les références de projet prévus par T002 et T003 (principe II). Node.js signale
encore cette fonction comme expérimentale ; à réévaluer lors du passage à la version LTS suivante.

**Structure Decision** : monorepo pnpm avec deux applications et deux paquets. Les tests d'API utilisent
un vrai PostgreSQL (`compose.yaml`) plutôt qu'un faux. `queries.ts` est un module de fonctions SQL, pas
une couche d'abstraction. `apps/web/public` sert `connector.js` dans Vite comme en production, sans
serveur supplémentaire.

Commandes prévues à la racine : `dev`, `dev:fixture`, `db:migrate`, `lint`, `typecheck`, `test`,
`test:e2e`, `build`.

## Complexity Tracking

La constitution demande de justifier ici toute couche supplémentaire, même sans violation.

| Élément | Pourquoi | Alternative plus simple rejetée |
|---------|----------|---------------------------------|
| Paquet `packages/contracts` | Principe IV : types et schémas définis une seule fois, utilisés par trois cibles | Copie dans chaque cible : interdite par le principe IV |
| Paquet `packages/connector` | Bundle IIFE séparé, chargé par d'autres sites, avec budget de taille | Dans `apps/web` : mélangerait React et le code exécuté sur les produits |
| Boucle `requestAnimationFrame` (R3) | Seule approche simple qui suit aussi animations et conteneurs internes (FR-006) | Écouteurs et observateurs : plus de code, cas manqués |
| Sondage de `location.pathname` (R7) | Aucune modification de `history` du produit (FR-006b) | Modifier `history.pushState` : intrusif |
| Identifiant de retour généré par le client (R14) | Pas de doublon lors d'une nouvelle tentative (FR-011, SC-003) | Identifiant serveur : doublon si la réponse est perdue |

## Points à arbitrer avant ou pendant l'implémentation

Ces points n'empêchent pas de passer à `/speckit-tasks`.

1. **Données personnelles (R13)** : un extrait de 120 caractères d'un élément annoté est enregistré, et
   lisible sans contrôle d'accès. C'est à valider si des produits de production sont annotés.
2. **Déploiement** : aucun fichier de déploiement n'est prévu, seul un processus Node et ses variables
   d'environnement. L'outil doit être en HTTPS, et sur un réseau privé si les retours sont sensibles.
3. **TypeScript 7** : à reconsidérer quand `typescript-eslint` le prendra en charge.
