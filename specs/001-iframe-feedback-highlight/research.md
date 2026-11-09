# Research: Retours visuels annotés sur un produit embarqué

**Date**: 2026-11-04 | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

Versions relevées sur le registre npm le 2026-11-04. « Mesuré » indique un test réellement exécuté ;
« À valider » indique une hypothèse à confirmer par le premier test de la tâche concernée.

## R1. Communication entre l'outil et le produit

- **Decision** : messages `postMessage` entre l'outil et un script (`connector.js`) chargé par le
  produit, avec vérification de `event.source` **et** `event.origin` des deux côtés, puis validation
  par schéma partagé. Poignée de main en trois messages : `connector.hello` (à l'initialisation),
  `tool.ping` (au `load` de l'iframe et en réponse au hello), `connector.ready`.
- **Rationale** : c'est le seul canal natif entre origines différentes. Le double déclencheur couvre
  les deux ordres possibles : un script exécuté avant le `load` de l'iframe (son hello serait sinon
  perdu par la remise à zéro au `load`) et un script `async` exécuté après.
- **Alternatives considered** :
  - Proxy réécrivant le produit pour injecter le script : pas d'intégration à faire, mais casse
    connexion et CSP et ouvre un risque de sécurité important. Rejeté.
  - Extension navigateur : à installer par chaque stakeholder. Rejeté.

## R2. Détection d'un produit qui ne répond pas (FR-004)

- **Decision** : minuteur de 10 s armé au montage de l'iframe et à chaque `load`, annulé par
  `connector.ready`. À l'expiration, message unique. Une réponse tardive efface le message.
- **Rationale** : un refus d'affichage (`X-Frame-Options`, `frame-ancestors`) déclenche quand même
  `load` et ne lève aucune erreur lisible depuis un autre domaine. La cause n'est donc pas
  observable, conformément à la clarification de la session 2026-11-04.
- **Alternatives considered** : diagnostic côté serveur, rejeté en clarification.

## R3. Dessin de la mise en évidence

- **Decision** : le connecteur dessine dans le produit, dans un Shadow DOM placé dans la *top layer*
  (`popover="manual"`), styles posés par CSSOM. Position recalculée à chaque `requestAnimationFrame`
  tant qu'une mise en évidence ou un repère est visible.
- **Rationale** : le dessin suit nativement le défilement, y compris les conteneurs internes, sans
  décalage de message. Le Shadow DOM isole des styles du produit ; la *top layer* passe au-dessus
  des `z-index` et des `<dialog>` modaux ; le CSSOM n'est pas bloqué par un `style-src` strict du
  produit. La boucle rAF couvre aussi animations et transformations, et le navigateur la suspend
  dans un onglet caché.
- **Alternatives considered** :
  - Calque dans l'outil au-dessus de l'iframe, alimenté par des rectangles envoyés : un message par
    image de défilement, décalage visible, découpe impossible à reproduire. Rejeté.
  - Écouteurs `scroll`, `resize` et observateurs : plus de code, et les animations CSS échappent
    à la détection. Rejeté.

## R4. Sélection d'élément à la souris et au toucher

- **Decision** : écouteurs en phase de capture sur `window`, actifs seulement en mode annotation.
  `click`, `pointerdown`, `pointerup`, `mousedown`, `mouseup`, `auxclick` et `dragstart` sont bloqués.
  Un toucher sélectionne via le `click` synthétisé.
- **Rationale** : le produit ne réagit pas et le défilement natif reste possible (molette, toucher,
  conteneurs internes), ce qu'un écran transparent plein cadre empêcherait.
- **Limites acceptées** : un écouteur de capture posé sur `window` par le produit avant le
  connecteur s'exécute quand même. Un élément dans un Shadow DOM ou une iframe imbriquée est ciblé
  au niveau de son hôte.

## R5. Sélection au clavier et accessibilité (FR-009, WCAG 2.2 AA)

- **Decision** : le focus reste dans l'outil. Une barre d'outils (`role="toolbar"`, boutons et
  flèches) envoie `tool.moveCursor` (`next`, `previous`, `parent`, `child`) et `tool.confirmCursor`.
  Le connecteur déplace son curseur, fait défiler l'élément à l'écran et renvoie sa description, que
  l'outil annonce dans une région `aria-live`. Seule `Échap` est écoutée dans le produit.
- **Rationale** : la navigation clavier ne dépend pas du focus à travers l'iframe, les libellés
  restent dans l'i18n de l'outil, et les mêmes boutons servent à élargir ou réduire une sélection
  (cas limite des éléments imbriqués) et au toucher.
- **Conséquence** : le connecteur ne contient aucun texte. Les libellés des repères lui sont
  transmis par l'outil.
- **Validé le 2026-11-04** (tests e2e de US2) : le focus revient de l'iframe vers le formulaire après une
  sélection à la souris, sur Chromium, Firefox et WebKit.
- **À noter** : par défaut, `Tab` n'atteint pas les boutons sous Safari (réglage du navigateur, `Option+Tab`).
  C'est un comportement standard de ce navigateur, pas un défaut de l'outil.

## R6. Retrouver un élément annoté (FR-016)

- **Decision** : ancre composée d'un sélecteur CSS généré, du nom de balise, d'un extrait de 120
  points de code au plus et du rectangle au moment de la saisie. Le sélecteur privilégie
  `data-feedback-anchor`, `data-testid`, `data-test`, `data-cy`, puis `id` s'il ne paraît pas généré
  (pas de chiffres ni de `:`), puis un chemin `nth-of-type`. Les classes sont ignorées, car souvent
  générées par les outils CSS.

  | Résultat | Condition | Affichage |
  |----------|-----------|-----------|
  | `exact` | Sélecteur unique, balise et extrait identiques | Repère et mise en évidence |
  | `approximate` | Sélecteur unique mais extrait différent, ou sélecteur en échec et extrait unique sur la même balise | Repère et indicateur « élément approximatif » |
  | `notFound` | Sinon | Pas de repère, indicateur « élément introuvable » |

- **Rationale** : indiquer plutôt que tromper. Le rectangle n'est jamais utilisé pour dessiner une
  mise en évidence ; il sert de contexte conservé. Un nouvel essai a lieu toutes les 500 ms pour
  les contenus apparaissant après le chargement.
- **Alternatives considered** : `@medv/finder` : efficace, mais une dépendance de plus dans un script
  chargé par chaque produit pour environ 40 lignes testables (principe II). XPath : plus fragile
  face aux changements de structure.

## R7. Suivi de la page courante

- **Decision** : le connecteur lit `location.pathname` toutes les 500 ms et envoie
  `connector.pageChanged` en cas de changement. Le retour est rattaché au chemin, sans paramètres ni
  fragment.
- **Rationale** : marche avec toute application sans modifier `history`, ce qui respecte FR-006b. La
  Navigation API n'est pas utilisable seule si tous les navigateurs cibles ne la proposent pas.
- **Limite** : une application routée uniquement par fragment (`#/...`) compte pour une seule page.

## R8. Sécurité avec un outil sans contrôle d'accès

- **Decision** :
  - Liste de sites `ALLOWED_PRODUCT_ORIGINS` (origines exactes, sans joker) vérifiée par l'API.
  - Le navigateur l'applique aussi via `Content-Security-Policy: frame-src <liste>` servi avec l'outil.
  - `GET /api/feedback` répond 403 hors liste : l'interface s'en sert pour refuser le chargement, sans
    exposer la liste à quiconque (l'outil étant ouvert à tous).
  - Le connecteur déduit l'origine de l'outil de `document.currentScript.src` et reste inactif
    (ni écouteur de page, ni minuteur, ni DOM) tant qu'il n'a pas reçu un message vérifié de cette
    origine (FR-006b).
- **Conséquence voulue** : `frame-src` bloque aussi une navigation dans l'iframe vers un site hors
  liste. C'est cohérent avec FR-003a et avec le cas limite du fournisseur d'identité externe
  (connexion dans un onglet séparé).
- **Alternatives considered** :
  - `sandbox` sur l'iframe : `allow-scripts` et `allow-same-origin` sont indispensables et annulent
    l'essentiel de la protection, au risque de casser le produit (FR-002). Rejeté.
  - Limitation de débit : risque d'abus accepté par la spec (FR-019), non implémenté. Seule une
    limite de taille de requête (64 Kio) est conservée.
- **Point de déploiement** : un produit en `http` dans un outil en `https` est bloqué par le
  navigateur (contenu mixte). L'outil doit être en HTTPS et les produits aussi.

## R9. Produits avec connexion

- **Decision** : outil et produit sur le même domaine parent (par exemple `feedback.example.com` et
  `app.example.com`). Le produit doit autoriser l'outil dans `frame-ancestors` : `X-Frame-Options:
  SAMEORIGIN` le bloque, car deux sous-domaines sont de même site mais pas de même origine.
- **Rationale** : même site, donc les cookies `SameSite=Lax` et `Strict` sont envoyés et non
  partitionnés.
- **Validé le 2026-11-04** (mesuré avec Playwright, cookie `SameSite=Lax` posé par un formulaire dans le cadre) :

  | Domaines | Chromium | Firefox | WebKit |
  |----------|----------|---------|--------|
  | `feedback.fixture.localhost`, `app.fixture.localhost` | Session conservée | Session conservée | **Cookie bloqué** |
  | `feedback.lvh.me`, `app.lvh.me` (vrai domaine enregistrable) | Session conservée | Non mesuré | Session conservée |

  Le choix du même domaine parent est donc confirmé, y compris sous WebKit. Le blocage ne concerne que les
  noms de test en `.localhost`, que WebKit ne considère pas comme un même site. Le test e2e de connexion est
  donc ignoré sous WebKit ; le faire tourner y demanderait un réseau externe, ce que le principe I interdit.
  Ces noms se résolvent sans configuration sur les trois moteurs : aucune règle d'hôte n'est nécessaire.

## R10. Taille et validation du connecteur

- **Decision** : `zod/mini`, avec `import * as z from "zod/mini"` imposé par règle ESLint pour tout
  `packages/contracts`. Budget testé en CI : `connector.js` ≤ 25 Kio gzip.
- **Rationale** : **mesuré** avec esbuild sur un schéma représentatif du protocole :

  | Import | Minifié | Gzip |
  |--------|---------|------|
  | `import { z } from "zod/mini"` | 428 Ko | 85,8 Ko |
  | `import * as z from "zod/mini"` | 22,4 Ko | 7,6 Ko |

  La première forme empêche le *tree-shaking*, d'où la règle. Le schéma unique respecte le principe IV.
- **Alternatives considered** : gardes de type écrites à la main : plus légères, mais deuxième
  définition du contrat, ce que le principe IV interdit.

## R11. Pile technique

| Choix | Version | Justification | Alternatives rejetées |
|-------|---------|---------------|----------------------|
| Node.js | 22 LTS | Version installée et encore maintenue (jusqu'en avril 2027) | — |
| TypeScript | 6.0 | `typescript-eslint` exige `<6.1.0` : la version 7.0 est donc exclue pour l'instant | TS 7 : pas de lint typé |
| pnpm workspaces | 10 | Paquets partagés sans outil de monorepo | Turborepo, Nx : inutiles à cette taille |
| React + Vite | 19 / 8 | React imposé par la demande ; une seule page, sans SSR | Next.js : SSR et routage inutiles |
| Fastify | 5 | `inject` pour les tests de contrat sans port réseau ; limite de corps native ; journaux intégrés | Express : moins de fonctions natives ; Hono : équivalent, écosystème statique moins direct |
| @fastify/static | 10 | Sert l'interface et `connector.js` depuis le même processus, donc même origine et aucun CORS | Nginx séparé : un composant de plus |
| pg + SQL | 8 | Une seule table et deux requêtes | Prisma, Drizzle : abstraction injustifiée ici |
| node-pg-migrate | 9 | Migrations SQL versionnées et maintenues | Exécuteur maison : à maintenir et tester |
| Zod | 4 | Principe IV ; `zod/mini` pour le poids (R10) | Valibot : équivalent, Zod est cité par la constitution |
| PostgreSQL | 17 | Imposé par la demande ; version maintenue | — |

Sans dépendance : état React natif (une page, deux requêtes), `URLSearchParams` au lieu d'un routeur,
`<dialog>` natif, CSS simple avec variables, i18n (voir R12).

**Outils de développement** : Vitest 5 et Testing Library 16 ; `axe-core` directement avec un petit
assistant de test (`vitest-axe` n'a pas été mis à jour depuis janvier 2025) ; Playwright 1.64 et
`@axe-core/playwright` ; ESLint 9 (`eslint-plugin-react` n'accepte pas encore ESLint 10) et
`typescript-eslint` 8.

## R12. Internationalisation

- **Decision** : dictionnaire `fr` typé et fonction `t(key, params)` d'environ 20 lignes, avec `Intl`
  pour dates et pluriels. `react/jsx-no-literals` interdit le texte en dur.
- **Rationale** : la spec n'exige que le français par défaut et des textes traduisibles. Les clés
  typées détectent les oublis à la compilation (principes II et IV).
- **Alternatives considered** : `react-i18next` : détection de langue et chargement à la demande sans
  usage ici.

## R13. Données personnelles et conservation

- **Decision** :
  - L'extrait de texte ne lit jamais la valeur d'un champ de formulaire. Pour un champ : `aria-label`,
    puis `placeholder`, puis `name`.
  - Extrait limité à 120 points de code.
  - Aucun écran de suppression (hors périmètre de la spec) : la suppression sur demande se fait par
    requête SQL, documentée dans le quickstart.
  - Les journaux ne contiennent ni texte de retour, ni nom d'auteur·rice.
- **Risque restant, à arbitrer par le porteur du projet** : un extrait peut contenir une donnée
  personnelle affichée par le produit (un nom de client), lisible par quiconque accède à l'outil.
  Le risque est surtout réel si des produits de production sont annotés sans déploiement privé.

## R14. Fiabilité du contenu enregistré (SC-003)

- **Decision** :
  - Identifiant généré par le client (`crypto.randomUUID()`) ; `INSERT ... ON CONFLICT DO NOTHING`.
    Une nouvelle tentative après réponse perdue ne crée pas de doublon.
  - Le schéma partagé refuse `\u0000` et les chaînes mal formées (`isWellFormed()`), que PostgreSQL
    rejette en `text` et en `jsonb` : sans cela, ces entrées provoqueraient une erreur 500. Le
    connecteur tronque l'extrait par point de code pour ne jamais couper une paire de surrogats.
  - `crypto.randomUUID()` exige un contexte sécurisé : HTTPS en production, `localhost` en local.

## R15. Actualisation et volume

- **Decision** : liste rechargée à l'ouverture et après chaque dépôt ; pas de pagination, conformément
  à FR-014 (« tous les retours »). Un index couvre le tri.
- **Rationale** : principe II ; volume attendu de quelques centaines de retours par site au plus.
  L'hypothèse est à revoir si l'outil est exposé publiquement, car FR-019 n'empêche pas le remplissage.
