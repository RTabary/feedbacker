# Feature Specification: Retours visuels annotés sur un produit embarqué

**Feature Branch**: `claude/feedback-tool-interface-highlight-284490`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "je veux mettre en place un outil qui charge une iframe avec une url définie en paramètre et l'affiche dans une interface react. Le but est que des stakeholders puissent faire des retours sur un produit en ayant la possibilité de highlight certaines parties de l'interface et ecrire un retour lié a cette partie. Le feedback devra etre sauvegardé en bdd postgres"

## Clarifications

### Session 2026-11-04

- Q: Qui peut ouvrir l'outil de feedback, lire les retours et en déposer ? → A: Ouvert à tous, aucun contrôle d'accès.
- Q: Quelles adresses l'outil a-t-il le droit d'afficher ? → A: Uniquement les sites listés dans la configuration de déploiement.
- Q: Quand un stakeholder navigue dans le produit, quels retours l'outil doit-il lui montrer ? → A: Tous les retours du site, ceux de la page courante étant signalés et seuls à avoir un repère à l'écran.
- Q: Les produits à évaluer demandent-ils une connexion ? → A: Oui, et l'outil est déployé sur le même domaine parent que ces produits.
- Q: Que doit faire l'outil quand le produit affiché ne répond pas à l'appel de son module de connexion ? → A: Après 10 secondes, il désactive l'annotation et affiche un message unique citant les causes possibles, sans chercher à les distinguer.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Afficher le produit à commenter depuis un lien (Priority: P1)

Un·e stakeholder reçoit un lien vers l'outil de feedback. Ce lien contient l'adresse du produit à
évaluer. En l'ouvrant, la personne voit le produit s'afficher, utilisable normalement (navigation,
clics, défilement), entouré des commandes de l'outil de feedback.

**Why this priority**: sans affichage du produit cible, aucune autre fonctionnalité n'a de sens ;
c'est le socle de toute la démarche de retour.

**Independent Test**: ouvrir l'outil avec l'adresse d'un produit de démonstration en paramètre et
vérifier que le produit s'affiche et reste interactif ; ouvrir l'outil sans adresse ou avec une
adresse invalide et vérifier qu'un message explicite est affiché.

**Acceptance Scenarios**:

1. **Given** un lien contenant l'adresse valide d'un produit accessible, **When** le·la stakeholder
   ouvre le lien, **Then** le produit s'affiche dans l'espace de travail et reste utilisable.
2. **Given** un lien sans adresse de produit, **When** il est ouvert, **Then** un message indique
   qu'aucun produit n'est spécifié et explique comment obtenir un lien valide.
3. **Given** un lien dont l'adresse est mal formée ou n'utilise pas un protocole web autorisé,
   **When** il est ouvert, **Then** le produit n'est pas chargé et un message d'erreur
   compréhensible est affiché.
4. **Given** un lien dont l'adresse pointe vers un site absent de la liste des sites autorisés,
   **When** il est ouvert, **Then** le produit n'est pas chargé et un message indique que ce site
   n'est pas autorisé dans l'outil.
5. **Given** un produit avec connexion, sur le même domaine parent que l'outil, **When** la personne
   ouvre le lien, **Then** sa session existante est reconnue ou, à défaut, elle peut se connecter
   au produit depuis l'outil.
6. **Given** un produit qui ne répond pas à l'appel de l'outil dans les 10 secondes (affichage refusé,
   indisponible, lent ou sans module de connexion), **When** le délai expire, **Then** l'outil
   affiche un message unique citant ces causes possibles et ce qu'il faut demander à l'équipe
   produit ; les retours existants restent listés.

---

### User Story 2 - Surligner un élément et rédiger un retour (Priority: P1)

Le·la stakeholder active le mode « annotation », sélectionne un élément de l'interface du produit
qui l'intéresse ; l'élément est mis en évidence visuellement. Un formulaire s'ouvre pour rédiger
le retour associé à cet élément. À la validation, le retour est enregistré de façon durable et
l'élément reste marqué par un repère.

