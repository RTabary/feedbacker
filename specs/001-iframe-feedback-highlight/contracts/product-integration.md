# Contract: intégrer un produit à l'outil

Conditions à remplir par l'équipe produit pour qu'un site soit annotable. Exemples avec l'outil sur
`https://feedback.example.com` et le produit sur `https://app.example.com`.

## 1. Ajouter le script sur toutes les pages

```html
<script src="https://feedback.example.com/connector.js" defer></script>
```

- Script classique uniquement : `type="module"` empêche le connecteur de connaître l'origine de l'outil.
- Il doit être présent sur toutes les pages à annoter. Une page sans script affiche le message
  d'absence de réponse (FR-004), et le produit y reste utilisable.
- Hors de l'outil, le script n'a aucun effet visible ni fonctionnel (FR-006b).

## 2. Autoriser l'outil dans les en-têtes du produit

```text
Content-Security-Policy: frame-ancestors https://feedback.example.com; script-src ... https://feedback.example.com
```

- Si le produit envoie `X-Frame-Options: SAMEORIGIN` ou `DENY`, il faut le retirer sur les
  environnements évalués : deux sous-domaines n'ont pas la même origine.
- Sans `Content-Security-Policy` sur le produit, seul le retrait de `X-Frame-Options` est nécessaire.

## 3. Pour un produit avec connexion

- L'outil et le produit partagent le même domaine parent (`example.com` ici).
- Si la connexion passe par un fournisseur d'identité externe, le stakeholder se connecte d'abord au
  produit dans un onglet séparé : le site du fournisseur n'est pas dans la liste de sites, et
  l'outil bloque son affichage.

## 4. Ajouter le site à la configuration de l'outil

Ajouter l'origine exacte à `ALLOWED_PRODUCT_ORIGINS`, puis redémarrer l'outil. Chaque environnement
(recette, production) est une entrée distincte et un produit distinct.

## 5. Rendre les retours plus durables (facultatif)

Poser `data-feedback-anchor="nom-stable"` sur les éléments importants. L'élément reste alors retrouvé
après une refonte de la page, sans autre action.

## Limites à connaître

| Situation | Comportement |
|-----------|--------------|
| Produit en `http` et outil en `https` | Affichage bloqué par le navigateur (contenu mixte) |
| Lien dans le produit vers un site hors liste | Navigation bloquée dans l'iframe |
| Élément dans un Shadow DOM ou une iframe imbriquée | Annoté au niveau de son hôte |
| Application routée par fragment (`#/...`) | Une seule page pour l'outil |
| Données personnelles affichées sur l'élément annoté | Les 120 premiers caractères du texte visible sont enregistrés, et lisibles par quiconque accède à l'outil |
