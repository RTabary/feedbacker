# Contract: protocole outil ↔ connecteur

Schémas de référence : `packages/contracts/src/protocol.ts`, écrits avec `zod/mini`
(`import * as z from "zod/mini"`, voir [research.md](../research.md) R10). Chaque message a un test de
contrat, et les deux côtés valident avec le même schéma.

## Enveloppe

Tout message contient `{ source: "feedbacker", version: 1, type: "..." }`. Un message sans
`source: "feedbacker"` est ignoré silencieusement (autres scripts de la page). Une version différente
est traitée comme une absence de réponse.

## Règles de confiance

| Côté | Accepte un message si | Envoie avec `targetOrigin` |
|------|----------------------|----------------------------|
| Outil | `event.source === iframe.contentWindow` et `event.origin ===` origine de l'adresse du lien, et schéma valide | Origine de l'adresse du lien |
| Connecteur | `event.source === window.parent` et `event.origin ===` origine de `connector.js`, et schéma valide | Origine de `connector.js` |

`targetOrigin` n'est jamais `*`. Si le produit redirige vers un autre site, les messages n'arrivent
pas et l'outil affiche le message d'absence de réponse.

## Messages du connecteur vers l'outil

| Type | Champs | Quand |
|------|--------|-------|
| `connector.hello` | — | Une fois, à l'exécution du script |
| `connector.ready` | `path` | En réponse à `tool.ping` |
| `connector.pageChanged` | `path` | Changement de `location.pathname` |
| `connector.cursorMoved` | `tagName`, `textExcerpt` | Survol ou déplacement du curseur en mode annotation |
| `connector.elementSelected` | `anchor`, `displayContext`, `path` | Clic, toucher ou `tool.confirmCursor` |
| `connector.selectionCancelled` | — | `Échap` dans le produit en mode annotation |
| `connector.markerActivated` | `feedbackId` | Activation d'un repère |
| `connector.markersResolved` | `statuses: [{ feedbackId, status }]` | Après `tool.setMarkers`, et à chaque changement de statut |

`status` vaut `exact`, `approximate` ou `notFound`.

## Messages de l'outil vers le connecteur

| Type | Champs | Effet |
|------|--------|-------|
| `tool.ping` | — | Répond par `connector.ready` ; active le connecteur au premier message vérifié |
| `tool.setAnnotationMode` | `enabled` | Pose ou retire les écouteurs de sélection (voir R4) |
| `tool.moveCursor` | `direction`: `next`, `previous`, `parent`, `child` | Déplace le curseur et fait défiler l'élément à l'écran |
| `tool.confirmCursor` | — | Sélectionne l'élément sous le curseur |
| `tool.clearSelection` | — | Retire la mise en évidence de la sélection en cours |
| `tool.setMarkers` | `markers: [{ feedbackId, ordinal, label, anchor }]`, `activeFeedbackId` | Remplace les repères de la page ; `label` est le nom accessible du repère, traduit par l'outil |

Changer de page depuis l'outil se fait en modifiant `src` de l'iframe : aucun message n'est nécessaire.

## Séquences

### Connexion

```text
Outil                                Connecteur
  | -- monte l'iframe, minuteur 10 s --> |
  |                 <-- connector.hello  |  (peut arriver avant le load)
  | tool.ping -->                        |  (au hello et à chaque load)
  |                 <-- connector.ready  |  (annule le minuteur)
  | tool.setMarkers -->                  |
  |          <-- connector.markersResolved
```

Un `connector.ready` arrivé après l'expiration du minuteur efface le message et active l'annotation.
Chaque `load` remet l'état à « en attente » et réarme le minuteur (FR-006a).

### Dépôt d'un retour

```text
tool.setAnnotationMode(true)  -->
                              <--  connector.cursorMoved*          (annoncé en aria-live)
tool.moveCursor(...)*         -->                                  (option clavier/toucher)
tool.confirmCursor            -->                                  (ou clic dans le produit)
                              <--  connector.elementSelected       (formulaire ouvert, focus dessus)
tool.setAnnotationMode(false) -->
   ... POST /api/feedback ...
tool.clearSelection           -->
tool.setMarkers(mise à jour)  -->
```

## Exigences de comportement du connecteur

| Exigence | Règle | Test |
|----------|-------|------|
| FR-006b | Si `window.parent === window`, aucun écouteur ni minuteur, et rien dans le DOM | Unitaire |
| FR-006b | Avant le premier message vérifié, un seul écouteur `message`, aucun minuteur, rien dans le DOM | Unitaire |
| FR-005 | Hors mode annotation, aucun blocage d'événement ; le produit réagit normalement | e2e |
| R10 | `connector.js` ≤ 25 Kio gzip | CI |
| R13 | `textExcerpt` ne contient jamais la valeur d'un champ de formulaire | Unitaire |
| Principe III | Aucun texte en dur ; les repères utilisent `label` et `ordinal` | Revue et unitaire |