**Why this priority**: c'est la valeur centrale demandée — lier un commentaire à une partie précise
de l'interface pour lever toute ambiguïté sur « de quoi parle ce retour ».

**Independent Test**: sur un produit affiché, activer l'annotation, sélectionner un élément, saisir
un texte, valider ; recharger la page et vérifier que le retour et son élément annoté sont toujours présents.

**Acceptance Scenarios**:

1. **Given** le produit affiché (intégrant le module de connexion) et le mode annotation activé,
   **When** la personne sélectionne un élément de l'interface, **Then** cet élément est
   visuellement mis en évidence et un formulaire de retour s'ouvre.
2. **Given** un élément sélectionné et un texte saisi, **When** la personne valide, **Then** le
   retour est enregistré avec son élément annoté, l'adresse du produit, son auteur·rice et sa date, et une
   confirmation est affichée.
3. **Given** un élément sélectionné, **When** la personne annule, **Then** aucun retour n'est
   enregistré et la mise en évidence disparaît.
4. **Given** un formulaire avec un texte vide, **When** la personne tente de valider, **Then** la
   validation est refusée avec un message indiquant que le texte est requis.
5. **Given** un échec d'enregistrement (perte de connexion, service indisponible), **When** la
   personne valide, **Then** un message d'erreur s'affiche, le texte saisi est conservé et la
   personne peut réessayer.
6. **Given** le mode annotation désactivé, **When** la personne interagit avec le produit,
   **Then** le produit réagit normalement, sans déclencher de sélection.
7. **Given** un produit qui n'a pas répondu à l'appel de l'outil, **When** le délai de 10 secondes
   expire, **Then** le mode annotation est indisponible.
8. **Given** le mode annotation indisponible après ce délai, **When** le produit répond plus tard,
   **Then** le message disparaît et le mode annotation devient disponible, sans recharger.
9. **Given** une personne qui n'a encore jamais déposé de retour, **When** elle valide son
   premier retour, **Then** son nom lui est demandé, puis réutilisé automatiquement pour ses
   retours suivants.

---

### User Story 3 - Revoir les retours existants sur le produit (Priority: P2)

En revenant sur le produit, la personne voit la liste de tous les retours déjà déposés sur ce site,
ceux de la page affichée étant signalés et repérés à l'écran. Sélectionner un retour de la page
courante met en évidence l'élément annoté, et inversement ; sélectionner un retour d'une autre page
propose de s'y rendre.

**Why this priority**: permet d'éviter les doublons et de vérifier qu'un retour a bien été pris en
compte ; utile mais le dépôt de retours (P1) apporte déjà de la valeur seul.

**Independent Test**: créer deux retours sur deux pages d'un même site, rouvrir l'outil et vérifier
que les deux retours apparaissent, que seul celui de la page courante a un repère à l'écran et que
sélectionner l'autre propose de changer de page.

**Acceptance Scenarios**:

1. **Given** des retours existants pour un site, **When** l'outil est ouvert sur n'importe quelle
   page de ce site, **Then** tous ses retours s'affichent, triés du plus récent au plus ancien,
   ceux de la page courante étant signalés.
2. **Given** la liste affichée, **When** la personne sélectionne un retour de la page courante,
   **Then** l'élément annoté est mis en évidence sur le produit.
3. **Given** aucun retour existant, **When** l'outil est ouvert, **Then** un état vide explicite
   invite à créer le premier retour.
4. **Given** la liste affichée, **When** la personne sélectionne un retour d'une autre page, **Then**
   l'outil propose d'aller sur cette page puis, si elle accepte, y met en évidence l'élément annoté.
5. **Given** la personne navigue vers une autre page du produit, **When** la nouvelle page s'affiche,
   **Then** les repères et le signalement de la liste sont mis à jour pour cette page.
6. **Given** des retours déposés par plusieurs stakeholders sur le même site, **When** l'un·e
   d'eux ouvre l'outil, **Then** tous les retours du produit sont visibles, chacun avec le nom de
   son auteur·rice ; aucun statut de traitement n'est affiché ni modifiable.

