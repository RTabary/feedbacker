# Audit d'accessibilité : déposer et consulter un retour

**Critère couvert** : SC-007 de [spec.md](../spec.md). **Statut : audit automatisé fait ; contrôle au lecteur
d'écran à mener par une personne.**

## Audit automatisé (fait le 2026-11-04)

Résultat : aucune violation A ou AA signalée par axe (règles `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`,
`wcag22aa`), cadre du produit inclus, sur Chromium, Firefox, WebKit et le projet mobile. Voir
`e2e/tests/us1-display.spec.ts`, `us2-annotate.spec.ts`, `us3-review.spec.ts`.

Un outil automatisé ne détecte qu'une partie des problèmes d'accessibilité : ce résultat ne suffit pas à
conclure à la conformité WCAG 2.2 AA.

## Contrôles simulés par les tests e2e (fait le 2026-11-04)

- [x] Parcours de dépôt complet au clavier, avec élargissement vers le parent
- [x] Focus placé sur la barre d'outils, puis sur le formulaire après la sélection
- [x] Description de l'élément écrite dans une région `aria-live`
- [x] Parcours de dépôt au toucher, en 375 × 812

## Contrôles à mener par une personne

- [ ] VoiceOver avec Safari : la description de l'élément est bien annoncée pendant les déplacements
- [ ] NVDA avec Firefox ou Chrome : mêmes contrôles
- [ ] Les repères dans le cadre du produit sont trouvés et annoncés avec leur nom
- [ ] L'indication de focus reste visible sur les repères, y compris sur un produit à fond sombre
- [ ] Zoom à 200 % et à 400 % : pas de contenu masqué ni de perte de fonction
- [ ] Vrai appareil mobile, avec TalkBack ou VoiceOver
- [ ] Contraste des repères et des contours sur un produit réel à fond sombre

## Point à surveiller

Le mode annotation ajoute une barre au-dessus du produit, ce qui décale le produit vers le bas au moment de
l'activation. À évaluer avec des utilisateur·rices.
