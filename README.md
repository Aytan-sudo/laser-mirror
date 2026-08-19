# Laser & Miroirs

Petit puzzle optique statique pour navigateur. Le laser est visible en permanence : chaque clic fait pivoter un miroir entre `/` et `\\`. Le but est d'atteindre le cristal en aussi peu de rotations que possible.

## MVP

- grille 6 × 6 ;
- miroirs fixes, rotatifs sur deux orientations ;
- laser recalculé instantanément ;
- cible unique ;
- puzzles procéduraux reproductibles par seed ;
- solver exhaustif qui calcule le nombre minimal de rotations (`PAR`) ;
- trois difficultés ;
- reprise de la partie via `localStorage` ;
- thème clair/sombre ;
- PWA hors ligne ;
- aucune dépendance runtime.

Le `PAR` est affiché avant la résolution : il fait partie du puzzle, pas seulement du score final.

## Génération

Le générateur ne tire pas une grille entièrement au hasard. Il construit d'abord un trajet optique valide depuis un bord jusqu'au cristal, place les miroirs nécessaires, ajoute quelques leurres puis mélange les orientations. Le solver valide ensuite le puzzle et rejette les candidats trop faciles, trop ambigus ou hors de la plage de difficulté demandée.

Les seeds sont déterministes : une même seed et une même difficulté produisent la même grille.

## Architecture

- `js/engine.js` : réflexion, traçage du laser, détection de boucle, solver ;
- `js/generator.js` : génération et calibration des puzzles ;
- `js/rng.js` : RNG déterministe ;
- `js/storage.js` : stockage local avec fallback mémoire ;
- `js/app.js` : interface et état de partie ;
- `css/style.css` : thèmes, plateau et animations ;
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
- `R` : recommencer le puzzle ;
- `N` : nouveau puzzle ;
- Tab + Entrée/Espace : contrôle clavier standard des miroirs.
