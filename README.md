# Pôle Habitat Écologique

Site vitrine statique de Pôle Habitat Écologique.

Le site ne nécessite pas de serveur, de base de données ou de compilation. Il est prévu pour être publié directement avec GitHub Pages.

## Structure

- `index.html` contient les contenus et les sections de la page.
- `styles.css` contient le design et les règles responsive.
- `scripts.js` gère les carrousels photos aléatoires.
- `assets/images/` contient les images fixes du site.
- `assets/photos/` contient les photos optimisées pour le web et les fichiers manifest.
- `Photos/` contient les originaux locaux et reste ignoré par Git.

## Carrousels photos

Les deux carrousels utilisent la même logique :

- les photos sont lues depuis `assets/photos/photos-manifest.json` ;
- l'ordre change à chaque ouverture de page ;
- le site affiche un échantillon de miniatures pour rester fluide, notamment sur mobile ;
- le HTML garde quelques images de secours si le manifest ne peut pas être chargé en prévisualisation locale.

Catégories utilisées :

- `vitrine-conseil` pour le carrousel des missions de conseil ;
- `galerie-stages-passes` pour le carrousel des stages pratiques.

## Ajouter ou supprimer des photos

1. Ajouter ou retirer les originaux dans `Photos/Vitrine conseil/` ou `Photos/Galerie stages passés/`.
2. Régénérer les images web et le manifest :

```powershell
powershell -ExecutionPolicy Bypass -File tools/prepare-photos.ps1
```

3. Vérifier le site en local.
4. Committer puis pousser les changements.

Le dossier `Photos/` ne doit pas être poussé sur GitHub : seules les versions optimisées dans `assets/photos/` sont publiées.

## Modifier un stage

Dans `index.html`, chercher la section `#stages`, puis modifier les cartes `article.stage-card`.

## Publication GitHub Pages

GitHub Pages peut publier directement la branche principale avec `index.html` à la racine du dépôt.
