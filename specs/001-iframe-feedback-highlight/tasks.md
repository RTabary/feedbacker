---
description: "Tâches d'implémentation : retours visuels annotés sur un produit embarqué"
---

# Tasks: Retours visuels annotés sur un produit embarqué

**Input**: Design documents from `specs/001-iframe-feedback-highlight/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/), [quickstart.md](./quickstart.md)

**Tests**: obligatoires et écrits en premier : le principe I de la constitution (TDD) est non négociable. Chaque tâche de test doit être exécutée et échouer pour la bonne raison avant que l'implémentation correspondante commence.

**Organization**: les tâches sont groupées par user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]** : parallélisable (fichiers différents, aucune dépendance à une tâche inachevée)
- **[Story]** : user story concernée (US1, US2, US3)
- Le code est en anglais (identifiants, fichiers, noms de tests) ; le français est réservé aux commentaires et au catalogue i18n.
- Les références `R1` à `R15` renvoient à [research.md](./research.md).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: initialiser le monorepo et les outils qualité imposés par la constitution.

- [X] T001 Créer `package.json` (racine, privé, `engines` Node 22 et pnpm 10, scripts `dev`, `dev:fixture`, `db:migrate`, `lint`, `typecheck`, `test`, `test:e2e`, `build`), `pnpm-workspace.yaml` (`apps/*`, `packages/*`, `e2e`) et `.gitignore` (`node_modules`, `dist`, `.env`, `apps/web/public/connector.js`, sorties Playwright)
- [X] T002 Créer les manifestes `apps/api/package.json`, `apps/web/package.json`, `packages/contracts/package.json`, `packages/connector/package.json`, `e2e/package.json` et installer les versions de R11 : TypeScript 6.0, React 19, Vite 8, Fastify 5, @fastify/static 10, pg 8, node-pg-migrate 9, Zod 4 ; en développement Vitest 5, jsdom, Testing Library 16, axe-core, Playwright 1.64, @axe-core/playwright, ESLint 9, typescript-eslint 8, eslint-plugin-react, tsx
- [X] T003 Créer `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `lib` incluant ES2024 pour `isWellFormed`) et un `tsconfig.json` par paquet avec références de projet, dans `apps/api/`, `apps/web/`, `packages/contracts/`, `packages/connector/`, `e2e/`
- [X] T004 [P] Créer `eslint.config.js` : interdire `any` et `@ts-ignore` (`@ts-expect-error` avec explication autorisé), activer `react/jsx-no-literals`, et interdire `import { z } from "zod/mini"` (seule forme admise : `import * as z from "zod/mini"`, R10)
- [X] T005 [P] Créer `compose.yaml` (service `db`, PostgreSQL 17 avec `healthcheck`), `docker/init-test-db.sql` (base `feedbacker_test`) et `.env.example` (`DATABASE_URL`, `TEST_DATABASE_URL`, `ALLOWED_PRODUCT_ORIGINS`, `PORT`), sans aucun secret réel
- [X] T006 [P] Créer `vitest.config.ts` avec un projet par paquet : `apps/api` en Node avec `fileParallelism: false` (base partagée), `apps/web` et `packages/connector` en jsdom, `packages/contracts` en Node
- [X] T007 [P] Créer `e2e/playwright.config.ts` : projets Chromium, Firefox, WebKit et un projet mobile 375 × 812, `baseURL` `http://feedback.fixture.localhost:3000`, `webServer` démarrant le build de production de l'API et le site de démonstration (`e2e/fixtures/product-site/server.ts`), avec `--host-resolver-rules` si un moteur ne résout pas `*.fixture.localhost`
- [X] T008 [P] Créer `.github/workflows/ci.yml` : installation, `docker compose up -d db --wait`, migrations, `pnpm lint`, `pnpm typecheck`, `pnpm build`, `pnpm test`, `pnpm test:e2e`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: contrats partagés, base de données, squelettes de l'API, de l'interface et du connecteur, site de démonstration.

**⚠️ CRITICAL**: aucune user story ne peut commencer avant la fin de cette phase.

### Contrats partagés

- [X] T009 [P] Écrire `packages/contracts/tests/text.test.ts` : une chaîne sûre refuse `\u0000` et les chaînes mal formées (surrogat isolé), accepte accents et emojis
- [X] T010 [P] Écrire `packages/contracts/tests/feedback.test.ts` selon [data-model.md](./data-model.md) : `body` « Obligatoire après suppression des espaces de début et de fin, 5000 caractères au plus » ; `authorName` « 1 à 100 caractères après suppression des espaces de début et de fin » ; `pagePath` « Commence par `/`, 2048 caractères au plus » ; `productOrigin` `http` ou `https` et canonique (`new URL(x).origin === x`) ; `id` UUID valide ; `selector` 1 à 4000 ; `tagName` 1 à 64, en minuscules ; `textExcerpt` 0 à 120 ; `rect` nombres finis, `width` et `height` ≥ 0 ; `viewportWidth` et `viewportHeight` entiers > 0 ; `scrollX` et `scrollY` finis
- [X] T011 [P] Écrire `packages/contracts/tests/protocol.test.ts` : un cas valide et un cas invalide pour chaque message de [connector-protocol.md](./contracts/connector-protocol.md) ; enveloppe refusée si `source` ou `version` diffère
- [X] T012 Implémenter `packages/contracts/src/text.ts` (`safeText(max)` avec `zod/mini`) et faire passer T009
- [X] T013 Implémenter `packages/contracts/src/feedback.ts` (`Anchor`, `DisplayContext`, `Feedback`, `CreateFeedbackRequest`, `ApiError`, types dérivés avec `z.infer`) et faire passer T010
- [X] T014 Implémenter `packages/contracts/src/protocol.ts` (`ToolToConnectorMessage`, `ConnectorToToolMessage`, unions discriminées) et `packages/contracts/src/index.ts`, et faire passer T011

### API et base de données

- [X] T015 [P] Écrire `apps/api/tests/unit/config.test.ts` : `ALLOWED_PRODUCT_ORIGINS` exige au moins une origine, chacune canonique, sans joker ni chemin ; `DATABASE_URL` obligatoire ; `PORT` à 3000 par défaut ; erreur explicite sans afficher la valeur de `DATABASE_URL`
- [X] T016 [P] Écrire `apps/api/tests/integration/migration.test.ts` : la table `feedback` existe ; les contraintes `CHECK` refusent `body` vide ou de plus de 5000 caractères, `author_name` vide ou de plus de 100 caractères, `page_path` sans `/` initial ou de plus de 2048 caractères, `anchor` ou `display_context` qui n'est pas un objet ; l'index `(product_origin, created_at DESC, id DESC)` existe
- [X] T017 [P] Écrire `apps/api/tests/helpers/testApp.ts` (pool sur `TEST_DATABASE_URL`, `TRUNCATE` avant chaque test, horloge fixe injectée) et `apps/api/tests/contract/errors.test.ts` : une erreur inattendue donne 500 `INTERNAL_ERROR` sans détail technique ; un corps de plus de 64 Kio donne 413 `VALIDATION_ERROR`
- [X] T018 Implémenter `apps/api/src/config.ts` et faire passer T015
- [X] T019 Créer `apps/api/migrations/0001_create_feedback.sql` (colonnes et contraintes de [data-model.md](./data-model.md)), brancher `db:migrate` sur node-pg-migrate et faire passer T016
- [X] T020 Implémenter `apps/api/src/app.ts` (`buildApp({ pool, allowedOrigins, now, staticRoot })`, `bodyLimit` 64 Kio, gestionnaire d'erreurs `ApiError`, journaux sans corps de requête) et `apps/api/src/server.ts`, et faire passer T017

### Interface

- [X] T021 [P] Écrire `apps/web/tests/i18n.test.ts` : substitution des paramètres, format de date et de pluriel français via `Intl`, clé inconnue rejetée à la compilation (`@ts-expect-error` commenté)
- [X] T022 [P] Écrire `apps/web/tests/helpers/axe.ts` (assistant de test basé sur `axe-core`, sans violation de niveau A ou AA) et `apps/web/tests/ui.test.tsx` : `Button`, `Field`, `Alert`, `Spinner` ont rôles et libellés corrects, focus visible, passent l'audit axe
- [X] T023 Implémenter `apps/web/src/i18n/t.ts` et `apps/web/src/i18n/fr.ts` (R12), et faire passer T021
- [X] T024 Implémenter `apps/web/src/ui/` (`Button`, `Field`, `Alert`, `Spinner`, `tokens.css` avec des contrastes conformes WCAG 2.2 AA) et faire passer T022
- [X] T025 Créer `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx` (coquille vide) et `apps/web/vite.config.ts` (proxy de `/api` vers l'API en développement), sans script ni style en ligne, pour respecter la CSP

### Connecteur et site de démonstration

- [X] T026 [P] Créer `packages/connector/vite.config.ts` (bundle IIFE unique, sortie vers `apps/web/public/connector.js`) et `packages/connector/src/index.ts` (point d'entrée vide), et faire construire le connecteur avant l'interface dans `pnpm build`
- [X] T027 Créer `e2e/fixtures/product-site/server.ts` (`node:http`, aucune dépendance) sur `app.fixture.localhost:3001` et une origine hors liste `other.fixture.localhost:3002`, avec les pages `/`, `/second-page`, `/no-connector`, `/refuses-framing` (`X-Frame-Options: DENY`), `/slow-connector` (script chargé après plus de 10 s), `/login` et `/logout` (cookie de session `SameSite=Lax`, pour simuler une session expirée), `/changing-content`, `/external-link`. La page `/` contient un conteneur à défilement interne, des éléments imbriqués, des champs de formulaire et un lien `pushState` vers `/second-page` ; brancher `pnpm dev:fixture`

**Checkpoint**: `pnpm lint`, `pnpm typecheck`, `pnpm test` et `pnpm build` passent ; les user stories peuvent commencer.

---

## Phase 3: User Story 1 - Afficher le produit à commenter depuis un lien (Priority: P1) 🎯 MVP (socle)

**Goal**: ouvrir un lien affiche le produit autorisé, utilisable, connecté au connecteur ; tout autre cas donne un message explicite.

**Independent Test**: ouvrir l'outil avec l'adresse du site de démonstration et vérifier qu'il reste interactif ; ouvrir sans adresse, avec une adresse invalide ou un site hors liste et vérifier le message (quickstart, lignes 1 à 8 de l'essai manuel).

### Tests for User Story 1 ⚠️

> **Écrire ces tests d'abord et vérifier qu'ils échouent avant toute implémentation.**

- [X] T028 [P] [US1] Écrire `apps/api/tests/contract/listFeedback.test.ts` selon [http-api.md](./contracts/http-api.md) : 200 avec `items` triés par `createdAt` puis `id` décroissants, 200 avec `items: []`, 400 si `origin` est absent, mal formé, non canonique ou hors http/https, 403 `ORIGIN_NOT_ALLOWED` hors liste, 500 `INTERNAL_ERROR` si la base est indisponible (FR-003a, FR-019)
- [X] T029 [P] [US1] Écrire `apps/api/tests/contract/securityHeaders.test.ts` : sur `/`, CSP exacte de [http-api.md](./contracts/http-api.md) avec `frame-src` égal à la liste de sites, `X-Content-Type-Options`, `Referrer-Policy` ; `/connector.js` servi avec `Cache-Control: public, max-age=300` ; racine statique de test passée par `staticRoot`, sans dépendre d'un build (FR-003a, R8)
- [X] T030 [P] [US1] Écrire `packages/connector/tests/bridge.test.ts` : hors iframe, aucun écouteur ni minuteur ni DOM ; dans une iframe, seul un écouteur `message` et l'envoi de `connector.hello` avec `targetOrigin` égal à l'origine de `connector.js` ; `tool.ping` vérifié donne `connector.ready` avec `path` ; `event.source` ou `event.origin` incorrect, ou schéma invalide, est ignoré (FR-006b, R1, R8)
- [X] T031 [P] [US1] Écrire `apps/web/tests/productUrl.test.ts` : paramètre `url` absent, mal formé, `javascript:`, `data:`, `file:` refusés ; `http` et `https` acceptés ; origine extraite sous forme canonique (FR-001, FR-003)
- [X] T032 [P] [US1] Écrire `apps/web/tests/feedbackClient.test.ts` : `listFeedback` distingue succès, 403, 500 et erreur réseau, et valide la réponse par schéma
- [X] T033 [P] [US1] Écrire `apps/web/tests/useProductConnection.test.tsx` avec horloge simulée : états `connecting`, `connected`, `unresponsive` ; minuteur de 10 s armé au montage et réarmé à chaque `load` ; `tool.ping` sur `load` et sur `connector.hello` ; `connector.ready` annule le minuteur ; `connector.ready` tardif efface `unresponsive` ; messages de mauvaise source ou origine ignorés ; `targetOrigin` jamais `*` (FR-004, FR-006a, R2)
- [X] T034 [P] [US1] Écrire `apps/web/tests/ProductFrame.test.tsx` : iframe avec `title` traduit ; messages pour lien absent, adresse invalide, site hors liste (iframe non rendue) ; API en 500 ou réseau : iframe rendue quand même ; message unique `unresponsive` citant les causes possibles sans en désigner une ; états de chargement ; audit axe (FR-002, FR-003, FR-003a, FR-004, FR-017)
- [X] T035 [P] [US1] Écrire `e2e/tests/us1-display.spec.ts` sur les trois moteurs : scénarios d'acceptation 1 à 6 de US1 ; produit réellement interactif (FR-002) ; `/login` : connexion dans l'outil et session reconnue au rechargement (FR-002a, R9) ; `/refuses-framing`, `/no-connector` et `/slow-connector` (FR-004) ; `/external-link` : navigation hors liste bloquée (R8) ; ouverture directe du produit sans aucun effet ni erreur console (FR-006b) ; audit axe avec le cadre du produit
- [X] T036 [US1] Exécuter `pnpm test` et `pnpm test:e2e e2e/tests/us1-display.spec.ts` et confirmer que les tests de cette phase échouent pour la bonne raison

### Implementation for User Story 1

- [X] T037 [US1] Implémenter `apps/api/src/feedback/queries.ts` (`listFeedbackByOrigin`) et `apps/api/src/feedback/routes.ts` (`GET /api/feedback`, contrôle de la liste de sites) ; faire passer T028
- [X] T038 [US1] Implémenter `apps/api/src/securityHeaders.ts` et servir `staticRoot` avec @fastify/static dans `apps/api/src/app.ts`, `apps/api/src/server.ts` passant `apps/web/dist` ; faire passer T029
- [X] T039 [US1] Implémenter `packages/connector/src/bridge.ts` et le brancher dans `packages/connector/src/index.ts` : origine de l'outil lue dans `document.currentScript.src`, inactif hors iframe et avant le premier message vérifié ; faire passer T030
- [X] T040 [P] [US1] Implémenter `apps/web/src/features/product-frame/productUrl.ts` ; faire passer T031
- [X] T041 [P] [US1] Implémenter `apps/web/src/api/feedbackClient.ts` (`listFeedback`) ; faire passer T032
- [X] T042 [US1] Implémenter `apps/web/src/features/product-frame/useProductConnection.ts` ; faire passer T033
- [X] T043 [US1] Implémenter `apps/web/src/features/product-frame/ProductFrame.tsx`, le brancher dans `apps/web/src/App.tsx` avec une mise en page responsive, et ajouter les textes à `apps/web/src/i18n/fr.ts` ; faire passer T034
- [X] T044 [US1] Faire passer `e2e/tests/us1-display.spec.ts` et noter dans `specs/001-iframe-feedback-highlight/research.md` (R9) le résultat de l'hypothèse sur `*.fixture.localhost` et sur la session dans le cadre

**Checkpoint**: US1 fonctionne seule. Le produit s'affiche, mais rien ne peut encore être annoté.

---

## Phase 4: User Story 2 - Surligner un élément et rédiger un retour (Priority: P1) 🎯 MVP (valeur)

**Goal**: activer l'annotation, désigner un élément à la souris, au clavier ou au toucher, rédiger et enregistrer un retour, retrouvé avec son repère après rechargement.

**Independent Test**: sur le site de démonstration, activer l'annotation, sélectionner un élément, saisir un texte, valider, recharger, puis vérifier que le retour et son repère sont présents.

### Tests for User Story 2 ⚠️

> **Écrire ces tests d'abord et vérifier qu'ils échouent avant toute implémentation.**

- [X] T045 [P] [US2] Écrire `apps/api/tests/contract/createFeedback.test.ts` selon [http-api.md](./contracts/http-api.md) : 201 avec `createdAt` fixé par le serveur et valeurs sans espaces de début et de fin ; 200 avec le retour existant, sans écrasement, si l'`id` existe déjà ; 400 avec `issues` pour chaque champ invalide, dont `\u0000` et surrogat isolé ; 403 hors liste ; 413 au-delà de 64 Kio ; 500 `INTERNAL_ERROR` si la base est indisponible (FR-010, FR-013, R14)
- [X] T046 [P] [US2] Écrire `apps/api/tests/integration/feedbackPersistence.test.ts` : un retour relu est identique à celui confirmé, accents, emojis et JSON compris (SC-003) ; deux retours sur le même élément restent distincts ; les journaux ne contiennent ni le texte ni le nom (R13)
- [X] T047 [P] [US2] Écrire `packages/connector/tests/anchor.test.ts` : ordre de priorité `data-feedback-anchor`, `data-testid`, `data-test`, `data-cy`, puis `id` sans chiffres ni `:`, puis chemin `nth-of-type` ; classes jamais utilisées ; sélecteur toujours unique ; `tagName` en minuscules ; extrait limité à 120 points de code sans couper un emoji ; pour un champ : `aria-label`, puis `placeholder`, puis `name`, jamais `value` (R6, R13)
- [X] T048 [P] [US2] Écrire `packages/connector/tests/resolveAnchor.test.ts` couvrant le tableau de R6 : `exact`, `approximate` (extrait différent, ou sélecteur en échec et extrait unique sur la même balise), `notFound`, y compris sélecteur devenu ambigu (FR-016)
- [X] T049 [P] [US2] Écrire `packages/connector/tests/picker.test.ts` : aucun écouteur hors mode annotation (FR-005) ; en mode annotation, `click`, `pointerdown`, `pointerup`, `mousedown`, `mouseup`, `auxclick`, `dragstart` bloqués en capture ; `wheel` et `scroll` non bloqués ; survol donnant `connector.cursorMoved` ; clic donnant `connector.elementSelected` avec `anchor`, `displayContext`, `path` ; `Échap` donnant `connector.selectionCancelled` ; écouteurs retirés à la sortie (FR-006, R4)
- [X] T050 [P] [US2] Écrire `packages/connector/tests/cursor.test.ts` : `next`, `previous`, `parent`, `child` dans l'ordre du DOM ; éléments masqués ou sans taille ignorés ; départ depuis l'élément actif ; bornes sans erreur ; `scrollIntoView` appelé ; `tool.confirmCursor` sélectionne (FR-009, R5)
- [X] T051 [P] [US2] Écrire `packages/connector/tests/overlay.test.ts` avec `showPopover` et `requestAnimationFrame` simulés : Shadow DOM, hôte `popover="manual"`, styles posés par CSSOM uniquement ; contour de sélection non basé sur la seule couleur ; repères en `<button>` avec `aria-label` issu de `label` et texte égal à `ordinal` ; aucun texte en dur ; activation donnant `connector.markerActivated` ; position mise à jour à chaque image et boucle arrêtée sans contenu (FR-006, FR-015, R3, principe III)
- [X] T052 [P] [US2] Écrire `packages/connector/tests/bundleSize.test.ts` : le test construit le connecteur avec l'API de Vite dans un dossier temporaire et vérifie que le résultat compressé en gzip fait 25 Kio au plus (R10)
- [X] T053 [P] [US2] Compléter `apps/web/tests/feedbackClient.test.ts` : `createFeedback` envoie l'`id` fourni, distingue 201, 200, 400, 403, 500 et erreur réseau
- [X] T054 [P] [US2] Écrire `apps/web/tests/author.test.tsx` : nom demandé dans un `<dialog>` au premier retour, 1 à 100 caractères, mémorisé dans `feedbacker.authorName`, réutilisé, modifiable à tout moment ; `localStorage` qui lève une exception : le nom est redemandé, sans plantage ; audit axe (FR-012, US2 scénario 9)
- [X] T055 [P] [US2] Écrire `apps/web/tests/AnnotationToolbar.test.tsx` : bouton d'annotation à `aria-pressed`, indisponible si le produit n'est pas `connected` et expliqué ; `role="toolbar"`, boutons et flèches envoyant `tool.moveCursor`, `Entrée` envoyant `tool.confirmCursor`, `Échap` annulant ; description annoncée en `aria-live` ; audit axe (FR-005, FR-006a, FR-009, R5)
- [X] T056 [P] [US2] Écrire `apps/web/tests/FeedbackForm.test.tsx` : focus sur le texte à l'ouverture ; texte vide refusé avec message ; compteur et limite de 5000 caractères ; annuler n'enregistre rien et envoie `tool.clearSelection` ; confirmation explicite ; échec : erreur, texte conservé, nouvelle tentative avec le même `id` ; brouillon conservé si la page du produit change ; audit axe (FR-007, FR-008, FR-011, R14)
- [X] T057 [P] [US2] Écrire `e2e/tests/us2-annotate.spec.ts` sur les trois moteurs et le projet mobile : scénarios d'acceptation 1 à 9 de US2 ; produit normal hors annotation (FR-005) ; le produit ne réagit pas au clic d'annotation ; focus revenant au formulaire après un clic dans l'iframe (R5, à valider) ; parcours complet au clavier seul avec élargissement vers le parent ; parcours au toucher (FR-009) ; mise en évidence suivant défilement, redimensionnement et conteneur interne (FR-006) ; retour et repère présents après rechargement (SC-003) ; base arrêtée puis relancée sans doublon (FR-011) ; session expirée pendant la rédaction, retour enregistré après reconnexion ; audit axe avec le cadre du produit (FR-018)
- [X] T058 [US2] Exécuter `pnpm test` et `pnpm test:e2e e2e/tests/us2-annotate.spec.ts` et confirmer que les tests de cette phase échouent pour la bonne raison

### Implementation for User Story 2

- [X] T059 [US2] Ajouter `insertFeedback` (`ON CONFLICT (id) DO NOTHING`, puis relecture) à `apps/api/src/feedback/queries.ts` et `POST /api/feedback` à `apps/api/src/feedback/routes.ts` ; faire passer T045 et T046
- [X] T060 [P] [US2] Implémenter `packages/connector/src/anchor.ts` (`createAnchor`, `resolveAnchor`) ; faire passer T047 et T048
- [X] T061 [P] [US2] Implémenter `packages/connector/src/cursor.ts` ; faire passer T050
- [X] T062 [P] [US2] Implémenter `packages/connector/src/overlay.ts` ; faire passer T051
- [X] T063 [US2] Implémenter `packages/connector/src/picker.ts` (utilise T060, T061, T062) ; faire passer T049
- [X] T064 [US2] Brancher `tool.setAnnotationMode`, `tool.moveCursor`, `tool.confirmCursor`, `tool.clearSelection` et `tool.setMarkers` dans `packages/connector/src/bridge.ts`, le connecteur répondant par `connector.markersResolved` ; faire passer T052
- [X] T065 [US2] Ajouter à `apps/web/src/i18n/fr.ts` tous les textes de l'annotation, du formulaire et du nom, avant le travail en parallèle sur ces composants
- [X] T066 [P] [US2] Ajouter `createFeedback` à `apps/web/src/api/feedbackClient.ts` ; faire passer T053
- [X] T067 [P] [US2] Implémenter `apps/web/src/features/author/` (`useAuthorName.ts`, `AuthorDialog.tsx`) ; faire passer T054
- [X] T068 [P] [US2] Implémenter `apps/web/src/features/annotation/AnnotationToolbar.tsx` et la région `aria-live` ; faire passer T055
- [X] T069 [P] [US2] Implémenter `apps/web/src/features/annotation/FeedbackForm.tsx` (`crypto.randomUUID()` à l'ouverture du brouillon) ; faire passer T056
- [X] T070 [US2] Brancher annotation, formulaire et nom dans `apps/web/src/App.tsx`, envoyer `tool.setMarkers` pour les retours de la page courante après `connector.ready` et après chaque dépôt
- [X] T071 [US2] Faire passer `e2e/tests/us2-annotate.spec.ts` et noter dans `specs/001-iframe-feedback-highlight/research.md` (R5) le résultat du retour de focus sur chaque moteur

**Checkpoint**: US1 et US2 fonctionnent : c'est le MVP utile, un retour annoté est déposé et conservé.

---

## Phase 5: User Story 3 - Revoir les retours existants sur le produit (Priority: P2)

**Goal**: voir tous les retours du site, signaler ceux de la page courante, naviguer entre liste, repères et pages, et indiquer les éléments qui ne sont plus retrouvés.

**Independent Test**: créer deux retours sur deux pages d'un même site via l'API, rouvrir l'outil et vérifier que les deux apparaissent, que seul celui de la page courante a un repère et que sélectionner l'autre propose de changer de page.

### Tests for User Story 3 ⚠️

> **Écrire ces tests d'abord et vérifier qu'ils échouent avant toute implémentation.**

- [X] T072 [P] [US3] Écrire `packages/connector/tests/pageTracker.test.ts` avec horloge simulée : `connector.pageChanged` envoyé une seule fois par changement de `location.pathname` en 500 ms ; ignore paramètres et fragment ; `history` non modifié ; sondage actif seulement après le premier message vérifié (R7, FR-006b)
- [X] T073 [P] [US3] Écrire `packages/connector/tests/markers.test.ts` avec horloge simulée : `tool.setMarkers` remplace les repères et répond `connector.markersResolved` ; nouvel essai toutes les 500 ms, message envoyé seulement si un statut change ; élément déconnecté résolu à nouveau ; `notFound` sans repère ni rectangle dessiné ; `activeFeedbackId` met en évidence l'élément (FR-015, FR-016, R6)
- [X] T074 [P] [US3] Écrire `apps/web/tests/FeedbackList.test.tsx` : ordre reçu conservé ; nom et date formatés par `Intl` ; texte rendu sans interprétation HTML ; états chargement, vide et erreur avec « Réessayer » ; retours de la page courante signalés ; aucun signalement si la page est inconnue (FR-004) ; indicateurs `approximate` et `notFound` ; aucun statut de traitement ; audit axe (FR-014, FR-016, FR-017, FR-019)
- [X] T075 [P] [US3] Écrire `apps/web/tests/feedbackSelection.test.tsx` : sélectionner un retour de la page courante envoie `activeFeedbackId` ; `connector.markerActivated` met le retour en évidence et l'amène à l'écran ; sélectionner un retour d'une autre page propose d'y aller, et accepter modifie `src` de l'iframe puis active l'élément après `connector.ready` ; refuser ne change rien ; `connector.pageChanged` met à jour repères et signalement (FR-015, US3 scénarios 2, 4, 5)
- [X] T076 [P] [US3] Écrire `e2e/tests/us3-review.spec.ts` sur les trois moteurs et le projet mobile, retours créés par `POST /api/feedback` : scénarios d'acceptation 1 à 6 de US3 ; navigation par `pushState` et par rechargement complet ; `/changing-content` : indicateurs « élément approximatif » et « élément introuvable », aucune mise en évidence trompeuse (FR-016) ; `/no-connector` : liste présente sans signalement (FR-004) ; deux stakeholders voient les mêmes retours (FR-014, FR-019) ; audit axe avec le cadre du produit (SC-007)
- [X] T077 [US3] Exécuter `pnpm test` et `pnpm test:e2e e2e/tests/us3-review.spec.ts` et confirmer que les tests de cette phase échouent pour la bonne raison

### Implementation for User Story 3

- [X] T078 [P] [US3] Implémenter `packages/connector/src/pageTracker.ts` et le brancher dans `packages/connector/src/bridge.ts` ; faire passer T072
- [X] T079 [US3] Compléter `packages/connector/src/overlay.ts` et `packages/connector/src/bridge.ts` (nouvel essai à 500 ms, statuts, `activeFeedbackId`) ; faire passer T073
- [X] T080 [P] [US3] Implémenter `apps/web/src/features/feedback-list/FeedbackList.tsx` et les textes dans `apps/web/src/i18n/fr.ts` ; faire passer T074
- [X] T081 [US3] Implémenter `apps/web/src/features/feedback-list/useFeedbackSelection.ts` (dialogue de changement de page, `src` de l'iframe) ; faire passer T075
- [X] T082 [US3] Brancher la liste dans `apps/web/src/App.tsx` (rechargée à l'ouverture et après chaque dépôt, R15 ; panneau latéral sur bureau, section sous le produit sur mobile) et faire passer `e2e/tests/us3-review.spec.ts`

**Checkpoint**: les trois user stories fonctionnent.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: critères de succès, documentation et contrôles finaux.

- [X] T083 [P] Écrire `e2e/tests/performance.spec.ts` : surcoût d'affichage du produit dans l'outil inférieur à 3 s (SC-004) et confirmation d'un dépôt en moins de 2 s (SC-005), sur 20 mesures locales en 95e percentile. Ces mesures sont indicatives ; les confirmer sur l'environnement cible
- [X] T084 [P] Créer `README.md` : présentation, installation, liens vers [quickstart.md](./quickstart.md) et [product-integration.md](./contracts/product-integration.md), risques acceptés (FR-019, R13), HTTPS obligatoire, déploiement sur réseau privé recommandé
- [ ] T085 [P] Mener l'audit manuel d'accessibilité (clavier seul, lecteur d'écran, mobile) des parcours « déposer » et « consulter » et consigner le résultat dans `specs/001-iframe-feedback-highlight/checklists/accessibility-audit.md` (SC-007)
- [X] T086 [P] Rédiger le protocole de test utilisateur et de mesure dans `specs/001-iframe-feedback-highlight/checklists/user-testing.md` : temps avant le premier retour (SC-001), réussite à la première tentative (SC-002), baisse des questions de clarification lors des revues par rapport à une référence sans outil (SC-006). Ces trois critères exigent de vrais stakeholders et ne sont pas automatisables
- [X] T087 Relire `apps/` et `packages/` : aucun `any` ni `@ts-ignore` non justifiés, aucun texte hors i18n, aucun identifiant en français, aucune abstraction non prévue dans la section *Complexity Tracking* de `specs/001-iframe-feedback-highlight/plan.md`
- [X] T088 Dérouler `specs/001-iframe-feedback-highlight/quickstart.md` en entier et corriger tout écart entre ce guide et le comportement réel
- [ ] T089 Exécuter `pnpm lint && pnpm typecheck && pnpm build && pnpm test && pnpm test:e2e` et vérifier le résultat de `.github/workflows/ci.yml` sur la branche

---

## Dependencies & Execution Order

### Phase Dependencies

| Phase | Dépend de | Remarque |
|-------|-----------|----------|
| Setup | — | T001 à T003 en séquence, le reste en parallèle |
| Foundational | Setup | Bloque toutes les user stories |
| US1 | Foundational | Socle : poignée de main, iframe, liste de sites |
| US2 | US1 | Nécessite `connector.ready` et `ProductFrame` |
| US3 | US2 | Nécessite `POST /api/feedback`, `tool.setMarkers` et l'ancre ; US1 et US2 restent livrables sans US3 |
| Polish | Stories retenues | |

La spec demande des stories testables indépendamment. Elles le sont par leurs tests, mais pas constructibles dans n'importe quel ordre : l'annotation repose techniquement sur la connexion au produit, et la consultation sur les repères.

### Within Each User Story

- Tests d'abord, en échec, puis implémentation, puis tests au vert, puis refactorisation.
- Connecteur et API avant le branchement dans `App.tsx`.
- Les tâches qui modifient `apps/web/src/App.tsx`, `apps/web/src/i18n/fr.ts` ou `packages/connector/src/bridge.ts` ne sont jamais parallèles entre elles.

### Parallel Opportunities

- **Setup** : T004, T005, T006, T007, T008
- **Foundational** : tests T009, T010, T011, T015, T016, T017, T021, T022 ; puis T026
- **US1** : tous les tests de T028 à T035 ; puis T040 et T041
- **US2** : tous les tests de T045 à T057 ; puis T060, T061, T062 ; puis T066, T067, T068, T069
- **US3** : tous les tests de T072 à T076 ; puis T078 et T080
- **Polish** : T083, T084, T085, T086

## Parallel Example: User Story 2

```text
# Tests, chacun dans son fichier :
T045  apps/api/tests/contract/createFeedback.test.ts
T047  packages/connector/tests/anchor.test.ts
T049  packages/connector/tests/picker.test.ts
T056    apps/web/tests/FeedbackForm.test.tsx

# Puis modules indépendants du connecteur :
T060  packages/connector/src/anchor.ts
T061  packages/connector/src/cursor.ts
T062 packages/connector/src/overlay.ts
```

## Implementation Strategy

### MVP First

Le MVP utile est **US1 + US2** : US1 seule affiche le produit, sans recueillir de retour.

1. Setup et Foundational.
2. US1 : **s'arrêter et valider** les deux hypothèses de déploiement (session dans le cadre, noms de domaine des tests).
3. US2 : **s'arrêter et valider** le retour de focus, puis faire essayer le dépôt à un·e vrai·e stakeholder.

### Incremental Delivery

1. Après US1 : démonstration de l'affichage, et intégration du script sur un premier vrai produit, ce qui fait apparaître tôt les contraintes de `frame-ancestors` et de CSP.
2. Après US2 : premiers retours réels, déjà visibles par leurs repères sur leur page.
3. Après US3 : consultation complète, évitant les doublons.
4. Polish : mesures et audit.

## Notes

- Valider chaque checkpoint avant de passer à la phase suivante.
- Faire un commit après chaque tâche ou groupe logique, tests au vert.
- Les données de test ne dépendent ni de l'horloge, ni de l'ordre d'exécution, ni du réseau externe (principe I).