---

### Edge Cases

- Le produit affiché change de page (navigation interne) : le retour doit rester rattaché à la
  page/l'écran sur lequel il a été créé, et non à la seule page d'entrée.
- La personne fait défiler le produit ou redimensionne la fenêtre après avoir créé un retour : la
  mise en évidence suit l'élément annoté.
- L'interface du produit a évolué depuis la création d'un retour (élément déplacé ou supprimé) :
  le retour reste consultable, avec un indicateur « élément approximatif » ou « élément introuvable ».
- Retour très long : une limite de longueur est appliquée avec un compteur visible.
- La connexion au produit passe par un fournisseur d'identité externe qui refuse l'affichage
  embarqué : la personne se connecte d'abord au produit dans un onglet séparé, puis revient à
  l'outil, où sa session est reconnue.
- La session du produit expire pendant la rédaction d'un retour : le texte saisi est conservé
  dans l'outil et le retour peut être enregistré après reconnexion.
- Le produit affiché n'intègre pas le module de connexion, ou seulement sur certaines pages (par
  exemple pas sur sa page de connexion) : traité comme une absence de réponse (FR-004), le mode
  annotation redevenant disponible dès qu'une page répond.
- Éléments imbriqués (un texte dans un bouton dans une carte) : la personne doit pouvoir élargir
  ou réduire la sélection vers l'élément parent/enfant avant de valider.
- Deux personnes commentent le même élément simultanément : les deux retours sont conservés
  indépendamment.
- Le produit cible est lent ou indisponible : un état de chargement puis le message de FR-004 sont
  affichés, sans bloquer l'accès aux retours existants.
- Utilisation au clavier uniquement : la sélection d'un élément et la saisie d'un retour doivent
  être possibles sans souris.
- Utilisation sur mobile/tablette : la sélection d'un élément doit fonctionner au toucher.

## Requirements *(mandatory)*

### Functional Requirements

**Affichage du produit**

- **FR-001**: Le système DOIT accepter l'adresse du produit à évaluer comme paramètre du lien
  d'accès à l'outil.
- **FR-002**: Le système DOIT afficher le produit à l'adresse donnée dans un espace de travail
  où il reste pleinement utilisable (navigation, saisie, défilement).
- **FR-002a**: Le parcours de connexion d'un produit qui en demande un DOIT rester utilisable dans
  l'espace de travail lorsque l'outil et le produit partagent le même domaine parent.
- **FR-003**: Le système DOIT refuser de charger toute adresse absente, mal formée ou n'utilisant
  pas un protocole web (http/https), avec un message explicite.
- **FR-003a**: Le système DOIT n'afficher que les produits dont le site figure dans une liste de
  sites autorisés définie dans la configuration de déploiement. Toute autre adresse DOIT être
  refusée avec un message explicite, et aucun retour NE DOIT pouvoir être enregistré pour elle.
- **FR-004**: Si le produit affiché ne répond pas à l'appel de l'outil dans les 10 secondes, le
  système DOIT afficher un message unique citant les causes possibles (affichage refusé, produit
  indisponible ou lent, module de connexion absent) et ce qu'il faut demander à l'équipe produit,
  sans prétendre identifier la cause. Le produit DOIT rester à l'écran et les retours existants
  listés, sans signalement de la page courante, celle-ci étant inconnue.

**Annotation**

- **FR-005**: Les utilisateur·rices DOIVENT pouvoir activer et désactiver un mode annotation ;
  hors de ce mode, aucune interaction avec le produit ne déclenche de sélection.
- **FR-006**: En mode annotation, les utilisateur·rices DOIVENT pouvoir désigner un élément précis
  de l'interface du produit (bouton, bloc, champ, image…) : l'élément survolé ou ayant le focus
  est pré-signalé, et l'élément choisi DOIT être mis en évidence visuellement en suivant sa
  position réelle (défilement, redimensionnement).
