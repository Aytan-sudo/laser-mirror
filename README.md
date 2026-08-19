# Laser & Miroirs

Petit puzzle optique statique pour navigateur. Le laser est visible en permanence : chaque clic fait pivoter un miroir entre `/` et `\`. Le but est d'atteindre le cristal en aussi peu de rotations que possible.

## Version 1.3

- grille 6 × 6 ;
- miroirs fixes, rotatifs sur deux orientations ;
- miroirs verrouillés dont l'orientation est imposée ;
- lasers rouge, bleu ou jaune ;
- filtres colorés qui n'acceptent que le rayon de leur couleur ;
- cristal coloré correspondant au laser ;
- laser recalculé instantanément ;
- puzzles procéduraux reproductibles par seed ;
- solver exhaustif qui calcule le nombre minimal de rotations (`PAR`) en respectant verrous et filtres ;
- générateur calibré : le `PAR` visé est le minimum réel, les raccourcis sont coupés par les filtres ;
- trois difficultés ;
- défi quotidien déterministe ;
- adresse synchronisée avec la grille affichée, et bouton « Partager » qui copie le lien ;
- statistiques locales : parties terminées, taux au PAR, écart moyen et séries quotidiennes ;
- lecture animée d'une solution optimale après la victoire ;
- reprise de la partie via `localStorage` ;
- six palettes : Sable, Ardoise, Sauge, Rose, Nuit et Crépuscule ;
- PWA hors ligne ;
- aucune dépendance runtime.

Le `PAR` est affiché avant la résolution : il fait partie du puzzle, pas seulement du score final.

## Génération

Le générateur ne tire pas une grille entièrement au hasard. Il construit d'abord un trajet optique valide depuis un bord jusqu'au cristal, place les miroirs nécessaires, ajoute quelques leurres, puis répartit les cadenas entre trajet et leurres pour qu'un verrou ne trahisse jamais l'emplacement de la solution.

Il balaie ensuite toutes les configurations de miroirs d'un seul coup : celles qui atteignent le cristal, et les cases traversées par chacune. Un miroir qu'aucune configuration n'éclaire n'est pas un leurre mais du mobilier : il est retiré. Les filtres sont alors posés là où ils coupent le plus de raccourcis, de sorte que le `PAR` visé soit vraiment le minimum, puis là où ils lèvent les solutions ex æquo. Le solver du moteur valide le candidat final et rejette ce qui reste trop ambigu ou hors de la plage demandée.

Les seeds sont déterministes : une même seed et une même difficulté produisent la même grille. Le défi quotidien utilise une seed dérivée de la date.

## Partage

L'adresse décrit toujours la grille affichée : `?seed=…&niveau=…` pour un puzzle libre, `?jour=AAAA-MM-JJ` pour le défi quotidien. Recharger la page redonne donc le même puzzle, et « Partager » se contente de copier ce lien.

Un lien du jour rouvert un autre jour redonne la même grille, mais hors mode quotidien : la série ne compte que le défi joué le jour même.

## Architecture

- `js/engine.js` : réflexion, filtres, traçage du laser, détection de boucle, solver ;
- `js/generator.js` : génération et calibration des puzzles ;
- `js/rng.js` : RNG déterministe ;
- `js/storage.js` : stockage local avec fallback mémoire ;
- `js/app.js` : interface, défi quotidien, partage, statistiques et état de partie ;
- `css/palettes.css` : les six palettes, et rien d'autre ;
- `css/board.css` : géométrie et habillage du plateau, sans aucune teinte en dur ;
- `css/features.css` : éléments optiques et écrans annexes (filtres, cadenas, défi du jour, statistiques, partage) ;
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
