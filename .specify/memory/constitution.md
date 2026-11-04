# Feedbacker Constitution

## Core Principles

### I. Test-First (NON NÉGOCIABLE)

- Le TDD est obligatoire : test écrit → test exécuté et en échec (Red) → implémentation minimale
  (Green) → refactorisation (Refactor).
- Aucun code de production NE DOIT être fusionné sans test qui l'a fait naître ; un correctif de
  bug DOIT commencer par un test qui reproduit le bug.
- Chaque user story DOIT avoir des tests d'acceptation indépendants ; les contrats d'API (routes,
  schémas de requête/réponse) DOIVENT avoir des tests de contrat.
- Les tests DOIVENT être déterministes : pas de dépendance à l'horloge, au réseau externe ou à
  l'ordre d'exécution sans isolation explicite.

**Rationale** : écrire le test d'abord force à préciser le comportement attendu avant le code et
garantit que chaque fonctionnalité reste vérifiable et protégée contre les régressions.

### II. Simplicité & YAGNI

- Implémenter uniquement ce qu'exige la spécification en cours ; aucune fonctionnalité,
  option ou abstraction « pour plus tard ».
- Toute couche, dépendance ou abstraction supplémentaire DOIT être justifiée dans le `plan.md`
  (section *Complexity Tracking*) avec l'alternative plus simple rejetée et la raison.
- Préférer les capacités natives de la plateforme et de la stack retenue avant d'ajouter une
  bibliothèque tierce.
- Une abstraction n'est introduite qu'à partir du troisième cas d'usage réel (règle de trois).

**Rationale** : un produit de feedback doit évoluer vite au contact des utilisateurs ; chaque
complexité non nécessaire ralentit cette boucle et augmente le coût de maintenance.

### III. Accessibilité & Expérience utilisateur

- Toute interface DOIT respecter WCAG 2.2 niveau AA : navigation complète au clavier, focus
  visible, contrastes conformes, libellés et rôles ARIA corrects, alternatives textuelles.
- Les parcours critiques (soumettre un feedback, le consulter, le traiter) DOIVENT être couverts
  par des tests d'accessibilité automatisés (ex. axe) en plus des tests fonctionnels.
- Tous les textes visibles DOIVENT passer par le système d'i18n ; aucune chaîne d'interface en
  dur dans les composants.
- L'UI DOIT rester cohérente : composants partagés d'un même design system, états de chargement,
  vide et erreur explicites pour chaque écran, messages d'erreur compréhensibles et actionnables.
- L'interface DOIT être responsive et utilisable sur mobile.

**Rationale** : un outil de collecte de feedback qui exclut une partie de ses utilisateurs
produit des retours biaisés ; l'accessibilité et la clarté sont des exigences produit, pas des
finitions.

### IV. Typage strict de bout en bout

- TypeScript en mode `strict` côté client et serveur ; `any` est interdit sauf justification
  commentée, et `@ts-ignore` est proscrit (utiliser `@ts-expect-error` avec explication).
- Les types des contrats (API, événements, schémas de données) DOIVENT être définis une seule
  fois et partagés entre front et back.
- Toute donnée entrant dans le système (requêtes HTTP, formulaires, variables d'environnement,
  webhooks) DOIT être validée à l'exécution par un schéma (ex. Zod) dont dérive le type statique.

**Rationale** : en full-stack TypeScript, un contrat typé unique supprime toute une classe
d'erreurs d'intégration entre front et back et rend les refactorisations sûres.

## Contraintes techniques

- **Langage** : TypeScript sur l'ensemble de la stack (front, API, scripts, tests).
- **Architecture** : application web SaaS (front + API + base relationnelle, PostgreSQL par
  défaut). Le choix précis des frameworks est arrêté et justifié dans le `plan.md` de chaque
  feature, dans le respect du principe II.
- **Langue du code** : tout le code est écrit en anglais (identifiants, types, constantes, noms
  de fichiers et de dossiers, noms de tests). Le français n'est autorisé que dans les
  commentaires, les textes destinés à l'utilisateur (catalogues i18n) et les données imposées par
  un contrat externe.
- **Dépendances** : toute nouvelle dépendance runtime DOIT être justifiée (besoin, alternatives,
  maintenance, licence) dans le plan ou la PR.
- **Secrets** : aucun secret dans le dépôt ; configuration par variables d'environnement validées
  au démarrage.

## Workflow de développement & Quality Gates

- Toute feature suit le flux Spec Kit : `/speckit-specify` → `/speckit-clarify` (si ambiguïtés)
  → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`.
- Le *Constitution Check* du `plan.md` DOIT être passé avant la phase de design et revérifié
  après ; toute dérogation est consignée dans *Complexity Tracking*.
- Dans `tasks.md`, les tâches de test DOIVENT précéder les tâches d'implémentation qu'elles
  couvrent (principe I).
- Une PR n'est fusionnable que si : lint, vérification de types (`tsc --noEmit`), tests
  unitaires, de contrat, d'intégration et d'accessibilité passent en CI.
- Chaque PR fait l'objet d'une revue qui vérifie explicitement la conformité aux quatre
  principes.

## Governance

- Cette constitution prévaut sur toute autre pratique ou convention du projet. En cas de
  conflit, elle s'applique et l'autre document doit être mis en conformité.
- **Amendements** : toute modification passe par `/speckit-constitution`, est documentée dans
  le rapport d'impact, revue dans une PR dédiée, et accompagnée d'un plan de migration si elle
  rend du code ou des specs existants non conformes.
- **Versionnage** (SemVer) :
  - MAJOR : suppression ou redéfinition incompatible d'un principe ou d'une règle de gouvernance ;
  - MINOR : ajout d'un principe ou d'une section, ou extension substantielle d'une règle ;
  - PATCH : clarification, reformulation, correction sans changement de sens.
- **Conformité** : chaque revue de PR et chaque `/speckit-analyze` vérifie le respect de la
  constitution ; toute complexité ou dérogation DOIT être justifiée par écrit.

**Version**: 1.0.0 | **Ratified**: 2026-11-04 | **Last Amended**: 2026-11-04