- **FR-006a**: L'annotation d'éléments DOIT reposer sur un module de connexion fourni par l'outil
  et intégré par l'équipe produit dans le produit évalué. Le mode annotation DOIT rester désactivé
  tant que le module de la page affichée n'a pas répondu (FR-004), et s'activer dès sa réponse, y
  compris après le délai de 10 secondes ou après une navigation.
- **FR-006b**: Le module de connexion NE DOIT communiquer qu'avec l'outil de feedback qui
  l'affiche et ne DOIT avoir aucun effet visible ni fonctionnel sur le produit lorsqu'il n'est
  pas affiché dans l'outil.
- **FR-007**: Le système DOIT permettre de rédiger un retour textuel associé à l'élément désigné ;
  le texte est obligatoire et limité à 5 000 caractères.
- **FR-008**: Les utilisateur·rices DOIVENT pouvoir annuler une annotation en cours sans qu'aucun
  retour ne soit enregistré.
- **FR-009**: La désignation d'un élément et la rédaction d'un retour DOIVENT être réalisables au
  clavier seul et au toucher.

**Enregistrement**

- **FR-010**: Le système DOIT enregistrer de façon durable chaque retour validé avec : texte,
  description de l'élément annoté, adresse du produit, page/écran du produit concerné au moment
  de la saisie, dimensions de l'affichage au moment de la saisie, auteur·rice et date de création.
- **FR-011**: Le système DOIT confirmer explicitement l'enregistrement d'un retour, ou signaler
  son échec en conservant le texte saisi pour permettre une nouvelle tentative.
- **FR-012**: Le système DOIT associer à chaque retour le nom de son auteur·rice, saisi
  librement (sans compte ni vérification, 1 à 100 caractères). Le nom est demandé avant le
  premier retour, mémorisé sur l'appareil de la personne pour les retours suivants, et modifiable
  à tout moment.
- **FR-013**: Le système DOIT valider toutes les données reçues (adresse, élément annoté, texte, identité)
  avant enregistrement et rejeter les données invalides avec un message compréhensible.

**Consultation**

- **FR-014**: Le système DOIT afficher à toute personne ouvrant l'outil sur une page d'un produit
  la liste de tous les retours existants pour ce site, quel que soit leur auteur·rice, du plus
  récent au plus ancien, en signalant ceux de la page courante. Aucun statut de traitement n'est
  géré.
- **FR-015**: Seuls les retours de la page courante DOIVENT avoir un repère à l'écran. Sélectionner
  un de ces retours DOIT mettre en évidence l'élément annoté, et sélectionner un repère DOIT mettre
  en évidence le retour dans la liste. Sélectionner un retour d'une autre page DOIT proposer d'aller
  sur cette page.
- **FR-016**: Lorsque l'élément annoté d'un retour ne peut plus être retrouvé de façon fiable sur
  sa page (produit modifié, contenu différent), le système DOIT l'indiquer plutôt que d'afficher
  une mise en évidence trompeuse.

**Accès**

- **FR-019**: L'outil NE DOIT imposer aucun contrôle d'accès : toute personne qui ouvre l'outil
  peut consulter les retours d'un produit et en déposer, sans compte, clé ni code.

**Qualité d'interface**

- **FR-017**: Chaque écran DOIT présenter des états de chargement, vide et erreur explicites.
- **FR-018**: L'interface de l'outil DOIT être conforme WCAG 2.2 niveau AA et utilisable sur
  mobile ; tous ses textes DOIVENT être traduisibles (français par défaut).

### Key Entities *(include if feature involves data)*

- **Produit évalué** : identifié par son site (protocole, domaine et port) : la recette et la
  production d'une même application sont donc deux produits distincts. Regroupe tous les retours
  déposés sur ce site.
- **Page** : subdivision d'un produit, identifiée par le chemin de son adresse, sans paramètres ni
  fragment. Chaque retour est rattaché à une page.
