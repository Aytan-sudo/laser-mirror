# Laser & Miroirs

Petit puzzle optique statique pour navigateur. Le laser est visible en permanence : chaque clic fait pivoter un miroir entre `/` et `\`. Le but est d'atteindre le cristal en aussi peu de rotations que possible.

## Version 1.4.2

- le miroir verrouillé s'entend enfin sur un téléphone : sa note disait non par
  la profondeur — 150 Hz, c'est-à-dire rien du tout sur un haut-parleur de
  téléphone — elle le dit désormais par sa chute, de 440 vers 320 Hz ;
- le contexte audio se prépare au premier geste du joueur, seul moment où iOS
  accepte de le démarrer, et se réveille au retour de l'arrière-plan ;
- `tests/sound.test.js` : un contexte audio factice fait tourner le vrai module
  et relève les hauteurs réellement émises, glissandos compris ;
- `npm run serve` prend le port 8771, à lui seul.

## Version 1.4.1

- les cibles tactiles de l'interface passent à 44 px (boutons d'en-tête,
  boutons texte, listes déroulantes), conformément à la convention.

## Version 1.4

- dialogue **Options** : palette, sons, vibration et numéro de version ;
- **sons de synthèse** en option — clic de verre à la rotation, note grave sur
  un miroir verrouillé, accord à la victoire, accord prolongé au PAR ;
- **vibration** en option sur mobile ;
- **partage du résultat** : une fois le cristal atteint, le bouton copie le
  score en emojis plutôt que le seul lien ;
- palette posée avant le premier pixel : plus de clignotement au chargement ;
- palette suivante au raccourci `T` ; le choix direct vit dans les Options ;
- icônes PNG 180/192/512 dans `assets/` — l'écran d'accueil iOS n'est plus
  dégradé ;
- service worker **réseau d'abord** et cache nommé `laser-mirror-1.4.0` ;
- tests structurels : coquille complète, identifiants de la page, palettes
  complètes, concordance des trois versions.

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
- adresse synchronisée avec la grille affichée, et bouton « Partager » ;
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

L'adresse décrit toujours la grille affichée : `?seed=…&niveau=…` pour un puzzle libre, `?jour=AAAA-MM-JJ` pour le défi quotidien. Recharger la page redonne donc le même puzzle.

« Partager » copie un texte compact. Avant la victoire, une invitation et le lien ; après, le résultat en emojis — le PAR en carrés de la couleur du laser, les rotations en trop en carrés blancs :

```
Laser & Miroirs 24/08/2026
7 rotations · PAR 5
🟥🟥🟥🟥🟥⬜⬜💎
https://aytan-sudo.github.io/laser-mirror/?jour=2026-08-24
```

Le lien ne porte jamais le score ni la solution : seulement de quoi refabriquer la même grille chez le destinataire.

Un lien du jour rouvert un autre jour redonne la même grille, mais hors mode quotidien : la série ne compte que le défi joué le jour même.

## Architecture

- `js/engine.js` : réflexion, filtres, traçage du laser, détection de boucle, solver ;
- `js/generator.js` : génération et calibration des puzzles ;
- `js/rng.js` : RNG déterministe ;
- `js/storage.js` : stockage local avec fallback mémoire ;
- `js/config.js` : la version du jeu et l'adresse publique, rien d'autre ;
- `js/share.js` : lien et résumé de partage, testable sans navigateur ;
- `js/sound.js` : les quatre timbres de synthèse WebAudio, tous au-dessus du plancher des 300 Hz que ne franchit pas un haut-parleur de téléphone ;
- `js/app.js` : interface, défi quotidien, partage, statistiques et état de partie ;
- `css/palettes.css` : les six palettes, et rien d'autre ;
- `css/board.css` : géométrie et habillage du plateau, sans aucune teinte en dur ;
- `css/features.css` : éléments optiques et écrans annexes (filtres, cadenas, défi du jour, statistiques, partage) ;
- `tests/` : tests Node du moteur, du générateur, du partage, du son, et les vérifications structurelles de la page.

Le code interne reste en anglais, comme au premier jour du jeu : la convention française du dossier ne vaut que pour les jeux nouveaux, et mélanger les deux au sein d'un même moteur coûterait plus que ça ne rapporte.

Le moteur est indépendant du DOM et peut être testé seul.

## Développement

```bash
npm test
npm run check
npm run serve
```

`npm run serve` ouvre le dossier sur `http://localhost:8771`. Le port est propre à ce jeu, et c'est délibéré : les jeux du dossier ont longtemps partagé `8765`, donc une même origine — même `localStorage`, même portée de service worker, mêmes caches — au point qu'un jeu pouvait servir ses propres modules à son voisin.

## Contrôles

- clic/tap sur un miroir : rotation ;
- les miroirs avec cadenas ne peuvent pas être tournés ;
- `R` : recommencer le puzzle ;
- `N` : nouveau puzzle ;
- `T` : palette suivante ;
- `Échap` : ferme le dialogue ouvert ;
- Tab + Entrée/Espace : contrôle clavier standard des miroirs.

## Ce qui n'est pas là

- **Pas d'annulation.** Une rotation s'annule en retournant le même miroir, et
  le compteur doit en garder la trace : c'est le prix du PAR.
- **Pas d'indice.** Le PAR est affiché dès le départ ; la solution optimale ne
  se montre qu'après la victoire, et elle ne compte pas comme une aide.
- **Pas de minuterie.** Le jeu se mesure en rotations, pas en secondes.
- **Pas de compte, pas de serveur, pas d'octet qui sort de la machine.** Le
  défi du jour se refabrique chez chacun à partir de la date.
