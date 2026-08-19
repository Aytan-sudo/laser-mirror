# Laser & Miroirs

Petit puzzle optique statique pour navigateur. Le laser est visible en permanence : chaque clic fait pivoter un miroir entre `/` et `\`. Le but est d'atteindre le cristal en aussi peu de rotations que possible.

## Version 1.2

- grille 6 × 6 ;
- miroirs fixes, rotatifs sur deux orientations ;
- miroirs verrouillés dont l'orientation est imposée ;
- lasers rouge, bleu ou jaune ;
- filtres colorés qui n'acceptent que le rayon de leur couleur ;
- cristal coloré correspondant au laser ;
- laser recalculé instantanément ;
- puzzles procéduraux reproductibles par seed ;
- solver exhaustif qui calcule le nombre minimal de rotations (`PAR`) en respectant verrous et filtres ;
- trois difficultés ;
- défi quotidien déterministe ;
- statistiques locales : parties terminées, taux au PAR, écart moyen et séries quotidiennes ;
- lecture animée d'une solution optimale après la victoire ;
- reprise de la partie via `localStorage` ;
- six palettes : Sable, Ardoise, Sauge, Rose, Nuit et Crépuscule ;
- PWA hors ligne ;
- aucune dépendance runtime.

Le `PAR` est affiché avant la résolution : il fait partie du puzzle, pas seulement du score final.

## Génération

Le générateur ne tire pas une grille entièrement au hasard. Il construit d'abord un trajet optique valide depuis un bord jusqu'au cristal, place les miroirs nécessaires, verrouille éventuellement certains éléments, ajoute quelques leurres et des filtres puis mélange les orientations des miroirs modifiables. Le solver valide ensuite le puzzle et rejette les candidats trop faciles, trop ambigus ou hors de la plage de difficulté demandée.

Les seeds sont déterministes : une même seed et une même difficulté produisent la même grille. Le défi quotidien utilise une seed dérivée de la date.

## Architecture

- `js/engine.js` : réflexion, filtres, traçage du laser, détection de boucle, solver ;
- `js/generator.js` : génération et calibration des puzzles ;
- `js/rng.js` : RNG déterministe ;
- `js/storage.js` : stockage local avec fallback mémoire ;
- `js/app.js` : interface, défi quotidien, statistiques et état de partie ;
- `css/style.css` : structure visuelle historique ;
- `css/polish.css` : palettes et cohérence graphique ;
- `css/features.css` : filtres, couleurs, verrous et interfaces v1.1/v1.2 ;
- `tests/` : tests Node du moteur et du générateur.

Le moteur est indépendant du DOM et peut être testé seul.

## Développement

```bash
npm test
npm run check
```

Pour jouer localement, servir le dossier avec n'importe quel serveur HTTP statique, par exemple :

```bash
python3 -m http.server 8000
```

Puis ouvrir `http://localhost:8000`.

## Contrôles

- clic/tap sur un miroir : rotation ;
- les miroirs avec cadenas ne peuvent pas être tournés ;
- `R` : recommencer le puzzle ;
- `N` : nouveau puzzle ;
- Tab + Entrée/Espace : contrôle clavier standard des miroirs.