- **Retour (Feedback)** : commentaire textuel d'un·e stakeholder ; attributs : texte, date de
  création, auteur·rice, produit/page concernés, élément annoté, contexte d'affichage (dimensions de
  la fenêtre, position de défilement).
- **Élément annoté** : élément de l'interface du produit désigné par l'auteur·rice ; décrit de façon
  à pouvoir être retrouvé ultérieurement (référence à l'élément, extrait de son texte visible, et
  position/dimensions au moment de la saisie comme repère de secours).
- **Stakeholder (Auteur·rice)** : personne qui dépose des retours ; seul attribut : nom
  d'affichage déclaratif (pas de compte, pas de moyen de contact).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un·e stakeholder qui découvre l'outil dépose son premier retour annoté en moins de
  2 minutes après ouverture du lien, sans aide.
- **SC-002**: 90 % des stakeholders réussissent à créer un retour lié à un élément dès leur première
  tentative lors des tests utilisateurs.
- **SC-003**: 100 % des retours confirmés comme enregistrés sont retrouvés à l'identique (texte,
  élément annoté, auteur·rice, date) lors d'une consultation ultérieure.
- **SC-004**: Le produit cible s'affiche dans l'outil en moins de 3 secondes de plus que s'il était
  ouvert directement, pour 95 % des chargements.
- **SC-005**: L'enregistrement d'un retour est confirmé à la personne en moins de 2 secondes dans
  95 % des cas.
- **SC-006**: Lors des revues produit, la part des retours nécessitant une question de
  clarification « de quelle partie parles-tu ? » baisse d'au moins 50 % par rapport aux retours
  collectés sans outil.
- **SC-007**: Les parcours « déposer un retour » et « consulter les retours » ne présentent aucune
  violation d'accessibilité de niveau A ou AA lors des audits automatisés et manuels.

## Assumptions

- Les produits évalués sont des applications web accessibles depuis le navigateur du·de la
  stakeholder (environnements de recette, préproduction ou production).
- L'équipe produit est responsable de rendre son produit affichable dans l'outil (autorisation
  d'affichage embarqué) et d'y intégrer le module de connexion fourni par l'outil (FR-006a) ;
  l'outil ne contourne pas les protections du produit cible.
- Pour les produits avec connexion, l'outil est déployé sur le même domaine parent que le produit
  (par exemple un sous-domaine commun) ; c'est une condition de déploiement à vérifier avant
  d'ajouter le site à la liste des sites autorisés. Le fonctionnement de la connexion sur un autre
  domaine n'est pas garanti dans cette version.
- L'identité des auteur·rices est purement déclarative (nom saisi) : l'outil est destiné à un
  usage entre parties de confiance disposant du lien ; l'usurpation de nom n'est pas traitée dans
  cette version.
- L'outil n'assure pas la confidentialité des retours ni la protection contre les dépôts abusifs
  (FR-019) : ce risque est accepté. S'il est exposé sur Internet, les retours y sont lisibles par
  quiconque ; un déploiement sur réseau privé ou VPN est recommandé si les retours sont sensibles.
- Le lien d'accès (avec l'adresse du produit) est préparé et diffusé par l'équipe produit ;
  un écran de gestion des produits ou des sites autorisés est hors périmètre de cette version :
  ajouter un site autorisé se fait en modifiant la configuration de déploiement (FR-003a).
- Les retours sont uniquement textuels : pièces jointes, captures d'écran automatiques, fils de
  réponse, mentions et notifications sont hors périmètre de cette version.
- La modification et la suppression d'un retour par son auteur·rice sont hors périmètre de cette
  version.
- Les retours sont conservés sans limite de durée tant que le produit est en cours d'évaluation ;
  aucune exigence réglementaire spécifique de rétention n'est identifiée.
- La langue par défaut de l'interface est le français.
- Les choix techniques exprimés dans la demande initiale (affichage embarqué du produit, interface
  web, base relationnelle PostgreSQL) sont des contraintes qui seront reprises et justifiées dans
  le plan d'implémentation ; la présente spécification n'en dépend pas.
